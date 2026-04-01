import { PolymarketApi } from './src/lib/polymarket-api';
import 'dotenv/config';

async function debugPick() {
    const api = new PolymarketApi();
    console.log("--- POLYMARKET DEBUG ---");

    try {
        console.log("\n1. Checking Open Orders...");
        const openOrders = await api.getOpenOrders();
        if (openOrders.length > 0) {
            console.log(`Found ${openOrders.length} open orders:`);
            openOrders.forEach((o: any, i: number) => {
                console.log(`${i+1}: ID: ${o.orderID} | Token: ${o.tokenID} | Price: ${o.price} | Size: ${o.size} | Side: ${o.side}`);
            });
        } else {
            console.log("No open orders found.");
        }

        console.log("\n2. Checking Recent Trades (Detailed)...");
        const trades = await api.getTrades();
        if (trades.length > 0) {
            console.log(`Found ${trades.length} trades.`);
            // Sort by time descending if possible, or just take first 5
            trades.slice(0, 10).forEach((t: any, i: number) => {
                // Try to handle different time formats
                let dateStr = "Unknown";
                if (t.time) {
                    const timeNum = parseInt(t.time);
                    if (timeNum > 2000000000) { // Milliseconds
                        dateStr = new Date(timeNum).toLocaleString();
                    } else { // Seconds
                        dateStr = new Date(timeNum * 1000).toLocaleString();
                    }
                }
                console.log(`${i+1}: [${dateStr}] ${t.side} | Price: ${t.price} | Size: ${t.size} | ID: ${t.id || t.transactionHash}`);
            });
        }

    } catch (e: any) {
        console.error("Debug failed:", e.message);
    }
}

debugPick();
