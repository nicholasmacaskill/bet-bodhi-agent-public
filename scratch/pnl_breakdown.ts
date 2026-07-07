import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';
import { PolymarketGateway } from '../src/lib/gateway/PolymarketGateway';

async function main() {
    const poly = new PolymarketApi();
    const gateway = new PolymarketGateway();
    
    console.log("Fetching live on-chain history...");
    const trades = await poly.getTrades();
    console.log(`Loaded ${trades.length} trades.`);

    const report = await gateway.calculatePnL(trades as any);

    console.log("=== DETAILED MARKET BREAKDOWN ===");
    let totalRealized = 0;
    for (const [tokenId, m] of Object.entries(report.markets)) {
        if (m.closed) {
            console.log(`Market: ${m.question}`);
            console.log(`  Winner: "${m.winner}"`);
            console.log(`  Cost Basis: $${m.totalCost.toFixed(2)}`);
            let payout = 0;
            for (const [outcome, size] of Object.entries(m.positions)) {
                if (size > 0.01 && outcome.trim().toLowerCase() === m.winner.trim().toLowerCase()) {
                    payout += size * 1.0;
                }
            }
            const pnl = m.realizedPnL;
            totalRealized += pnl;
            console.log(`  Payout: $${payout.toFixed(2)} | Calculated PnL: $${pnl.toFixed(2)}`);
            console.log(`  Positions:`, JSON.stringify(m.positions));
        } else {
            console.log(`[OPEN] Market: ${m.question}`);
            console.log(`  Cost Basis: $${m.totalCost.toFixed(2)}`);
            console.log(`  Positions:`, JSON.stringify(m.positions));
        }
        console.log("-----------------------------------------");
    }
    console.log(`Calculated Total Realized: $${totalRealized.toFixed(2)}`);
}

main().catch(console.error);
