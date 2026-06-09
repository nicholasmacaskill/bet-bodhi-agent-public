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

async function calculateBaseballPnL() {
    const poly = new PolymarketApi();
    console.log("Fetching live on-chain history...");
    const trades = await poly.getTrades();
    
    const marketMap = new Map<string, {
        question: string,
        isBaseball: boolean,
        closed: boolean,
        winner: string,
        positions: Map<string, number>,
        totalCost: number
    }>();

    const baseballKeywords = ['KBO:', 'MLB', 'Dodgers', 'Yankees', 'Red Sox', 'Cubs', 'Braves', 'Phillies', 'Astros'];

    for (const t of trades) {
        const tokenId = t.asset_id;
        if (!tokenId) continue;

        if (!marketMap.has(tokenId)) {
            const details = await fetchMarketByTokenId(tokenId);
            if (!details) continue;

            const question = details.question || details.title || "Unknown Market";
            const isBaseball = baseballKeywords.some(kw => question.includes(kw));
            
            marketMap.set(tokenId, {
                question,
                isBaseball,
                closed: details.closed || false,
                winner: details.winningOutcomeIndex !== undefined ? details.outcomes[parseInt(details.winningOutcomeIndex)] : "",
                positions: new Map<string, number>(),
                totalCost: 0
            });
        }

        const m = marketMap.get(tokenId)!;
        if (!m.isBaseball) continue;

        const outcome = t.outcome;
        const size = parseFloat(t.size);
        const price = parseFloat(t.price);
        const currentSize = m.positions.get(outcome) || 0;

        // In Polymarket CLOB, if we BUY, we pay (size * price). 
        // If we SELL, we receive (size * price).
        if (t.side === 'BUY') {
            m.positions.set(outcome, currentSize + size);
            m.totalCost += size * price; // Cost goes up
        } else {
            m.positions.set(outcome, currentSize - size);
            m.totalCost -= size * price; // Cost goes down (returns)
        }
    }

    let kboProfit = 0;
    let mlbProfit = 0;
    let openValue = 0;

    for (const [tid, m] of marketMap.entries()) {
        if (!m.isBaseball) continue;
        
        let pnl = 0;

        if (m.closed) {
            // If closed, any remaining shares in the winning outcome pay out $1.00 each
            let payout = 0;
            for (const [outcome, size] of m.positions.entries()) {
                if (size > 0.01 && outcome === m.winner) {
                    payout += size * 1.0;
                }
            }
            pnl = payout - m.totalCost;
        } else {
            // For open markets, totalCost is our net spend. We shouldn't book it as a realized loss yet.
            // But we can count it as "locked capital" or just exclude from realized profit.
            // Let's just track realized profit.
            // If we sold out of our position completely while open, then our realized PnL is just the negative of our totalCost.
            // e.g. Spent 10, Sold for 15. totalCost = 10 - 15 = -5. So PnL is +5.
            let remainingShares = 0;
            for (const size of m.positions.values()) remainingShares += size;
            
            if (remainingShares < 0.01) {
                // Fully closed position in an open market
                pnl = -m.totalCost; 
            } else {
                openValue += m.totalCost;
                continue; // Skip open positions for REALIZED profit
            }
        }

        if (m.question.includes('KBO:')) {
            kboProfit += pnl;
        } else {
            mlbProfit += pnl;
        }
    }

    console.log(`\n--- ON-CHAIN REALIZED BASEBALL PNL ---`);
    console.log(`Realized KBO Profit: $${kboProfit.toFixed(2)}`);
    console.log(`Realized MLB Profit: $${mlbProfit.toFixed(2)}`);
    console.log(`------------------------------------`);
    console.log(`TOTAL REALIZED PROFIT: $${(kboProfit + mlbProfit).toFixed(2)}`);
    console.log(`\nNote: You currently have $${openValue.toFixed(2)} locked in open baseball markets.`);
}

calculateBaseballPnL().catch(console.error);
