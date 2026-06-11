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
    console.log("====================================================");
    console.log("   BODHI ON-CHAIN ACTIVE POLYMARKET POSITIONS        ");
    console.log("====================================================");

    const poly = new PolymarketApi();
    
    console.log("Fetching live on-chain history...");
    const trades = await poly.getTrades();
    console.log(`Found ${trades.length} historical trades.`);

    const marketMap = new Map<string, {
        conditionId: string,
        question: string,
        closed: boolean,
        winner: string,
        outcomes: string[],
        positions: Map<string, number>,
        totalCost: number,
        totalSharesBought: number
    }>();

    // Map condition IDs to track positions
    for (const t of trades) {
        const conditionId = t.market;
        const tokenId = t.asset_id;
        if (!tokenId || !conditionId) continue;

        if (!marketMap.has(conditionId)) {
            const details = await fetchMarketByConditionId(conditionId);
            if (!details) continue;

            const question = details.question || details.title || "Unknown Market";
            
            marketMap.set(conditionId, {
                conditionId,
                question,
                closed: details.closed || false,
                winner: details.winningOutcomeIndex !== undefined ? details.outcomes[parseInt(details.winningOutcomeIndex)] : "",
                outcomes: details.outcomes || [],
                positions: new Map<string, number>(),
                totalCost: 0,
                totalSharesBought: 0
            });
        }

        const m = marketMap.get(conditionId)!;
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
            m.totalSharesBought += size;
        } else {
            m.positions.set(outcome, currentSize - size);
            m.totalCost -= size * price;
            m.totalSharesBought -= size;
        }
    }

    console.log("\n🔎 Analyzing active open positions...");
    let openPositionsCount = 0;

    for (const [condId, m] of marketMap.entries()) {
        if (m.closed) continue; // Skip closed markets

        // Calculate remaining shares
        let totalRemainingShares = 0;
        const activeOutcomes: { outcome: string, shares: number }[] = [];
        
        for (const [outcome, size] of m.positions.entries()) {
            if (size > 0.05) {
                totalRemainingShares += size;
                activeOutcomes.push({ outcome, shares: size });
            }
        }

        if (totalRemainingShares < 0.1) {
            continue; // No significant open position
        }

        openPositionsCount++;
        
        // Fetch current market prices
        const currentDetails = await fetchMarketByConditionId(condId);
        const currentPrices = currentDetails?.outcomePrices || [];
        const outcomes = m.outcomes;
        
        console.log(`\n📌 Market: "${m.question}"`);
        console.log(`   Condition ID: ${condId}`);
        
        let estimatedCurrentValue = 0;
        
        for (const ao of activeOutcomes) {
            const outcomeIdx = outcomes.indexOf(ao.outcome);
            const currentPrice = outcomeIdx !== -1 && currentPrices[outcomeIdx] ? parseFloat(currentPrices[outcomeIdx]) : 0;
            const avgPricePaid = m.totalSharesBought > 0 ? (m.totalCost / m.totalSharesBought) : 0;
            const value = ao.shares * currentPrice;
            estimatedCurrentValue += value;
            
            const pnl = value - (ao.shares * avgPricePaid);
            
            console.log(`   └ Outcome: [${ao.outcome}]`);
            console.log(`     Shares Held:  ${ao.shares.toFixed(2)}`);
            console.log(`     Avg Buy Price: $${avgPricePaid.toFixed(4)} (Total Cost: $${(ao.shares * avgPricePaid).toFixed(2)})`);
            console.log(`     Current Price: $${currentPrice.toFixed(4)} (Current Value: $${value.toFixed(2)})`);
            console.log(`     Floating PnL:  $${pnl.toFixed(2)} (${pnl >= 0 ? '+' : ''}${((pnl / (ao.shares * avgPricePaid)) * 100).toFixed(1)}%)`);
        }
    }
    
    if (openPositionsCount === 0) {
        console.log("No active open positions found.");
    }
    console.log("\n====================================================");
}

main().catch(console.error);
