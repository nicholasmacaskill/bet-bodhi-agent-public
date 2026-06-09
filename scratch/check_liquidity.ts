import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    console.log("Checking Live Liquidity for any active MLB game...");
    const polyApi = new PolymarketApi();
    const client = await (polyApi as any).initClient();
    
    const url = `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=100`;
    const response = await fetch(url);
    const events = await response.json();
    
    // Find a baseball event that has an active market with clobTokenIds
    const mlbEvents = events.filter((e: any) => 
        (e.title.toLowerCase().includes('mlb') || e.title.toLowerCase().includes('baseball') || e.category === 'Sports') &&
        e.markets && e.markets.length > 0 && 
        e.markets[0].clobTokenIds
    ).sort((a: any, b: any) => parseFloat(b.markets[0].volume || 0) - parseFloat(a.markets[0].volume || 0));

    if (mlbEvents.length === 0) {
        console.log("Could not find any active sports markets with volume.");
        return;
    }

    // Just take the top volume sports event
    const event = mlbEvents[0];
    const market = event.markets[0];
    
    console.log(`\n======================================================`);
    console.log(`Event: ${event.title}`);
    console.log(`Market: ${market.question}`);
    console.log(`Volume: $${parseFloat(market.volume).toFixed(2)}`);
    
    const tokenIds = typeof market.clobTokenIds === 'string' ? JSON.parse(market.clobTokenIds) : market.clobTokenIds;
    const tokenId = tokenIds[0]; // Outcome 0
    
    try {
        const ob = await client.getOrderBook(tokenId);
        
        console.log("\n  [ASKS] (These are the shares you would BUY to bet YES):");
        let totalAvailableFor5CentsSlippage = 0;
        let totalAvailableFor1CentSlippage = 0;
        let bestPrice = ob.asks.length > 0 ? parseFloat(ob.asks[0].price) : 0;
        
        ob.asks.slice(0, 5).forEach((ask: any) => {
            const cost = parseFloat(ask.price) * parseFloat(ask.size);
            console.log(`    Price: $${ask.price} | Size: ${parseFloat(ask.size).toFixed(0)} shares | Total Cost: $${cost.toFixed(2)}`);
            
            if (parseFloat(ask.price) <= bestPrice + 0.05) {
                totalAvailableFor5CentsSlippage += cost;
            }
            if (parseFloat(ask.price) <= bestPrice + 0.01) {
                totalAvailableFor1CentSlippage += cost;
            }
        });
        
        console.log(`\n  👉 MAX BET SIZE without moving the line > 1 cent: $${totalAvailableFor1CentSlippage.toFixed(2)}`);
        console.log(`  👉 MAX BET SIZE before moving the line > 5 cents: $${totalAvailableFor5CentsSlippage.toFixed(2)}`);
        
    } catch (e: any) {
        console.log(`Error fetching order book: ${e.message}`);
    }
}

main().catch(console.error);
