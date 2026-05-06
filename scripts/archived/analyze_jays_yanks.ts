import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';

async function main() {
    const mlb = new MLBApi();
    const analyzer = new PillarAnalyzer();
    
    console.log("Analyzing Jays vs Yankees...");
    const schedule = await mlb.getSchedule('2026-03-11');
    const game = schedule.find(g => 
        (g.homeTeam.toLowerCase().includes('yankees') && g.awayTeam.toLowerCase().includes('blue jays')) ||
        (g.homeTeam.toLowerCase().includes('blue jays') && g.awayTeam.toLowerCase().includes('yankees'))
    );

    if (!game) {
        console.log("Game not found in schedule.");
        return;
    }

    console.log(`Found: ${game.awayTeam} @ ${game.homeTeam}`);
    console.log(`Start Time: ${game.startTime}`);
    
    // Check if game is live
    const liveInfo = await mlb.getGameUpdate(game.gameId);
    console.log("Live Info:", JSON.stringify(liveInfo, null, 2));

    const analysis = await analyzer.analyzeGame(game, { h2h: { [game.homeTeam]: 1.7, [game.awayTeam]: 2.2 } });
    console.log("Full Pillar Analysis:", JSON.stringify(analysis, null, 2));
}

main().catch(console.error);
