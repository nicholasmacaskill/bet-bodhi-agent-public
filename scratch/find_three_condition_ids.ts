import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    const poly = new PolymarketApi();
    const trades = await poly.getTrades();
    console.log(`Total trades: ${trades.length}`);

    // We will search for trades that the gateway resolved as:
    // "Athletics vs. Los Angeles Dodgers" (or Dodgers vs Athletics)
    // "Chicago White Sox vs. San Francisco Giants"
    // "KBO: NC Dinos vs. SSG Landers"
    // We can fetch details using condition_ids to verify.
    const uniqueConds = Array.from(new Set(trades.map(t => t.market))).filter(Boolean);
    console.log(`Searching through ${uniqueConds.length} unique condition IDs...`);

    for (const cid of uniqueConds) {
        const url = `https://gamma-api.polymarket.com/markets?condition_ids=${cid}&closed=true`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.length > 0) {
            const m = data[0];
            const q = m.question || m.title || "";
            const lowerQ = q.toLowerCase();
            if (
                (lowerQ.includes("athletics") && lowerQ.includes("dodgers")) ||
                (lowerQ.includes("white sox") && lowerQ.includes("giants")) ||
                (lowerQ.includes("dinos") && lowerQ.includes("landers"))
            ) {
                console.log(`MATCH FOUND:`);
                console.log(`  Question: ${q}`);
                console.log(`  Condition ID: ${cid}`);
                console.log(`  Winning Outcome Index: ${m.winningOutcomeIndex}`);
                console.log(`  Outcome Prices: ${m.outcomePrices}`);
                console.log(`  Outcomes: ${m.outcomes}`);
                console.log(`  Closed: ${m.closed}`);
            }
        }
    }
}

main().catch(console.error);
