import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    console.log("Checking USDC balance on Polymarket...");
    const api = new PolymarketApi();
    try {
        const balance = await api.getUSDCBalance();
        console.log(`\n💳 Wallet/Proxy USDC Balance: $${balance.toFixed(2)}`);
    } catch (e: any) {
        console.error("Error checking balance:", e.message);
    }
}

main().catch(console.error);
