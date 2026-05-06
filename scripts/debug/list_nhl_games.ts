import { PolymarketApi } from '../../src/lib/polymarket-api';

async function listGames() {
    const api = new PolymarketApi();
    console.log("Listing ALL NHL 'vs.' markets on Polymarket...");
    const markets = await api.getActiveSportsMarkets("vs.");
    markets.filter(m => m.category === "NHL" || m.question.toLowerCase().includes("nhl"))
           .forEach(m => console.log(`- [${m.conditionId}] ${m.question} (${m.outcomePrices.join('/')})`));
}
listGames();
