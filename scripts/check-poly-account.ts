import * as dotenv from 'dotenv';
dotenv.config({ path: '/Users/nicholasmacaskill/Downloads/bet-bodhi/.env' });

import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    const api = new PolymarketApi();
    console.log("Querying Polymarket CLOB collateral balance...");
    
    try {
        const balance = await api.getUSDCBalance();
        console.log(`\n💰 Reported USDC Balance: $${balance.toFixed(2)}`);
        
        // Fetch raw trade history or active orders to see if the account is active
        const trades = await api.getTrades();
        console.log(`\n📈 Trade History: Found ${trades.length} historical trades.`);
        if (trades.length > 0) {
            console.log("Last 3 trades:");
            trades.slice(0, 3).forEach(t => {
                console.log(`- ${t.side} ${t.size} shares at $${t.price} (ID: ${t.id})`);
            });
        }
    } catch (e: any) {
        console.error("Error fetching account info:", e.message);
    }
}

main().catch(console.error);
