import { MLBApi } from './src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const date = '2026-03-16';
    const games = await mlb.getSchedule(date);
    const cubs = games.find(g => g.awayTeam.includes('Cubs') || g.homeTeam.includes('Cubs'));
    
    if (cubs) {
        console.log(`Matchup: ${cubs.awayTeam} @ ${cubs.homeTeam}`);
        console.log(`Status: ${cubs.status}`);
        
        // Fetch live feed for scores
        const url = `https://statsapi.mlb.com/api/v1/game/${cubs.gamePk}/linescore`;
        const res = await fetch(url);
        const data = await res.json();
        const homeScore = data.teams.home.runs;
        const awayScore = data.teams.away.runs;
        const inning = data.currentInning;
        const half = data.inningHalf;
        
        console.log(`Score: ${cubs.awayTeam} ${awayScore} - ${homeScore} ${cubs.homeTeam}`);
        console.log(`Inning: ${half} ${inning}`);
    } else {
        console.log("Cubs game not found.");
    }
}
main();
