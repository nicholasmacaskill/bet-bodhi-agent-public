
import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function debugTrades() {
    const poly = new PolymarketApi();
    const trades = await poly.getTrades();
    if (trades.length > 0) {
        console.log("FULL SAMPLE TRADE:", JSON.stringify(trades[0], null, 2));
    } else {
        console.log("No trades found.");
    }
}

debugTrades().catch(console.error);
