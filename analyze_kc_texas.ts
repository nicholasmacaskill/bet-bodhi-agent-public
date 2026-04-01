
import { MLBApi } from './src/lib/mlb-api';
import { PillarAnalyzer } from './src/lib/pillar-analyzer';

async function main() {
    const api = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const date = '2026-03-18';
    const games = await api.getSchedule(date);
    
    const game = games.find(g => 
        (g.homeTeam.includes('Royals') || g.awayTeam.includes('Royals')) &&
        (g.homeTeam.includes('Rangers') || g.awayTeam.includes('Rangers'))
    );

    if (game) {
        const analysisData = await api.getHydratedAnalysisData(game);
        
        // Mock some values for the analyzer
        const mood = "Focused";
        const calmness = 9;
        const bankroll = 500;

        const analysis = analyzer.analyzeGame(
            game,
            analysisData.details,
            null, // polyMarket
            analysisData.awayHot.concat(analysisData.homeHot), // combined hot bats
            [], // weak pitchers
            undefined, // playerStats
            bankroll,
            mood,
            calmness,
            analysisData.rosters
        );

        console.log("=== BODHI PILLAR ANALYSIS ===");
        console.log(`MATCHUP: ${analysis.awayTeam} @ ${analysis.homeTeam}`);
        console.log(`PITCHERS: ${analysis.awayPitcher} vs ${analysis.homePitcher}`);
        console.log(`OVERALL CONFIDENCE: ${analysis.overallConfidence}%`);
        console.log(`RECOMMENDED ACTION: ${analysis.recommendedAction}`);
        console.log(`VALUE TEAM: ${analysis.valueTeam || 'None'}`);
        console.log(`SUGGESTED STAKE: $${analysis.suggestedStake.toFixed(2)} (${analysis.recommendedSize})`);
        console.log("\n--- PILLARS ---");
        analysis.pillars.forEach(p => {
            console.log(`[${p.pillar}] Score: ${p.score}/10 - ${p.reason}`);
        });
        console.log("\n--- ADVANTAGES ---");
        analysis.advantages.forEach(a => console.log(`- ${a}`));
        console.log("\n--- KILL CRITERIA ---");
        analysis.killCriteria.forEach(k => console.log(`- ${k}`));
    } else {
        console.log("No KC vs Texas game found.");
    }
}

main();
