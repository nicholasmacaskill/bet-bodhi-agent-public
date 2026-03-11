import { PolymarketApi } from './src/lib/polymarket-api';
async function main() {
    const poly = new PolymarketApi();
    console.log("Fetching active MLB markets from Poly...");
    const markets = await poly.getActiveSportsMarkets("MLB");
    markets.forEach(m => console.log(`${m.question} (${m.conditionId})`));
}
main();
