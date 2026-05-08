import { MLBApi } from './src/lib/mlb-api';

async function run() {
    const api = new MLBApi();
    const schedule = await api.getSchedule('2026-04-08');
    const game = schedule.find((g: any) => g.homeTeam.includes('Yankees') || g.awayTeam.includes('Athletics'));
    if (!game) {
        console.log("Game not found in schedule.");
        return;
    }
    console.log(`Game Status: ${game.status}`);
    console.log(`Score (if manual or linescore): ${game.score}`);
    
    // Attempt detailed fetch
    try {
        const detailsResp = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`);
        const details = await detailsResp.json();
        
        const awayRuns = details.liveData?.linescore?.teams?.away?.runs;
        const homeRuns = details.liveData?.linescore?.teams?.home?.runs;
        const inningState = details.liveData?.linescore?.inningState;
        const currentInning = details.liveData?.linescore?.currentInning;
        
        console.log(`Live Data Score: Away ${awayRuns} - Home ${homeRuns}`);
        console.log(`Inning: ${inningState} ${currentInning}`);
    } catch (e) {
        console.log("Could not fetch detailed live feed.");
    }
}
run();
