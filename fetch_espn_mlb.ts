import { EspnOddsApi } from './src/lib/espn-odds-api';

async function main() {
    const espn = new EspnOddsApi();
    console.log("Fetching MLB Games from ESPN...");
    const games = await espn.getOdds('baseball/mlb');
    
    if (games.length === 0) {
        console.log("No MLB games found on ESPN.");
        return;
    }

    console.log(`Found ${games.length} MLB games on ESPN:`);
    games.forEach(g => {
        console.log(`- ${g.awayTeam} @ ${g.homeTeam}`);
    });
}

main().catch(console.error);
