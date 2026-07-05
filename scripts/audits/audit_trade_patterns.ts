/**
 * Deep trade pattern audit — PolymarketGateway for resolution + MLB context enrichment.
 * Aggregates PnL at the *market question* level (both outcome tokens combined).
 */
import 'dotenv/config';
import { PolymarketApi } from '../../src/lib/polymarket-api';
import { PolymarketGateway, MarketPnLDetails } from '../../src/lib/gateway/PolymarketGateway';
import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';
import { db } from '../../src/lib/sqlite-client';

interface AggregatedMarket {
    question: string;
    conditionId: string;
    isMlb: boolean;
    closed: boolean;
    winner: string;
    pnl: number;
    cost: number;
    betOutcome: string;
    betShares: number;
    avgEntryPrice: number;
    won: boolean;
    gameDate?: string;
    matchup?: string;
    homeTeam?: string;
    awayTeam?: string;
    pickedHome: boolean;
    score?: string;
    gameWinner?: string;
    homePitcher?: string;
    awayPitcher?: string;
    ourPitcher?: string;
    oppPitcher?: string;
    modelTarget?: string;
    modelConfidence?: number;
    timingBucket: string;
    seriesNote?: string;
    playoffNote?: string;
}

type StatBucket = { n: number; wins: number; pnl: number; staked: number };

function bucketPrice(price: number): string {
    if (price >= 0.70) return 'Heavy Favorite (≥70¢)';
    if (price >= 0.55) return 'Moderate Favorite (55–69¢)';
    if (price >= 0.45) return 'Coin Flip (45–54¢)';
    if (price >= 0.30) return 'Underdog (30–44¢)';
    return 'Deep Underdog (<30¢)';
}

function bucketTiming(mins: number | null | undefined): string {
    if (mins === null || mins === undefined) return 'Unknown timing';
    if (mins < 0) return 'Live (after first pitch)';
    if (mins < 60) return 'Under 1h pre-game';
    if (mins < 360) return '1–6h pre-game';
    return '6h+ pre-game';
}

function addBucket(map: Record<string, StatBucket>, key: string, won: boolean, pnl: number, staked: number) {
    if (!map[key]) map[key] = { n: 0, wins: 0, pnl: 0, staked: 0 };
    map[key].n++;
    if (won) map[key].wins++;
    map[key].pnl += pnl;
    map[key].staked += staked;
}

function printBuckets(title: string, map: Record<string, StatBucket>) {
    console.log(`\n${title}`);
    console.log('─'.repeat(76));
    for (const [k, s] of Object.entries(map).sort((a, b) => b[1].pnl - a[1].pnl)) {
        const wr = s.n ? ((s.wins / s.n) * 100).toFixed(1) : '0.0';
        const roi = s.staked ? ((s.pnl / s.staked) * 100).toFixed(1) : '0.0';
        console.log(
            `${k.padEnd(34)} | ${String(s.n).padStart(4)} | WR ${wr.padStart(5)}% | PnL $${s.pnl.toFixed(2).padStart(9)} | ROI ${roi.padStart(6)}%`
        );
    }
}

function teamMatch(a: string, b: string): boolean {
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    if (al.includes(bl) || bl.includes(al)) return true;
    const am = al.split(' ').pop() || '';
    const bm = bl.split(' ').pop() || '';
    return am.length > 2 && bm.length > 2 && (al.includes(bm) || bl.includes(am));
}

function parseVsTeams(question: string): [string, string] | null {
    const parts = question.split(/\bvs\.?\b/i).map(p => p.trim());
    return parts.length >= 2 ? [parts[0], parts[1]] : null;
}

function aggregateMarkets(
    trades: any[],
    tokenMarkets: Record<string, MarketPnLDetails>
): Map<string, { tokens: MarketPnLDetails[]; conditionId: string }> {
    const byQuestion = new Map<string, { tokens: MarketPnLDetails[]; conditionId: string }>();

    for (const t of trades) {
        const m = tokenMarkets[t.asset_id];
        if (!m || m.question === 'Unknown Market') continue;
        const existing = byQuestion.get(m.question);
        if (existing) {
            if (!existing.tokens.includes(m)) existing.tokens.push(m);
        } else {
            byQuestion.set(m.question, { tokens: [m], conditionId: t.market });
        }
    }
    return byQuestion;
}

async function main() {
    console.log('══════════════════════════════════════════════════════════════════════════');
    console.log('  BODHI DEEP TRADE PATTERN AUDIT (PolymarketGateway + MLB Context)         ');
    console.log('══════════════════════════════════════════════════════════════════════════\n');

    const poly = new PolymarketApi();
    const gateway = new PolymarketGateway({
        delayMs: 80,
        overrides: { 'Athletics vs. Los Angeles Dodgers': 0.0 }
    });
    const mlb = new MLBApi();
    const analyzer = new PillarAnalyzer();

    const kickoffLookup = new Map<string, number | null>();
    const sqliteBets = db.prepare(`SELECT team, research_log, time_to_kickoff_minutes, amount, odds, result FROM bets WHERE platform='polymarket'`).all() as any[];
    for (const b of sqliteBets) {
        const qMatch = b.research_log?.match(/Question: (.+?)(?:\s*\[|$)/);
        if (qMatch) kickoffLookup.set(`${qMatch[1]}::${b.team}`, b.time_to_kickoff_minutes);
    }

    console.log('⟳ Fetching on-chain trades + Gateway resolution...');
    const trades = await poly.getTrades();
    const report = await gateway.calculatePnL(trades as any);
    console.log(`  ${trades.length} fills | Gateway MLB: $${report.mlbProfit.toFixed(2)} | KBO: $${report.kboProfit.toFixed(2)} | Total: $${report.totalRealizedProfit.toFixed(2)}\n`);

    const grouped = aggregateMarkets(trades, report.markets);
    const scheduleCache = new Map<string, Awaited<ReturnType<MLBApi['getSchedule']>>>();
    const hydrationCache = new Map<number, Awaited<ReturnType<MLBApi['getHydratedAnalysisData']>>>();

    const markets: AggregatedMarket[] = [];

    for (const [question, { tokens, conditionId }] of grouped) {
        const isKbo = question.toUpperCase().includes('KBO');
        const isMlb = !isKbo;
        const closed = tokens.every(t => t.closed);
        if (!closed) continue;

        const pnl = tokens.reduce((s, t) => s + t.realizedPnL, 0);
        const cost = tokens.reduce((s, t) => s + Math.abs(t.totalCost), 0);
        const winner = tokens.find(t => t.winner)?.winner || '';

        // Primary bet = outcome with largest positive position across tokens
        let betOutcome = '';
        let betShares = 0;
        for (const t of tokens) {
            for (const [outcome, shares] of Object.entries(t.positions)) {
                if (shares > betShares) {
                    betShares = shares;
                    betOutcome = outcome;
                }
            }
        }
        if (!betOutcome || betShares < 0.01) continue;

        let totalBought = 0;
        let priceSum = 0;
        for (const tr of trades) {
            const md = report.markets[tr.asset_id];
            if (!md || md.question !== question || tr.outcome !== betOutcome) continue;
            let action = tr.side;
            if (tr.trader_side === 'MAKER') action = tr.side === 'BUY' ? 'SELL' : 'BUY';
            if (action === 'BUY') {
                const sz = parseFloat(tr.size);
                const px = parseFloat(tr.price);
                priceSum += px * sz;
                totalBought += sz;
            }
        }
        const avgEntryPrice = totalBought > 0 ? priceSum / totalBought : 0.5;
        const won = winner && teamMatch(betOutcome, winner);

        const meta = await gateway.getMarketMetadata(conditionId);
        const gameDate = meta?.endDate ? new Date(meta.endDate).toISOString().split('T')[0] : undefined;
        const kickoffMinutes = kickoffLookup.get(`${question}::${betOutcome}`) ?? null;

        const pos: AggregatedMarket = {
            question,
            conditionId,
            isMlb,
            closed,
            winner,
            pnl,
            cost,
            betOutcome,
            betShares,
            avgEntryPrice,
            won: !!won,
            pickedHome: false,
            timingBucket: bucketTiming(kickoffMinutes),
            gameDate
        };

        const teams = parseVsTeams(question);
        if (teams && isMlb) {
            const [t1, t2] = teams;
            pos.awayTeam = t1;
            pos.homeTeam = t2;
            pos.matchup = `${t1} @ ${t2}`;
            pos.pickedHome = teamMatch(betOutcome, t2);

            if (gameDate) {
                if (!scheduleCache.has(gameDate)) scheduleCache.set(gameDate, await mlb.getSchedule(gameDate));
                let game = scheduleCache.get(gameDate)!.find(g =>
                    teamMatch(g.awayTeam, t1) && teamMatch(g.homeTeam, t2)
                );
                // Polymarket sometimes lists home team first — try reversed
                if (!game) {
                    game = scheduleCache.get(gameDate)!.find(g =>
                        teamMatch(g.awayTeam, t2) && teamMatch(g.homeTeam, t1)
                    );
                    if (game) {
                        pos.awayTeam = game.awayTeam;
                        pos.homeTeam = game.homeTeam;
                        pos.matchup = `${game.awayTeam} @ ${game.homeTeam}`;
                        pos.pickedHome = teamMatch(betOutcome, game.homeTeam);
                    }
                }

                if (game) {
                    pos.score = game.score;
                    if (game.status === 'Final' && game.score) {
                        const [as, hs] = game.score.split('-').map(Number);
                        pos.gameWinner = as > hs ? game.awayTeam : game.homeTeam;
                    }

                    if (!hydrationCache.has(game.gamePk)) {
                        hydrationCache.set(game.gamePk, await mlb.getHydratedAnalysisData(game));
                    }
                    const hydrated = hydrationCache.get(game.gamePk)!;
                    pos.homePitcher = hydrated.details?.probables?.home;
                    pos.awayPitcher = hydrated.details?.probables?.away;
                    pos.ourPitcher = pos.pickedHome ? pos.homePitcher : pos.awayPitcher;
                    pos.oppPitcher = pos.pickedHome ? pos.awayPitcher : pos.homePitcher;

                    if (game.series) {
                        pos.seriesNote = `Game ${game.series.gameNumber}/${game.series.totalGames} | ${game.series.result || 'tied'}`;
                    }
                    const pc = pos.pickedHome ? hydrated.playoffContext?.home : hydrated.playoffContext?.away;
                    if (pc && pc.motivationBonus !== 0) pos.playoffNote = pc.reason;

                    const analysis = analyzer.analyzeGame(
                        game, hydrated.details, undefined,
                        [...hydrated.homeHot, ...hydrated.awayHot], [], hydrated.playerStats,
                        800, hydrated.rosters, undefined, hydrated.platoonSplits,
                        hydrated.bullpenFatigue, hydrated.lineupHandedness, hydrated.teamForm,
                        game.series, hydrated.seasonSeries, hydrated.playoffContext
                    );
                    pos.modelTarget = analysis.valueTeam;
                    pos.modelConfidence = analysis.overallConfidence;
                }
            }
        }

        markets.push(pos);
    }

    const mlbMarkets = markets.filter(m => m.isMlb);
    const kboMarkets = markets.filter(m => !m.isMlb);

    const verifyMlbPnl = mlbMarkets.reduce((s, m) => s + m.pnl, 0);
    console.log(`📊 AGGREGATED MARKETS: ${mlbMarkets.length} MLB | ${kboMarkets.length} KBO`);
    console.log(`   Summed MLB PnL: $${verifyMlbPnl.toFixed(2)} (Gateway: $${report.mlbProfit.toFixed(2)})`);
    console.log(`   Game context matched: ${mlbMarkets.filter(m => m.modelTarget).length}/${mlbMarkets.length} MLB markets\n`);

    const priceBuckets: Record<string, StatBucket> = {};
    const timingBuckets: Record<string, StatBucket> = {};
    const sideBuckets: Record<string, StatBucket> = {};
    const teamBuckets: Record<string, StatBucket> = {};
    const modelBuckets: Record<string, StatBucket> = {};
    const confBuckets: Record<string, StatBucket> = {};
    const monthBuckets: Record<string, StatBucket> = {};
    const pitcherBuckets: Record<string, StatBucket> = {};
    const seriesBuckets: Record<string, StatBucket> = {};

    for (const p of mlbMarkets) {
        addBucket(priceBuckets, bucketPrice(p.avgEntryPrice), p.won, p.pnl, p.cost);
        addBucket(timingBuckets, p.timingBucket, p.won, p.pnl, p.cost);
        addBucket(sideBuckets, p.pickedHome ? 'Picked HOME' : 'Picked AWAY', p.won, p.pnl, p.cost);
        addBucket(teamBuckets, p.betOutcome, p.won, p.pnl, p.cost);
        if (p.gameDate) addBucket(monthBuckets, p.gameDate.slice(0, 7), p.won, p.pnl, p.cost);

        if (p.modelTarget) {
            const aligned = teamMatch(p.betOutcome, p.modelTarget);
            addBucket(modelBuckets, aligned ? 'WITH model' : 'AGAINST model', p.won, p.pnl, p.cost);
            const band = (p.modelConfidence || 0) >= 80 ? '80%+' : (p.modelConfidence || 0) >= 70 ? '70–79%' : (p.modelConfidence || 0) >= 60 ? '60–69%' : '<60%';
            addBucket(confBuckets, `Model conf ${band}`, p.won, p.pnl, p.cost);
        } else {
            addBucket(modelBuckets, 'No game match', p.won, p.pnl, p.cost);
        }

        const ourElite = p.ourPitcher && p.ourPitcher !== 'TBD / Bullpen';
        const oppWeak = p.oppPitcher && p.oppPitcher !== 'TBD / Bullpen';
        if (ourElite && oppWeak) addBucket(pitcherBuckets, 'Named SP both sides', p.won, p.pnl, p.cost);
        else if (ourElite) addBucket(pitcherBuckets, 'Our SP named', p.won, p.pnl, p.cost);
        else addBucket(pitcherBuckets, 'Bullpen/TBD game', p.won, p.pnl, p.cost);

        if (p.seriesNote?.includes('leads') && p.seriesNote.match(/leads [2-9]/)) {
            const facingSweep = p.seriesNote.includes('Game 3/') || p.seriesNote.includes('Game 4/');
            if (facingSweep && !p.won) addBucket(seriesBuckets, 'Faced sweep (lost)', p.won, p.pnl, p.cost);
            else if (facingSweep && p.won) addBucket(seriesBuckets, 'Faced sweep (won)', p.won, p.pnl, p.cost);
        }
    }

    printBuckets('💰 MLB PnL BY ENTRY PRICE', priceBuckets);
    printBuckets('⏱️  MLB PnL BY TIMING (SQLite kickoff data)', timingBuckets);
    printBuckets('🏠 MLB PnL BY HOME/AWAY', sideBuckets);
    printBuckets('🎯 MLB PnL BY MODEL ALIGNMENT', modelBuckets);
    printBuckets('📈 MLB PnL BY MODEL CONFIDENCE', confBuckets);
    printBuckets('🥎 MLB PnL BY PITCHER CONTEXT', pitcherBuckets);
    printBuckets('📅 MLB PnL BY MONTH', monthBuckets);

    const teams = Object.entries(teamBuckets).sort((a, b) => b[1].pnl - a[1].pnl);
    console.log('\n🏟️  TOP 8 TEAMS BY PnL');
    console.log('─'.repeat(76));
    teams.slice(0, 8).forEach(([t, s]) => console.log(`  ${t.padEnd(26)} ${s.n} mkts | WR ${((s.wins/s.n)*100).toFixed(0)}% | $${s.pnl.toFixed(2)}`));
    console.log('\n🛑 BOTTOM 8 TEAMS BY PnL');
    console.log('─'.repeat(76));
    teams.slice(-8).reverse().forEach(([t, s]) => console.log(`  ${t.padEnd(26)} ${s.n} mkts | WR ${((s.wins/s.n)*100).toFixed(0)}% | $${s.pnl.toFixed(2)}`));

    const wins = [...mlbMarkets].sort((a, b) => b.pnl - a.pnl).slice(0, 6);
    const losses = [...mlbMarkets].sort((a, b) => a.pnl - b.pnl).slice(0, 6);

    console.log('\n🏆 BIGGEST WINS');
    for (const p of wins) {
        console.log(`  +$${p.pnl.toFixed(2)} | ${p.betOutcome} @ ${(p.avgEntryPrice*100).toFixed(0)}¢ | ${p.question} | ${p.score || '?'}`);
    }
    console.log('\n💸 BIGGEST LOSSES');
    for (const p of losses) {
        console.log(`  $${p.pnl.toFixed(2)} | ${p.betOutcome} @ ${(p.avgEntryPrice*100).toFixed(0)}¢ | Model: ${p.modelTarget || 'N/A'} (${p.modelConfidence ?? '?'}%) | ${p.ourPitcher || '?'} vs ${p.oppPitcher || '?'}`);
    }

    // Pattern synthesis
    const fav = mlbMarkets.filter(p => p.avgEntryPrice >= 0.55);
    const dogs = mlbMarkets.filter(p => p.avgEntryPrice <= 0.40);
    const withModel = mlbMarkets.filter(p => p.modelTarget && teamMatch(p.betOutcome, p.modelTarget));
    const againstModel = mlbMarkets.filter(p => p.modelTarget && !teamMatch(p.betOutcome, p.modelTarget));
    const live = mlbMarkets.filter(p => p.timingBucket.includes('Live'));
    const pre6h = mlbMarkets.filter(p => p.timingBucket.includes('6h+'));

    console.log('\n🔍 PATTERNS WE MISSED (Gateway + Context)');
    console.log('─'.repeat(76));
    const line = (label: string, arr: AggregatedMarket[]) => {
        const w = arr.filter(p => p.won).length;
        const pnl = arr.reduce((s, p) => s + p.pnl, 0);
        const staked = arr.reduce((s, p) => s + p.cost, 0);
        console.log(`  ${label.padEnd(36)} ${arr.length} mkts | WR ${arr.length ? ((w/arr.length)*100).toFixed(0) : 0}% | PnL $${pnl.toFixed(2)} | ROI ${staked ? ((pnl/staked)*100).toFixed(0) : 0}%`);
    };
    line('Favorites (≥55¢)', fav);
    line('Underdogs (≤40¢)', dogs);
    line('WITH retro model', withModel);
    line('AGAINST retro model', againstModel);
    line('Live bets', live);
    line('6h+ pre-game', pre6h);

    const angels = mlbMarkets.filter(p => teamMatch(p.betOutcome, 'Angels'));
    const nats = mlbMarkets.filter(p => teamMatch(p.betOutcome, 'Nationals'));
    line('All Angels bets', angels);
    line('All Nationals bets', nats);

    console.log('\n📋 ACTIONABLE FINDINGS (pre-reshuffle)');
    console.log('─'.repeat(76));

    const findings: string[] = [];
    if (dogs.reduce((s,p)=>s+p.pnl,0) > fav.reduce((s,p)=>s+p.pnl,0)) {
        findings.push('Underdog entries outperform favorites on realized Gateway PnL — keep price ceiling on favorites.');
    }
    if (againstModel.length > 0 && againstModel.reduce((s,p)=>s+p.pnl,0) > withModel.reduce((s,p)=>s+p.pnl,0)) {
        findings.push('Discretionary bets AGAINST the model have outperformed aligned bets — tighten execution gate.');
    }
    if (live.length > 0 && live.reduce((s,p)=>s+p.pnl,0) < 0) {
        findings.push('Live entries are net negative — enforce pre-game only execution.');
    }
    const drainTeams = teams.filter(([,s]) => s.pnl < -50 && s.n >= 3).map(([t]) => t);
    if (drainTeams.length) {
        findings.push(`Hard fade list from trade data: ${drainTeams.slice(0, 6).join(', ')}.`);
    }
    const alphaTeams = teams.filter(([,s]) => s.pnl > 30 && s.n >= 3).map(([t]) => t);
    if (alphaTeams.length) {
        findings.push(`Proven trade anchors: ${alphaTeams.slice(0, 6).join(', ')}.`);
    }
    if (mlbMarkets.filter(m => m.modelTarget).length < mlbMarkets.length * 0.5) {
        findings.push(`Only ${mlbMarkets.filter(m => m.modelTarget).length}/${mlbMarkets.length} markets matched game context — improve date/team parsing for post-mortems.`);
    }

    findings.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    console.log('\n══════════════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);