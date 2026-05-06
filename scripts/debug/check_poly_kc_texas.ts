
import { PolymarketApi } from '../../src/lib/polymarket-api';

async function main() {
    const api = new PolymarketApi();
    const homeTeam = "Texas Rangers";
    const awayTeam = "Kansas City Royals";
    
    console.log(`Searching for Polymarket market for ${awayTeam} @ ${homeTeam}...`);
    const market = await api.getMarketByTeams(homeTeam, awayTeam);
    
    if (market) {
        console.log("Market Found!");
        console.log("Question:", market.question);
        console.log("Outcomes:", market.outcomes);
        console.log("Outcome Prices:", market.outcomePrices);
        console.log("ConditionID:", market.conditionId);
    } else {
        console.log("No Polymarket market found for this matchup.");
    }
}

main();
