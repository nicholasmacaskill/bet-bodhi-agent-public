/**
 * PolymarketGateway - Standalone Decoupled Data Resolution Middleware
 *
 * Owns Gamma API rate limiting, in-memory cache, and optional SQLite persistence
 * so sync / PnL / enrichment scripts do not each re-fetch the same market metadata.
 */

import { db } from '../sqlite-client';

export interface GatewayConfig {
    delayMs?: number;
    gammaUrl?: string;
    overrides?: { [question: string]: number };
    /** Persist resolved market metadata to SQLite (default: true) */
    persistCache?: boolean;
    /** Re-fetch open markets after this many ms (default: 1 hour) */
    openMarketTtlMs?: number;
}

interface DiskCacheRow {
    payload: string | null;
    closed: number;
    cached_at: string;
}

export interface RawClobTrade {
    id: string;
    market: string;      // Condition ID
    asset_id: string;    // Token ID
    side: string;        // BUY or SELL
    size: string;
    price: string;
    outcome: string;     // Literal target outcome name (e.g. "Washington Nationals")
    trader_side: string; // TAKER or MAKER
    match_time?: string; // Unix seconds when fill occurred
    transaction_hash?: string;
}

export interface NormalizedTrade extends RawClobTrade {
    userAction: 'BUY' | 'SELL';
    matchTimeUnix: number;
    tradeId: string;
}

/**
 * Resolves the user's true action (MAKER side is inverted) and canonical trade id/timestamp.
 */
export function normalizeTrade(raw: RawClobTrade): NormalizedTrade {
    let userAction: 'BUY' | 'SELL' = raw.side === 'SELL' ? 'SELL' : 'BUY';
    if (raw.trader_side === 'MAKER') {
        userAction = raw.side === 'BUY' ? 'SELL' : 'BUY';
    }
    const matchTimeUnix = parseInt(raw.match_time || '0', 10);
    const tradeId = raw.id || raw.transaction_hash || '';
    return { ...raw, userAction, matchTimeUnix, tradeId };
}

export interface MarketPnLDetails {
    question: string;
    isBaseball: boolean;
    closed: boolean;
    winner: string;
    positions: { [outcome: string]: number };
    totalCost: number;
    realizedPnL: number;
}

export interface PolymarketPnLReport {
    kboProfit: number;
    mlbProfit: number;
    otherProfit: number;
    totalRealizedProfit: number;
    totalOpenValue: number;
    markets: { [tokenId: string]: MarketPnLDetails };
}

export class PolymarketGateway {
    private delayMs: number;
    private gammaUrl: string;
    private overrides: { [question: string]: number };
    private persistCache: boolean;
    private openMarketTtlMs: number;
    private detailsCache: Map<string, any> = new Map();

    constructor(config: GatewayConfig = {}) {
        this.delayMs = config.delayMs ?? 120;
        this.gammaUrl = config.gammaUrl ?? "https://gamma-api.polymarket.com";
        this.overrides = config.overrides ?? {};
        this.persistCache = config.persistCache !== false;
        this.openMarketTtlMs = config.openMarketTtlMs ?? 60 * 60 * 1000;
    }

    private loadFromDisk(conditionId: string): any | undefined {
        if (!this.persistCache) return undefined;
        const row = db.prepare(
            `SELECT payload, closed, cached_at FROM gamma_market_cache WHERE condition_id = ?`
        ).get(conditionId) as DiskCacheRow | undefined;
        if (!row) return undefined;

        if (row.closed === 1) {
            return row.payload ? JSON.parse(row.payload) : null;
        }

        const ageMs = Date.now() - new Date(row.cached_at).getTime();
        if (ageMs < this.openMarketTtlMs) {
            return row.payload ? JSON.parse(row.payload) : null;
        }
        return undefined;
    }

    private saveToDisk(conditionId: string, details: any | null): void {
        if (!this.persistCache) return;
        const closed = details?.closed ? 1 : 0;
        db.prepare(`
            INSERT INTO gamma_market_cache (condition_id, payload, closed, cached_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(condition_id) DO UPDATE SET
                payload = excluded.payload,
                closed = excluded.closed,
                cached_at = excluded.cached_at
        `).run(conditionId, details ? JSON.stringify(details) : null, closed);
    }

    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Batch-warm metadata for all markets referenced by trades.
     * Closed markets are served from SQLite on subsequent runs (no Gamma calls).
     */
    public async ensureMarketsCached(
        trades: RawClobTrade[],
        concurrency = 15
    ): Promise<{ total: number; fromCache: number; fetched: number }> {
        const conditionIds = Array.from(new Set(trades.map(t => t.market).filter(Boolean)));
        return this.prefetchMarkets(conditionIds, concurrency);
    }

    public async prefetchMarkets(
        conditionIds: string[],
        concurrency = 15
    ): Promise<{ total: number; fromCache: number; fetched: number }> {
        let fromCache = 0;
        const toFetch: string[] = [];

        for (const id of conditionIds) {
            if (this.detailsCache.has(id)) {
                fromCache++;
                continue;
            }
            const disk = this.loadFromDisk(id);
            if (disk !== undefined) {
                this.detailsCache.set(id, disk);
                fromCache++;
                continue;
            }
            toFetch.push(id);
        }

        let fetched = 0;
        const chunks = this.chunkArray(toFetch, concurrency);
        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (id) => {
                await this.fetchMarketMetadata(id);
                fetched++;
            }));
            console.log(
                `[PolymarketGateway] Metadata ${fromCache + fetched}/${conditionIds.length}` +
                ` (${fromCache} cached, ${fetched} fetched)`
            );
        }

        return { total: conditionIds.length, fromCache, fetched };
    }

    private async fetchMarketMetadata(conditionId: string): Promise<any | null> {
        try {
            await this.sleep(this.delayMs);

            let url = `${this.gammaUrl}/markets?condition_ids=${conditionId}`;
            let res = await fetch(url);
            let data = await res.json();

            if (data && data.length > 0) {
                const details = data[0];
                this.detailsCache.set(conditionId, details);
                this.saveToDisk(conditionId, details);
                return details;
            }

            await this.sleep(this.delayMs);
            url = `${this.gammaUrl}/markets?condition_ids=${conditionId}&closed=true`;
            res = await fetch(url);
            data = await res.json();

            if (data && data.length > 0) {
                const details = data[0];
                this.detailsCache.set(conditionId, details);
                this.saveToDisk(conditionId, details);
                return details;
            }

            this.detailsCache.set(conditionId, null);
            this.saveToDisk(conditionId, null);
            return null;
        } catch (error) {
            console.error(`[PolymarketGateway] Failed to retrieve metadata for condition ${conditionId}:`, error);
            return null;
        }
    }

    /**
     * Helper to perform rate-limited sleeps between API requests.
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Resolves the market metadata for a specific condition ID.
     * Uses `condition_ids` (plural) parameter to prevent Gamma from silently ignoring the filter.
     * Tries active markets first, then queries with closed=true filter fallback.
     */
    public async getMarketMetadata(conditionId: string, forceRefresh = false): Promise<any | null> {
        if (!forceRefresh) {
            if (this.detailsCache.has(conditionId)) {
                return this.detailsCache.get(conditionId);
            }

            const disk = this.loadFromDisk(conditionId);
            if (disk !== undefined) {
                this.detailsCache.set(conditionId, disk);
                return disk;
            }
        } else {
            this.detailsCache.delete(conditionId);
        }

        return this.fetchMarketMetadata(conditionId);
    }

    /**
     * Parses trade history, resolves market parameters, compares semantic team strings, and computes PnL.
     */
    public async calculatePnL(trades: RawClobTrade[]): Promise<PolymarketPnLReport> {
        const marketMap: { [tokenId: string]: MarketPnLDetails } = {};

        const baseballKeywords = [
            'kbo', 'mlb', 'baseball', 'korea',
            'dodgers', 'yankees', 'red sox', 'cubs', 'braves', 'phillies', 'astros', 'orioles', 'padres', 
            'nationals', 'rockies', 'rays', 'giants', 'royals', 'twins', 'cardinals', 'mets', 'white sox', 
            'marlins', 'guardians', 'rangers', 'brewers', 'blue jays', 'angels', 'diamondbacks', 'mariners', 
            'tigers', 'athletics', 'pirates', 'reds',
            'lg twins', 'kt wiz', 'ssg landers', 'nc dinos', 'doosan bears', 'kia tigers', 'lotte giants', 
            'samsung lions', 'hanwha eagles', 'kiwoom heroes', 'samsung', 'hanwha', 'kiwoom', 'doosan', 'lotte'
        ];

        for (const t of trades) {
            const conditionId = t.market;
            const tokenId = t.asset_id;
            if (!tokenId || !conditionId) continue;

            if (!marketMap[tokenId]) {
                const details = await this.getMarketMetadata(conditionId);
                
                if (!details) {
                    // Set safe fallback placeholders to prevent crashing and skip further API queries
                    marketMap[tokenId] = {
                        question: "Unknown Market",
                        isBaseball: false,
                        closed: false,
                        winner: "",
                        positions: {},
                        totalCost: 0,
                        realizedPnL: 0
                    };
                    continue;
                }

                const question = details.question || details.title || "Unknown Market";
                const lowerQuestion = question.toLowerCase();
                const isBaseball = baseballKeywords.some(kw => lowerQuestion.includes(kw));

                const isPastEnd = details.endDate ? (Date.now() > new Date(details.endDate).getTime()) : false;
                const closed = details.closed || isPastEnd || false;

                // Parse outcomes safely
                let outcomes: string[] = [];
                if (details.outcomes) {
                    outcomes = typeof details.outcomes === 'string' ? JSON.parse(details.outcomes) : details.outcomes;
                }

                // Resolve winning outcome string by winning index or outcomePrices fallback
                let winnerIndex = details.winningOutcomeIndex;
                if (winnerIndex === undefined || winnerIndex === null || winnerIndex === "") {
                    const prices = typeof details.outcomePrices === 'string' ? JSON.parse(details.outcomePrices) : details.outcomePrices || [];
                    const idx = prices.indexOf("1") !== -1 ? prices.indexOf("1") : prices.indexOf("1.0");
                    if (idx !== -1) {
                        winnerIndex = idx;
                    }
                }

                const winner = (winnerIndex !== undefined && winnerIndex !== null && winnerIndex !== "" && outcomes[parseInt(winnerIndex)])
                    ? outcomes[parseInt(winnerIndex)]
                    : "";

                marketMap[tokenId] = {
                    question,
                    isBaseball,
                    closed,
                    winner,
                    positions: {},
                    totalCost: 0,
                    realizedPnL: 0
                };
            }

            const m = marketMap[tokenId];
            const outcome = t.outcome;
            const size = parseFloat(t.size);
            const price = parseFloat(t.price);
            
            if (!m.positions[outcome]) {
                m.positions[outcome] = 0;
            }

            const { userAction } = normalizeTrade(t);

            if (userAction === 'BUY') {
                m.positions[outcome] += size;
                m.totalCost += size * price;
            } else {
                m.positions[outcome] -= size;
                m.totalCost -= size * price;
            }
        }

        let kboProfit = 0;
        let mlbProfit = 0;
        let otherProfit = 0;
        let totalOpenValue = 0;

        for (const [tokenId, m] of Object.entries(marketMap)) {
            // Ignore placeholders
            if (m.question === "Unknown Market") continue;

            let pnl = 0;

            if (this.overrides[m.question] !== undefined) {
                pnl = this.overrides[m.question];
                m.realizedPnL = pnl;
            } else if (m.closed) {
                let payout = 0;
                for (const [outcome, size] of Object.entries(m.positions)) {
                    // Match outcome team string directly against the resolved team winner string
                    if (size > 0.01 && outcome.trim().toLowerCase() === m.winner.trim().toLowerCase()) {
                        payout += size * 1.0;
                    }
                }
                pnl = payout - m.totalCost;
                m.realizedPnL = pnl;
            } else {
                let remainingShares = 0;
                for (const size of Object.values(m.positions)) {
                    remainingShares += size;
                }

                if (remainingShares < 0.01) {
                    pnl = -m.totalCost;
                    m.realizedPnL = pnl;
                } else {
                    totalOpenValue += m.totalCost;
                    continue; // Position is active, skip realized profit accumulator
                }
            }

            if (m.isBaseball) {
                if (m.question.toUpperCase().includes('KBO')) {
                    kboProfit += pnl;
                } else {
                    mlbProfit += pnl;
                }
            } else {
                otherProfit += pnl;
            }
        }

        return {
            kboProfit,
            mlbProfit,
            otherProfit,
            totalRealizedProfit: kboProfit + mlbProfit + otherProfit,
            totalOpenValue,
            markets: marketMap
        };
    }
}
