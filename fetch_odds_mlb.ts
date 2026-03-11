import 'dotenv/config';
import { OddsApi } from './src/lib/odds-api';

async function main() {
    const oddsApi = new OddsApi();
    console.log("Fetching MLB Odds...");
    const odds = await oddsApi.getOdds('baseball_mlb');
    
    if (odds.length === 0) {
        console.log("No MLB odds found.");
        return;
    }

    console.log(`Found ${odds.length} MLB games:`);
    odds.forEach(game => {
        const h2h = game.bookmakers[0]?.markets.find(m => m.key === 'h2h');
        const homePrice = h2h?.outcomes.find(o => o.name === game.home_team)?.price;
        const awayPrice = h2h?.outcomes.find(o => o.name === game.away_team)?.price;
        
        console.log(`- ${game.away_team} @ ${game.home_team}`);
        console.log(`  Start: ${game.commence_time}`);
        console.log(`  Odds: ${game.away_team} ${awayPrice} | ${game.home_team} ${homePrice}`);
    });
}

main().catch(console.error);
