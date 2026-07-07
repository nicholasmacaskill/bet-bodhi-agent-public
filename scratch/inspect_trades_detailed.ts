import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    const poly = new PolymarketApi();
    const trades = await poly.getTrades();
    console.log(`Total trades: ${trades.length}`);
    
    // Find trades matching "Athletics vs. Los Angeles Dodgers" or similar
    // Let's first query the metadata of all unique conditionIds
    const uniqueConds = Array.from(new Set(trades.map(t => t.market))).filter(Boolean);
    console.log(`Unique condition IDs: ${uniqueConds.length}`);

    // Query Gamma for each unique conditionId using plural condition_ids
    for (const cid of uniqueConds) {
        const url = `https://gamma-api.polymarket.com/markets?condition_ids=${cid}&closed=true`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.length > 0) {
            const m = data[0];
            const q = m.question || m.title || "";
            if (q.includes("Athletics") || q.includes("Dodgers")) {
                console.log(`Found Match!`);
                console.log(`Condition ID: ${cid}`);
                console.log(`Question: ${q}`);
                console.log(`Closed: ${m.closed}`);
                console.log(`Winning Outcome Index: ${m.winningOutcomeIndex}`);
                console.log(`Outcome Prices: ${m.outcomePrices}`);
                console.log(`Outcomes: ${m.outcomes}`);
                console.log(`----------------------------------------`);
            }
        }
    }
}

main().catch(console.error);
