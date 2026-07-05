import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';
import { PolymarketGateway } from '../src/lib/gateway/PolymarketGateway';
import * as fs from 'fs';
import * as path from 'path';

async function calculateLivePnL() {
    console.log("====================================================");
    console.log("   BODHI ON-CHAIN POLYMARKET PNL CALCULATOR         ");
    console.log("====================================================");

    const poly = new PolymarketApi();
    const gateway = new PolymarketGateway();
    
    const usdcBalance = await poly.getUSDCBalance();
    console.log(`Live USDC Balance: $${usdcBalance.toFixed(2)}`);
    console.log("Fetching live on-chain history (this may take a minute)...");
    
    const trades = await poly.getTrades();
    console.log(`Found ${trades.length} historical trades.`);

    if (trades.length === 0) {
        console.log("No trades found. Exiting.");
        return;
    }

    console.log("Processing trades and calculating PnL via Gateway...");
    const report = await gateway.calculatePnL(trades as any);

    const dataPath = path.join(process.cwd(), 'data', 'latest_pnl.json');
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(report, null, 2));

    console.log("\n====================================================");
    console.log("   DETAILED AUDIT: RESOLVED BASEBALL POSITIONS     ");
    console.log("====================================================");
    
    let resolvedCount = 0;
    for (const [tokenId, m] of Object.entries(report.markets)) {
        if (m.closed && m.isBaseball) {
            resolvedCount++;
            console.log(`\nMatchup: ${m.question}`);
            console.log(`  Winner Resolved On-Chain: "${m.winner}"`);
            
            // Print the positions details
            for (const [outcome, size] of Object.entries(m.positions)) {
                if (Math.abs(size) > 0.01) {
                    console.log(`  Position: ${size.toFixed(2)} shares of "${outcome}"`);
                }
            }
            console.log(`  Cost Basis: $${m.totalCost.toFixed(2)} | Realized PnL: $${m.realizedPnL.toFixed(2)}`);
            console.log(`  ----------------------------------------------------`);
        }
    }
    
    if (resolvedCount === 0) {
        console.log("  No resolved baseball positions found.");
    }

    console.log(`\n📊 ON-CHAIN REALIZED PNL SUMMARY`);
    console.log(`   Realized KBO Profit:     $${report.kboProfit.toFixed(2)}`);
    console.log(`   Realized MLB Profit:     $${report.mlbProfit.toFixed(2)}`);
    console.log(`   Other Markets Profit:    $${report.otherProfit.toFixed(2)}`);
    console.log(`   ------------------------------------`);
    console.log(`   TOTAL REALIZED PROFIT:   $${report.totalRealizedProfit.toFixed(2)}`);
    console.log(`\nNote: You currently have ~$${report.totalOpenValue.toFixed(2)} in open positions.`);
    console.log("====================================================");
}

calculateLivePnL().catch(console.error);
