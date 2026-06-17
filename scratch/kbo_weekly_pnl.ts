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

async function calculateWeeklyKBOPnL() {
    const poly = new PolymarketApi();
    console.log("Fetching live on-chain trades...");
    const trades = await poly.getTrades();
    console.log(`Found ${trades.length} historical trades.`);

    // Get unique asset IDs
    const assetIds = new Set<string>();
    for (const t of trades) {
        if (t.asset_id) assetIds.add(t.asset_id);
    }

    console.log(`Resolving market details for ${assetIds.size} unique asset IDs...`);
    const marketDetailsMap = new Map<string, any>();
    let count = 0;
    
    // Fetch market details for each asset ID
    for (const aid of assetIds) {
        const details = await fetchMarketByTokenId(aid);
        if (details) {
            marketDetailsMap.set(aid, details);
        }
        count++;
        if (count % 20 === 0) {
            console.log(`  Resolved ${count}/${assetIds.size} asset IDs...`);
        }
    }

    const kboTeams = [
        'LG Twins', 'KT Wiz', 'SSG Landers', 'NC Dinos', 'Doosan Bears', 'KIA Tigers', 'Lotte Giants', 
        'Samsung Lions', 'Hanwha Eagles', 'Kiwoom Heroes', 'Samsung', 'Hanwha', 'Kiwoom', 'Doosan', 'Lotte', 'Tigers', 'Twins', 'Wiz'
    ];

    interface MarketPnL {
        question: string;
        closed: boolean;
        winner: string;
        totalCost: number;
        positions: Map<string, number>;
        lastTradeTime: number;
        endDateTime: number;
    }

    const marketPnLMap = new Map<string, MarketPnL>();

    for (const t of trades) {
        const tokenId = t.asset_id;
        if (!tokenId) continue;

        const details = marketDetailsMap.get(tokenId);
        if (!details) continue;

        const question = details.question || details.title || "Unknown Market";
        
        let outcomes: string[] = [];
        if (details.outcomes) {
            if (typeof details.outcomes === 'string') {
                try { outcomes = JSON.parse(details.outcomes); } catch {}
            } else if (Array.isArray(details.outcomes)) {
                outcomes = details.outcomes;
            }
        }

        const isKbo = kboTeams.some(team => 
            question.toLowerCase().includes(team.toLowerCase()) || 
            outcomes.some((o: string) => o.toLowerCase().includes(team.toLowerCase()))
        );

        const isMlb = question.includes("MLB") || question.includes("Baseball") || outcomes.some((o: string) => ['Yankees', 'Dodgers', 'Red Sox', 'Cubs', 'Braves', 'Phillies', 'Astros', 'Orioles', 'Padres', 'Nationals', 'Rockies', 'Rays', 'Giants', 'Royals', 'Twins', 'Cardinals', 'Mets', 'White Sox', 'Marlins', 'Guardians', 'Rangers', 'Brewers', 'Blue Jays', 'Angels', 'Diamondbacks', 'Mariners', 'Tigers', 'Athletics', 'Pirates', 'Reds'].some(mlbTeam => o.toLowerCase().includes(mlbTeam.toLowerCase())));
        
        if (!isKbo || (isMlb && !question.toLowerCase().includes("kbo"))) {
            continue;
        }

        const conditionId = details.conditionId;
        if (!conditionId) continue;

        if (!marketPnLMap.has(conditionId)) {
            let endDateTime = 0;
            if (details.endDate) {
                endDateTime = Math.floor(new Date(details.endDate).getTime() / 1000);
            }
            marketPnLMap.set(conditionId, {
                question,
                closed: details.closed || false,
                winner: details.winningOutcomeIndex !== undefined && outcomes ? outcomes[parseInt(details.winningOutcomeIndex)] : "",
                totalCost: 0,
                positions: new Map<string, number>(),
                lastTradeTime: 0,
                endDateTime
            });
        }

        const m = marketPnLMap.get(conditionId)!;
        const matchTime = parseFloat(t.match_time || "0");
        if (matchTime > m.lastTradeTime) {
            m.lastTradeTime = matchTime;
        }

        const outcome = t.outcome;
        const size = parseFloat(t.size);
        const price = parseFloat(t.price);
        const currentSize = m.positions.get(outcome) || 0;

        let userAction = t.side;
        if (t.trader_side === 'MAKER') {
            userAction = t.side === 'BUY' ? 'SELL' : 'BUY';
        }

        if (userAction === 'BUY') {
            m.positions.set(outcome, currentSize + size);
            m.totalCost += size * price; 
        } else {
            m.positions.set(outcome, currentSize - size);
            m.totalCost -= size * price; 
        }
    }

    console.log("\n========================================================");
    console.log("               ALL FOUND KBO MARKETS                    ");
    console.log("========================================================");

    for (const [cid, m] of marketPnLMap.entries()) {
        let pnl = 0;
        let payout = 0;
        let isRealized = false;

        if (m.closed) {
            for (const [outcome, size] of m.positions.entries()) {
                if (size > 0.01 && outcome === m.winner) {
                    payout += size * 1.0;
                }
            }
            pnl = payout - m.totalCost;
            isRealized = true;
        } else {
            let remainingShares = 0;
            for (const size of m.positions.values()) remainingShares += size;
            if (remainingShares < 0.01) {
                pnl = -m.totalCost;
                isRealized = true;
            }
        }

        console.log(`- Market: "${m.question}"`);
        console.log(`  Closed: ${m.closed} | Realized: ${isRealized}`);
        console.log(`  End Date: ${m.endDateTime > 0 ? new Date(m.endDateTime * 1000).toLocaleString() : 'N/A'}`);
        console.log(`  Last Trade Time: ${m.lastTradeTime > 0 ? new Date(m.lastTradeTime * 1000).toLocaleString() : 'N/A'}`);
        console.log(`  Total Cost: $${m.totalCost.toFixed(2)} | Payout: $${payout.toFixed(2)} | PnL: $${pnl.toFixed(2)}`);
    }
}

calculateWeeklyKBOPnL().catch(console.error);
