import { MLBApi } from './src/lib/mlb-api';

async function checkLiveScore(teamQuery: string) {
    const mlb = new MLBApi();
    const date = '2026-03-27';
    
    console.log(`Fetching live schedule for ${date}...`);
    const games = await mlb.getSchedule(date);
    
    const game = games.find(g => 
        g.homeTeam.toLowerCase().includes(teamQuery.toLowerCase()) || 
        g.awayTeam.toLowerCase().includes(teamQuery.toLowerCase())
    );
    
    if (game && game.gamePk) {
        console.log(`Found Game: ${game.awayTeam} @ ${game.homeTeam} (Pk: ${game.gamePk})`);
        
        // Fetch detailed feed
        const url = `https://statsapi.mlb.com/api/v1/game/${game.gamePk}/linescore`;
        const resp = await fetch(url);
        const ls = await resp.json();
        
        console.log(`LIVE SCORE: ${game.awayTeam} ${ls.teams.away.runs} - ${game.homeTeam} ${ls.teams.home.runs} (${ls.inningHalf} ${ls.currentInning})`);
        console.log(`Hits: ${ls.teams.away.hits} (Away) - ${ls.teams.home.hits} (Home)`);
    } else {
        console.log(`No game found for "${teamQuery}" today.`);
    }
}

const team = process.argv[2] || "Detroit";
checkLiveScore(team);
