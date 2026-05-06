import { PolymarketApi } from '../../src/lib/polymarket-api';

async function findMascots() {
    const api = new PolymarketApi();
    console.log("Searching for 'Stars' and 'Knights' on Polymarket...");
    const markets = await api.getActiveSportsMarkets("vs.");
    const filtered = markets.filter(m => 
        (m.question.toLowerCase().includes("stars") || m.description.toLowerCase().includes("stars")) &&
        (m.question.toLowerCase().includes("knights") || m.description.toLowerCase().includes("knights"))
    );
    
    if (filtered.length > 0) {
        filtered.forEach(m => console.log(`- [${m.conditionId}] ${m.question} (${m.outcomePrices.join('/')})`));
    } else {
        console.log("No markets found with 'Stars' AND 'Knights'.");
        // Try just 'Stars' to see what's there
        console.log("\nMarkets with just 'Stars':");
        markets.filter(m => m.question.toLowerCase().includes("stars") || m.description.toLowerCase().includes("stars"))
               .forEach(m => console.log(`- [${m.conditionId}] ${m.question} (${m.outcomePrices.join('/')})`));
    }
}
findMascots();
