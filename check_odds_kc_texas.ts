
import { OddsApi } from './src/lib/odds-api';

async function main() {
    const api = new OddsApi();
    console.log("Fetching MLB odds from ESPN/Live API...");
    const odds = await api.getMLBOdds();
    
    const matchup = odds.find(o => 
        (o.home_team.includes('Royals') || o.away_team.includes('Royals')) &&
        (o.home_team.includes('Rangers') || o.away_team.includes('Rangers'))
    );

    if (matchup) {
        console.log("=== ODDS FOUND ===");
        console.log(`Matchup: ${matchup.away_team} @ ${matchup.home_team}`);
        matchup.bookmakers.forEach(b => {
            console.log(`[${b.title}]`);
            b.markets.forEach(m => {
                if (m.key === 'h2h') {
                    m.outcomes.forEach(o => {
                        console.log(`  - ${o.name}: ${o.price}`);
                    });
                }
            });
        });
    } else {
        console.log("No odds found for KC vs Texas.");
        console.log("Available matchups:");
        odds.forEach(o => console.log(`- ${o.away_team} @ ${o.home_team}`));
    }
}

main();
