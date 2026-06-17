import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    const poly = new PolymarketApi();
    const trades = await poly.getTrades();
    if (trades.length > 0) {
        console.log("Keys of a trade object:", Object.keys(trades[0]));
        console.log("Sample trade object:", JSON.stringify(trades[0], null, 2));
    } else {
        console.log("No trades found.");
    }
}

main().catch(console.error);
