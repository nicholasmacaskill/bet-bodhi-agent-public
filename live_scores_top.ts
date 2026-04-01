import { MLBApi } from './src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-28';
    
    const games_url = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-03-28&hydrate=linescore';
    const response = await fetch(games_url);
    const data = await response.json();
    
    const targets = ['Phillies', 'Marlins', 'Angels', 'Dodgers', 'Orioles'];
    
    if (data.dates?.[0]?.games) {
        data.dates[0].games.forEach((game:any) => {
            if (targets.some(t => game.teams.away.team.name.includes(t) || game.teams.home.team.name.includes(t))) {
                const ls = game.linescore;
                if (!ls) {
                    console.log(`${game.teams.away.team.name} @ ${game.teams.home.team.name} - Not Started`);
                } else {
                    console.log(`${game.teams.away.team.name} ${ls.teams.away.runs || 0} - ${game.teams.home.team.name} ${ls.teams.home.runs || 0} (${game.status.detailedState})`);
                }
            }
        });
    }
}

main();
