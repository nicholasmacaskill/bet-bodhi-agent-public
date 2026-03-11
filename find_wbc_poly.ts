import { PolymarketApi } from './src/lib/polymarket-api';

async function findWBCMarket() {
    const api = new PolymarketApi();
    console.log("Searching for WBC markets on Polymarket...");
    
    // Search for keywords
    const keywords = ["Canada", "Puerto Rico", "World Baseball Classic", "WBC"];
    
    for (const keyword of keywords) {
        console.log(`Checking keyword: ${keyword}`);
        const markets = await api.getActiveSportsMarkets(keyword);
        if (markets.length > 0) {
            console.log(`Found ${markets.length} markets for ${keyword}:`);
            markets.forEach(m => {
                console.log(`- [${m.conditionId}] ${m.question} (${m.outcomePrices.join('/')}) vol: ${m.volume}`);
            });
        }
    }
}

findWBCMarket();
