import { MLBApi } from './src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-28';
    
    const games_url = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-03-28&getLineups=true&hydrate=linescore,team,lineups,probablePitcher';
    const response = await fetch(games_url);
    const data = await response.json();
    
    if (data.dates?.[0]?.games) {
        console.log("--- LIVE MLB SLATE STATUS (21:26) ---");
        data.dates[0].games.forEach((game:any) => {
            const ls = game.linescore;
            if (ls && !game.status.detailedState.includes('Final')) {
                console.log(`${game.teams.away.team.name} ${ls.teams.away.runs || 0} - ${game.teams.home.team.name} ${ls.teams.home.runs || 0} (${game.status.detailedState}, Inning: ${ls.currentInning} ${ls.inningHalf})`);
            } else if (!ls) {
                console.log(`${game.teams.away.team.name} @ ${game.teams.home.team.name} - ${game.status.detailedState}`);
            }
        });
    }
}

main();
