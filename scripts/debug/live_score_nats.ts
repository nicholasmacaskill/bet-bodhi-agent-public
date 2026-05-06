import { MLBApi } from '../../src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-28';
    
    const games_url = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-03-28&hydrate=linescore';
    const response = await fetch(games_url);
    const data = await response.json();
    
    if (data.dates?.[0]?.games) {
        data.dates[0].games.forEach((game:any) => {
            const ls = game.linescore;
            if (ls && (game.teams.away.team.name.includes('Nationals') || game.teams.home.team.name.includes('Nationals'))) {
                console.log(`${game.teams.away.team.name} ${ls.teams.away.runs || 0} - ${game.teams.home.team.name} ${ls.teams.home.runs || 0}`);
                console.log(`Inning: ${ls.currentInning} (${ls.inningHalf})`);
            }
        });
    }
}

main();
