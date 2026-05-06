
import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function fetchMarketByTokenId(tokenId: string) {
    try {
        const url = `https://gamma-api.polymarket.com/markets?clob_token_ids=${tokenId}`;
        const res = await fetch(url);
        const data = await res.json();
        return data && data.length > 0 ? data[0] : null;
    } catch (e) {
        return null;
    }
}

async function calculateRealTimeWinRate() {
    const poly = new PolymarketApi();
    console.log("Fetching latest on-chain trades...");
    const trades = await poly.getTrades();
    console.log(`Analyzing ${trades.length} trades...`);

    const marketMap = new Map<string, {
        question: string,
        isSports: boolean,
        closed: boolean,
        winner: string,
        lastMatch: number,
        positions: Map<string, number>,
        totalCost: number
    }>();

    const sportsKeywords = [' vs ', 'KBO:', 'MLB:', 'NHL:', 'NBA:', 'NFL:', 'Premier League', 'UFC', 'Tennis'];

    for (const t of trades) {
        const tokenId = t.asset_id;
        if (!tokenId) continue;

        // Use asset_id to find the market
        if (!marketMap.has(tokenId)) {
            const details = await fetchMarketByTokenId(tokenId);
            if (!details) continue;

            const question = details.question || details.title || "Unknown Market";
            const isSports = sportsKeywords.some(kw => question.includes(kw)) || details.category === 'Sports';
            
            // Map the token ID to its market resolution info
            // We use the market's first conditionId as the key for grouping related tokens if needed,
            // but here tokenId is enough to identify the specific outcome side.
            
            marketMap.set(tokenId, {
                question,
                isSports,
                closed: details.closed || false,
                winner: details.winningOutcomeIndex !== undefined ? details.outcomes[parseInt(details.winningOutcomeIndex)] : "",
                lastMatch: 0,
                positions: new Map<string, number>(),
                totalCost: 0
            });
        }

        const m = marketMap.get(tokenId)!;
        if (!m.isSports) continue;

        const ts = Number(t.match_time);
        m.lastMatch = Math.max(m.lastMatch, ts);

        const outcome = t.outcome;
        const size = parseFloat(t.size);
        const price = parseFloat(t.price);
        const currentSize = m.positions.get(outcome) || 0;

        if (t.side === 'BUY') {
            m.positions.set(outcome, currentSize + size);
            m.totalCost += size * price;
        } else {
            m.positions.set(outcome, currentSize - size);
            m.totalCost -= size * price;
        }
    }

    let stats = {
        overall: { wins: 0, losses: 0, total: 0 },
        recent: { wins: 0, losses: 0, total: 0 },
        kbo: { wins: 0, total: 0 },
        mlb: { wins: 0, total: 0 },
        open: 0
    };

    const now = Date.now() / 1000;
    const oneWeek = 7 * 24 * 60 * 60;
    const oneDay = 24 * 60 * 60;

    console.log("\n--- RESOLVED SPORTS MARKETS (ON-CHAIN) ---");

    for (const [tid, m] of marketMap.entries()) {
        if (!m.isSports) continue;
        if (!m.closed) {
            stats.open++;
            continue;
        }

        let isWin = false;
        let heldWinner = false;
        for (const [outcome, size] of m.positions.entries()) {
            if (size > 0.01 && outcome === m.winner) {
                heldWinner = true;
                isWin = true;
            }
        }

        if (!heldWinner && Array.from(m.positions.values()).every(s => Math.abs(s) < 0.01)) {
            if (m.totalCost < 0) isWin = true; 
        }

        stats.overall.total++;
        if (isWin) stats.overall.wins++;
        else stats.overall.losses++;

        if ((now - m.lastMatch) < oneWeek) {
            stats.recent.total++;
            if (isWin) stats.recent.wins++;
            else stats.recent.losses++;
        }

        if (m.question.includes('KBO:')) {
            stats.kbo.total++;
            if (isWin) stats.kbo.wins++;
        }
        if (m.question.includes('MLB') || m.question.includes('Dodgers') || m.question.includes('Yankees')) {
            stats.mlb.total++;
            if (isWin) stats.mlb.wins++;
        }

        if ((now - m.lastMatch) < oneDay) {
            console.log(`✅ [Last 24h] ${isWin ? 'WIN ' : 'LOSS'} | ${m.question} | Winner: ${m.winner}`);
        }
    }

    const winRate = (stats.overall.wins / stats.overall.total) * 100;
    const recentRate = (stats.recent.wins / stats.recent.total) * 100;

    console.log(`\n--- FINAL ON-CHAIN SPORTS SUMMARY ---`);
    console.log(`Overall Win Rate: ${winRate.toFixed(2)}% (${stats.overall.wins}/${stats.overall.total})`);
    console.log(`Last 7 Days Win Rate: ${recentRate.toFixed(2)}% (${stats.recent.wins}/${stats.recent.total})`);
    console.log(`Open Sports Bets: ${stats.open}`);
    
    if (stats.kbo.total > 0) {
        console.log(`KBO Win Rate: ${((stats.kbo.wins/stats.kbo.total)*100).toFixed(2)}% (${stats.kbo.wins}/${stats.kbo.total})`);
    }
    if (stats.mlb.total > 0) {
        console.log(`MLB Win Rate: ${((stats.mlb.wins/stats.mlb.total)*100).toFixed(2)}% (${stats.mlb.wins}/${stats.mlb.total})`);
    }
}

calculateRealTimeWinRate().catch(console.error);
