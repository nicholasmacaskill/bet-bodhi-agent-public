import { MLBApi } from '../../src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-28';
    
    const games_url = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-03-28&hydrate=linescore';
    const response = await fetch(games_url);
    const data = await response.json();
    
    if (data.dates?.[0]?.games) {
        const game = data.dates[0].games.find((g:any) => 
            (g.teams.away.team.name.includes('Rays') && g.teams.home.team.name.includes('Cardinals')) ||
            (g.teams.home.team.name.includes('Rays') && g.teams.away.team.name.includes('Cardinals'))
        );
        
        if (game) {
            const ls = game.linescore;
            console.log(`${game.teams.away.team.name} ${ls.teams.away.runs || 0} - ${game.teams.home.team.name} ${ls.teams.home.runs || 0}`);
            console.log(`Inning: ${ls.currentInning} (${ls.inningHalf})`);
        } else {
            console.log("Game not found.");
        }
    }
}

main();
