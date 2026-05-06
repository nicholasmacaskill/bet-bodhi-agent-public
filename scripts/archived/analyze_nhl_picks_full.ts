
import { NHLApi } from '../../src/lib/nhl-api';
import { NHLPillarAnalyzer } from '../../src/lib/nhl-pillar-analyzer';

async function main() {
    const api = new NHLApi();
    const analyzer = new NHLPillarAnalyzer();
    const date = '2026-03-18';
    
    console.log(`Analyzing NHL Slate for ${date}...\n`);

    const games = await api.getSchedule(date);
    const teamStats = await api.getTeamStats();
    const leaders = await api.getGoalieLeaders();

    if (games.length === 0) console.log("No games found.");
    for (const game of games) {
        // Fetch detailed landing for goalies
        const landing = await api.getGameLanding(game.id);
        const goalies = landing?.matchup?.goalieSeasonStats?.goalies || [];
        
        const homeGoalie = goalies.find((g: any) => g.teamId === game.homeTeamId);
        const awayGoalie = goalies.find((g: any) => g.teamId === game.awayTeamId);

        const goalieStats = {
            home: {
                name: homeGoalie?.name?.default || "TBD",
                gaa: homeGoalie?.goalsAgainstAvg || 3.0,
                savePct: homeGoalie?.savePctg || 0.900
            },
            away: {
                name: awayGoalie?.name?.default || "TBD",
                gaa: awayGoalie?.goalsAgainstAvg || 3.0,
                savePct: awayGoalie?.savePctg || 0.900
            }
        };

        const analysis = analyzer.analyzeGame(
            game,
            teamStats,
            null, // polyMarket
            { elite: leaders.elite, weak: leaders.weak },
            goalieStats,
            464, // bankroll
            "Focused",
            9
        );

        console.log(`=== ${analysis.awayTeam} @ ${analysis.homeTeam} ===`);
        console.log(`   Confidence: ${analysis.overallConfidence}% | Value Team: ${analysis.valueTeam || 'None'}`);
        if (analysis.valueTeam) {
            console.log(`   🚨 ACTION: ${analysis.recommendedAction}`);
            console.log(`   STAKE: $${analysis.suggestedStake.toFixed(2)} (${analysis.recommendedSize})`);
            console.log(`   NOTES: ${analysis.matchupNotes}`);
        }
        console.log(`   GOALIES: ${goalieStats.away.name} vs ${goalieStats.home.name}`);
        console.log("-------------------------------------------\n");
    }
}

main();
