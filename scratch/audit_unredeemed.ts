import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function fetchMarketByConditionId(conditionId: string) {
    try {
        const url = `https://gamma-api.polymarket.com/markets?condition_id=${conditionId}`;
        const res = await fetch(url);
        const data = await res.json();
        return data && data.length > 0 ? data[0] : null;
    } catch (e) {
        return null;
    }
}

async function main() {
    console.log("🔍 Auditing open/unredeemed positions for unclaimed winnings...");
    const poly = new PolymarketApi();
    const trades = await poly.getTrades();

    const marketMap = new Map<string, {
        conditionId: string;
        question: string;
        closed: boolean;
        winner: string;
        outcomes: string[];
        positions: Map<string, number>;
        totalCost: number;
    }>();

    for (const t of trades) {
        const conditionId = t.market;
        const tokenId = t.asset_id;
        if (!tokenId || !conditionId) continue;

        if (!marketMap.has(tokenId)) {
            const details = await fetchMarketByConditionId(conditionId);
            if (!details) continue;

            marketMap.set(tokenId, {
                conditionId,
                question: details.question || details.title || "Unknown Market",
                closed: details.closed || false,
                winner: details.winningOutcomeIndex !== undefined ? details.outcomes[parseInt(details.winningOutcomeIndex)] : "",
                outcomes: details.outcomes || [],
                positions: new Map<string, number>(),
                totalCost: 0
            });
        }

        const m = marketMap.get(tokenId)!;
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

    console.log("\n=== UNRESOLVED / UNREDEEMED POSITIONS DETAIL ===");
    let count = 0;
    
    for (const [tid, m] of marketMap.entries()) {
        let remainingShares = 0;
        let heldOutcome = "";
        for (const [outcome, size] of m.positions.entries()) {
            if (size > 0.1) {
                remainingShares = size;
                heldOutcome = outcome;
            }
        }

        if (remainingShares > 0.1) {
            count++;
            console.log(`\n📦 Position #${count}`);
            console.log(`   Market:   ${m.question}`);
            console.log(`   Condition ID: ${m.conditionId}`);
            console.log(`   Status:   ${m.closed ? "🔴 RESOLVED (CLOSED)" : "🟢 ACTIVE (OPEN)"}`);
            console.log(`   Held:     ${remainingShares.toFixed(2)} shares of "${heldOutcome}"`);
            console.log(`   Cost Basis: $${m.totalCost.toFixed(2)}`);
            
            if (m.closed) {
                const isWinner = heldOutcome === m.winner;
                console.log(`   Winner:   "${m.winner}"`);
                console.log(`   Result:   ${isWinner ? "🎉 WINNING POSITION (Unredeemed!)" : "❌ LOST POSITION"}`);
                if (isWinner) {
                    console.log(`   💵 Unclaimed Winnings Value: $${remainingShares.toFixed(2)} USDC`);
                }
            } else {
                console.log(`   Winner:   TBD`);
            }
        }
    }
}

main().catch(console.error);
