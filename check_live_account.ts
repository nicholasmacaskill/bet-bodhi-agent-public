import { PolymarketApi } from './src/lib/polymarket-api';
import 'dotenv/config';

async function checkLiveTrades() {
    const api = new PolymarketApi();
    console.log("Connecting to live Polymarket account via API...");
    
    try {
        const trades = await api.getTrades();
        if (!trades || trades.length === 0) {
            console.log("No trades found via API. History may be archived or the account is empty.");
            return;
        }

        console.log(`\n✅ Access Confirmed. Found ${trades.length} recent trades via API.`);
        console.log("--- Most Recent 10 Trades ---");
        trades.slice(0, 10).forEach((t: any, i: number) => {
            const date = new Date(parseInt(t.time) * 1000).toLocaleString();
            console.log(`${(i+1).toString().padStart(2)}: [${date}] ${t.side.padEnd(4)} | Price: $${t.price.toString().padEnd(6)} | Size: ${t.size}`);
        });

    } catch (e: any) {
        console.error("❌ API Connection Failed:", e.message);
    }
}

checkLiveTrades();
