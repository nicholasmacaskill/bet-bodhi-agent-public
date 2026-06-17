import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    const api = new PolymarketApi();
    console.log("Searching for live sports markets on Polymarket...");
    const markets = await api.getActiveSportsMarkets("vs.");
    
    if (markets.length === 0) {
        console.log("No active markets found.");
        return;
    }
    
    console.log("\nTop 5 Active Markets:");
    markets.slice(0, 5).forEach((m, i) => {
        console.log(`\n[${i + 1}] Question: ${m.question}`);
        console.log(`    Condition ID: ${m.conditionId}`);
        console.log(`    Outcomes: ${m.outcomes.join(' / ')}`);
        console.log(`    Prices: ${m.outcomePrices.join(' / ')}`);
    });
}

main().catch(console.error);
