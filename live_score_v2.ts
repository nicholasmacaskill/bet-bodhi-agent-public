import { MLBApi } from './src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-29';
    
    const games_url = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-03-29&hydrate=linescore,team';
    const response = await fetch(games_url);
    const data = await response.json();
    
    if (data.dates?.[0]?.games) {
        data.dates[0].games.forEach((game:any) => {
            const ls = game.linescore;
            if (ls) {
                console.log(`${game.teams.away.team.name} ${ls.teams.away.runs || 0} - ${game.teams.home.team.name} ${ls.teams.home.runs || 0} (Inning: ${ls.currentInning})`);
            } else {
                 console.log(`${game.teams.away.team.name} @ ${game.teams.home.team.name} - ${game.status.detailedState}`);
            }
        });
    }
}

main();
