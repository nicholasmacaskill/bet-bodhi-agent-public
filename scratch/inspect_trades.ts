import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    const poly = new PolymarketApi();
    const trades = await poly.getTrades();
    console.log(`Total trades fetched: ${trades.length}`);
    if (trades.length > 0) {
        console.log("Sample Trade:", JSON.stringify(trades[0], null, 2));
        console.log("Unique asset_ids/token_ids from trades:");
        const tokens = new Set(trades.map(t => t.asset_id || t.tokenId));
        console.log(Array.from(tokens).slice(0, 10));
    }
}

main().catch(console.error);
