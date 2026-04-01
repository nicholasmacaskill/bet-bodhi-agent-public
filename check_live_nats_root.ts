import { MLBApi } from './src/lib/mlb-api';
import { PolymarketApi } from './src/lib/polymarket-api';

async function main() {
    const mlb = new MLBApi();
    const poly = new PolymarketApi();
    const gamePk = 831464; // Nationals @ Mets

    console.log("--- LIVE GAME STATUS ---");
    const details = await mlb.getGameDetails(gamePk);
    if (details) {
        console.log(`Lineups: ${details.lineups.home.length} home nodes, ${details.lineups.away.length} away nodes`);
        console.log(`Probables: Home: ${details.probables.home}, Away: ${details.probables.away}`);
    }

    console.log("\n--- POLYMARKET LIVE ---");
    const market = await poly.getMarketByTeams("Washington Nationals", "New York Mets");
    if (market) {
        console.log(`Question: ${market.question}`);
        console.log(`Prices: ${market.outcomePrices.join(', ')}`);
        console.log(`Condition ID: ${market.conditionId}`);
    } else {
        console.log("No Polymarket market found for this matchup.");
    }
}
main().catch(console.error);
