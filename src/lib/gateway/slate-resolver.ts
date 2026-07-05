/**
 * SlateResolver — market discovery + gateway-cached metadata + kickoff vs live odds.
 * Single resolution path for sovereign report, daily scanner, and trade pipeline.
 */

import { PolymarketApi, PolyMarket } from '../polymarket-api';
import { PolymarketGateway } from './PolymarketGateway';
import { computeUnifiedAlpha } from '../pillar-analyzer';

const CLOB_URL = 'https://clob.polymarket.com';

export interface OddsSnapshot {
    price: number;
    ev?: number;
    alpha?: number;
    source: 'live_gamma' | 'kickoff_clob';
    timestamp?: string;
}

export interface OddsComparison {
    valueTeam: string;
    outcomeIndex: number;
    kickoff?: OddsSnapshot;
    live: OddsSnapshot;
    priceDelta: number;
    evDelta?: number;
    alphaDelta?: number;
}

export class SlateResolver {
    private sportsMarkets: PolyMarket[] | null = null;

    constructor(
        private api: PolymarketApi,
        private gateway: PolymarketGateway
    ) {}

    async loadSportsMarkets(force = false): Promise<PolyMarket[]> {
        if (!this.sportsMarkets || force) {
            this.sportsMarkets = await this.api.getAllActiveSportsMarkets();
        }
        return this.sportsMarkets;
    }

    findMoneylineInMarkets(
        markets: PolyMarket[],
        homeTeam: string,
        awayTeam: string,
        gameDate?: string,
        gameStartIso?: string
    ): PolyMarket | null {
        return this.api.findMoneylineInMarkets(markets, homeTeam, awayTeam, gameDate, gameStartIso);
    }

    /** Historical backtest: closed Gamma markets + optional CLOB kickoff prices. */
    async resolveHistoricalMoneyline(
        homeTeam: string,
        awayTeam: string,
        gameDate: string,
        gameStartIso: string,
        opts: { skipKickoff?: boolean; skipGatewayRefresh?: boolean } = {}
    ): Promise<PolyMarket | null> {
        let match = await this.api.getMarketByTeams(homeTeam, awayTeam, gameDate, gameStartIso, { includeClosed: true });
        if (!match?.conditionId) return null;

        if (!opts.skipGatewayRefresh) {
            const meta = await this.gateway.getMarketMetadata(match.conditionId, true);
            if (meta) match = this.enrichFromGateway(match, meta);
        }

        return opts.skipKickoff ? match : this.hydrateKickoffPrices(match, gameStartIso);
    }

    /** Replace outcomePrices with CLOB prices at first pitch (for historical backtests). */
    async hydrateKickoffPrices(market: PolyMarket, kickoffIso: string): Promise<PolyMarket> {
        if (!market.clobTokenIds || !market.outcomes) return market;
        const prices = await Promise.all(
            market.outcomes.map(async (_o, i) => {
                const tokenId = market.clobTokenIds?.[i];
                if (!tokenId) return market.outcomePrices?.[i] || '0.5';
                const p = await this.fetchKickoffPrice(tokenId, kickoffIso);
                return p !== undefined ? String(p) : (market.outcomePrices?.[i] || '0.5');
            })
        );
        return { ...market, outcomePrices: prices };
    }

    /** Resolve moneyline, warm gateway metadata cache, return enriched market. */
    async resolveMoneyline(
        homeTeam: string,
        awayTeam: string,
        gameDate?: string,
        gameStartIso?: string
    ): Promise<PolyMarket | null> {
        const markets = await this.loadSportsMarkets();
        let match = this.api.findMoneylineInMarkets(markets, homeTeam, awayTeam, gameDate, gameStartIso);

        if (!match) {
            match = await this.api.getMarketByTeams(homeTeam, awayTeam, gameDate, gameStartIso);
            if (match && !markets.some(m => m.conditionId === match!.conditionId)) {
                this.sportsMarkets = [...markets, match];
            }
        }

        if (!match?.conditionId) return match;

        // Always fetch fresh Gamma prices for slate scans — bulk tag sweep and SQLite TTL cache go stale in-game.
        const meta = await this.gateway.getMarketMetadata(match.conditionId, true);
        return meta ? this.enrichFromGateway(match, meta) : match;
    }

    private enrichFromGateway(local: PolyMarket, meta: any): PolyMarket {
        const outcomes = meta.outcomes
            ? (typeof meta.outcomes === 'string' ? JSON.parse(meta.outcomes) : meta.outcomes)
            : local.outcomes;
        const outcomePrices = meta.outcomePrices
            ? (typeof meta.outcomePrices === 'string' ? JSON.parse(meta.outcomePrices) : meta.outcomePrices)
            : local.outcomePrices;
        const clobTokenIds = meta.clobTokenIds
            ? (typeof meta.clobTokenIds === 'string' ? JSON.parse(meta.clobTokenIds) : meta.clobTokenIds)
            : local.clobTokenIds;

        return {
            ...local,
            question: meta.question || local.question,
            description: meta.description || local.description,
            outcomes,
            outcomePrices,
            clobTokenIds,
            endDate: meta.endDate || local.endDate,
            active: meta.active ?? local.active,
            volume: parseFloat(meta.volume || String(local.volume || 0)),
        };
    }

    static matchesTeam(team: string, outcomeName: string): boolean {
        const teamLower = team.toLowerCase();
        const outcomeLower = outcomeName.toLowerCase();
        if (teamLower.includes(outcomeLower) || outcomeLower.includes(teamLower)) return true;
        const mascot = teamLower.split(' ').pop() || '';
        if (mascot.length > 2 && (outcomeLower.includes(mascot) || teamLower.includes(outcomeLower))) return true;
        return teamLower.split(/\s+/).filter(p => p.length > 3).some(part => outcomeLower.includes(part));
    }

    resolveOutcomeIndex(homeTeam: string, awayTeam: string, valueTeam: string, market: PolyMarket): number | undefined {
        if (!market.outcomes) return undefined;
        for (let i = 0; i < market.outcomes.length; i++) {
            const name = market.outcomes[i];
            if (SlateResolver.matchesTeam(valueTeam, name)) return i;
        }
        if (SlateResolver.matchesTeam(valueTeam, homeTeam)) {
            return market.outcomes.findIndex(o => SlateResolver.matchesTeam(homeTeam, o));
        }
        if (SlateResolver.matchesTeam(valueTeam, awayTeam)) {
            return market.outcomes.findIndex(o => SlateResolver.matchesTeam(awayTeam, o));
        }
        return undefined;
    }

    private livePriceForOutcome(market: PolyMarket, outcomeIndex: number): number | undefined {
        const raw = market.outcomePrices?.[outcomeIndex];
        if (raw === undefined) return undefined;
        const price = parseFloat(raw);
        return price && !isNaN(price) ? price : undefined;
    }

    private bodhiProbability(confidence: number): number {
        return confidence / 100;
    }

    private async fetchKickoffPrice(tokenId: string, kickoffIso: string): Promise<number | undefined> {
        const kickoffSec = Math.floor(new Date(kickoffIso).getTime() / 1000);
        if (!kickoffSec || isNaN(kickoffSec)) return undefined;

        const url = `${CLOB_URL}/prices-history?market=${tokenId}&startTs=${kickoffSec - 3600}&endTs=${kickoffSec + 3600}&fidelity=5`;
        try {
            const res = await fetch(url);
            if (!res.ok) return undefined;
            const data = await res.json();
            const history: { t: number; p: number }[] = data.history || [];
            if (history.length === 0) return undefined;

            let best = history[0];
            let bestDelta = Math.abs(best.t - kickoffSec);
            for (const pt of history) {
                const delta = Math.abs(pt.t - kickoffSec);
                if (delta < bestDelta) {
                    best = pt;
                    bestDelta = delta;
                }
            }
            return typeof best.p === 'number' ? best.p : parseFloat(String(best.p));
        } catch {
            return undefined;
        }
    }

    /**
     * Compare kickoff CLOB price vs live Gamma price for the value side.
     * Kickoff is only fetched once the game has started (kickoff + 5 min).
     */
    async compareOdds(
        market: PolyMarket,
        homeTeam: string,
        awayTeam: string,
        valueTeam: string,
        bodhiConfidence: number,
        kickoffIso?: string
    ): Promise<OddsComparison | null> {
        const outcomeIndex = this.resolveOutcomeIndex(homeTeam, awayTeam, valueTeam, market);
        if (outcomeIndex === undefined || outcomeIndex < 0) return null;

        const livePrice = this.livePriceForOutcome(market, outcomeIndex);
        if (livePrice === undefined) return null;

        const bodhiProb = this.bodhiProbability(bodhiConfidence);
        const liveEV = bodhiProb - livePrice;
        const live: OddsSnapshot = {
            price: livePrice,
            ev: liveEV,
            alpha: computeUnifiedAlpha(bodhiConfidence, liveEV),
            source: 'live_gamma',
            timestamp: new Date().toISOString(),
        };

        let kickoff: OddsSnapshot | undefined;
        if (kickoffIso) {
            const kickoffMs = new Date(kickoffIso).getTime();
            const gameStarted = Date.now() >= kickoffMs + 5 * 60 * 1000;
            const tokenId = market.clobTokenIds?.[outcomeIndex];
            if (gameStarted && tokenId) {
                const kickoffPrice = await this.fetchKickoffPrice(tokenId, kickoffIso);
                if (kickoffPrice !== undefined) {
                    const kickoffEV = bodhiProb - kickoffPrice;
                    kickoff = {
                        price: kickoffPrice,
                        ev: kickoffEV,
                        alpha: computeUnifiedAlpha(bodhiConfidence, kickoffEV),
                        source: 'kickoff_clob',
                        timestamp: kickoffIso,
                    };
                }
            }
        }

        return {
            valueTeam,
            outcomeIndex,
            kickoff,
            live,
            priceDelta: kickoff ? livePrice - kickoff.price : 0,
            evDelta: kickoff?.ev !== undefined ? liveEV - kickoff.ev : undefined,
            alphaDelta: kickoff?.alpha !== undefined && live.alpha !== undefined
                ? live.alpha - kickoff.alpha
                : undefined,
        };
    }
}