import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    const poly = new PolymarketApi();
    const trades = await poly.getTrades();
    if (trades.length === 0) {
        console.log("No trades found.");
        return;
    }

    const times = trades.map(t => parseFloat(t.match_time || "0")).filter(t => t > 0);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    console.log(`Fetched ${trades.length} trades.`);
    console.log(`Oldest trade date: ${new Date(minTime * 1000).toLocaleString()}`);
    console.log(`Newest trade date: ${new Date(maxTime * 1000).toLocaleString()}`);

    // Count trades in last 7 days and 8-14 days
    const now = Date.now() / 1000;
    const week1 = trades.filter(t => {
        const mt = parseFloat(t.match_time || "0");
        return mt >= now - 14 * 86400 && mt < now - 7 * 86400;
    }).length;
    const week2 = trades.filter(t => {
        const mt = parseFloat(t.match_time || "0");
        return mt >= now - 7 * 86400;
    }).length;

    console.log(`Trades in last 7 days: ${week2}`);
    console.log(`Trades in 8-14 days ago: ${week1}`);
}

main().catch(console.error);
