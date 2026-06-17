import * as dotenv from 'dotenv';
import * as path from 'path';

// Explicitly load the bet-bodhi .env file
dotenv.config({ path: '/Users/nicholasmacaskill/Downloads/bet-bodhi/.env' });

import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    console.log("🚀 STARTING DRY RUN EXECUTION TEST...");
    
    // Programmatically force DRY_RUN to true for safety
    process.env.DRY_RUN = 'true';
    
    const api = new PolymarketApi();
    
    const conditionId = "0xb4528250bfbecacd1da31cd9dac28d32077c66cc921a8598da6b8e4265144507"; // Detroit Tigers vs. Cleveland Guardians
    const outcomeIndex = 1; // Cleveland Guardians (price ~0.475)
    const amount = 1.00; // $1.00 stake
    const price = 0.475;
    
    console.log(`\nMarket Target: Detroit Tigers vs. Cleveland Guardians`);
    console.log(`Condition ID:  ${conditionId}`);
    console.log(`Outcome Index: ${outcomeIndex} (Cleveland Guardians)`);
    console.log(`Test Stake:    $${amount.toFixed(2)}`);
    console.log(`Base Price:    $${price.toFixed(3)}\n`);
    
    try {
        const result = await api.placeOrder(conditionId, outcomeIndex, amount, price, 0.05);
        console.log(`\n🎉 DRY RUN SUCCESS!`);
        console.log("Result Details:", result);
    } catch (e: any) {
        console.error(`\n❌ Dry Run Failed: ${e.message}`);
    }
}

main().catch(console.error);
