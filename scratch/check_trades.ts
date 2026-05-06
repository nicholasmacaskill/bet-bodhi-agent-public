
import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function checkLatestTrades() {
    const poly = new PolymarketApi();
    const proxy = process.env.POLY_PROXY_ADDRESS;
    console.log(`Checking trades for Proxy: ${proxy}`);
    
    const trades = await poly.getTrades();
    console.log(`Total trades found: ${trades.length}`);
    
    // Sort by match_time descending
    const sortedTrades = trades.sort((a: any, b: any) => {
        const ta = new Date(a.match_time).getTime();
        const tb = new Date(b.match_time).getTime();
        return tb - ta;
    });
    
    console.log("\n--- Latest 10 Trades ---");
    for (let i = 0; i < Math.min(10, sortedTrades.length); i++) {
        const t = sortedTrades[i];
        const date = new Date(t.match_time).toLocaleString();
        
        const marketId = t.market;
        const details = await poly.getMarketDetails(marketId);
        
        // If question is not in details[0], maybe it's under a different field
        const name = details?.question || details?.title || "Unknown Market";
        
        console.log(`[${date}] ${t.side} ${t.size} @ ${t.price} | Market: ${name} (${marketId.substring(0,8)}...)`);
        
        // Debug: if all names are the same, let's see the details object
        if (i === 0) {
            // console.log("Sample Details:", JSON.stringify(details, null, 2));
        }
    }
}

checkLatestTrades().catch(console.error);
