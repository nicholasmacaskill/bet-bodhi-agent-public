
import { MLBApi } from './src/lib/mlb-api';
import { NHLApi } from './src/lib/nhl-api';
import { PillarAnalyzer } from './src/lib/pillar-analyzer';
import { NHLPillarAnalyzer } from './src/lib/nhl-pillar-analyzer';

async function main() {
    const mlbApi = new MLBApi();
    const nhlApi = new NHLApi();
    const mlbAnalyzer = new PillarAnalyzer();
    const nhlAnalyzer = new NHLPillarAnalyzer();
    
    // Check March 20, 2026
    const date = '2026-03-20';
    console.log(`Scanning Slate for ${date}...\n`);

    // MLB
    const mlbGames = await mlbApi.getSchedule(date);
    console.log(`--- ${mlbGames.length} MLB Games Found ---`);
    for (const game of mlbGames.slice(0, 5)) { // Limit output for brevity
        const data = await mlbApi.getHydratedAnalysisData(game);
        const analysis = mlbAnalyzer.analyzeGame(game, data.details, null, data.awayHot.concat(data.homeHot), [], undefined, 500, "Focused", 10, data.rosters);
        console.log(`⚾ ${analysis.awayTeam} @ ${analysis.homeTeam} | Conf: ${analysis.overallConfidence}% | Value: ${analysis.valueTeam || 'None'}`);
    }

    // NHL
    const nhlGames = await nhlApi.getSchedule(date);
    const teamStats = await nhlApi.getTeamStats();
    const leaders = await nhlApi.getGoalieLeaders();
    console.log(`\n--- ${nhlGames.length} NHL Games Found ---`);
    for (const game of nhlGames) {
        const landing = await nhlApi.getGameLanding(game.id);
        const goalies = landing?.matchup?.goalieSeasonStats?.goalies || [];
        const homeGoalie = goalies.find((g: any) => g.teamId === game.homeTeamId);
        const awayGoalie = goalies.find((g: any) => g.teamId === game.awayTeamId);

        const goalieStats = {
            home: { name: homeGoalie?.name?.default || "TBD", gaa: homeGoalie?.goalsAgainstAvg || 3.0, savePct: homeGoalie?.savePctg || 0.900 },
            away: { name: awayGoalie?.name?.default || "TBD", gaa: awayGoalie?.goalsAgainstAvg || 3.0, savePct: awayGoalie?.savePctg || 0.900 }
        };

        const analysis = nhlAnalyzer.analyzeGame(game, teamStats, null, { elite: leaders.elite, weak: leaders.weak }, goalieStats, 500, "Focused", 10);
        console.log(`🏒 ${analysis.awayTeam} @ ${analysis.homeTeam} | Conf: ${analysis.overallConfidence}% | Value: ${analysis.valueTeam || 'None'}`);
    }
}

main();
