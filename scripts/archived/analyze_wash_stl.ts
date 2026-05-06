
import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';

async function main() {
    const api = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const date = '2026-03-19';
    
    console.log(`Analyzing Washington vs St. Louis for ${date}...\n`);

    const games = await api.getSchedule(date);
    const game = games.find(g => 
        (g.homeTeam.includes('Nationals') || g.awayTeam.includes('Nationals')) && 
        (g.homeTeam.includes('Cardinals') || g.awayTeam.includes('Cardinals'))
    );

    if (game) {
        const data = await api.getHydratedAnalysisData(game);
        const analysis = analyzer.analyzeGame(
            game,
            data.details,
            null,
            data.awayHot.concat(data.homeHot),
            [],
            undefined,
            500,
            "Focused",
            10,
            data.rosters
        );

        console.log("=== BODHI ANALYSIS: Washington @ St. Louis ===");
        console.log(`CONFIDENCE: ${analysis.overallConfidence}%`);
        console.log(`VALUE TEAM: ${analysis.valueTeam || 'None'}`);
        console.log(`ACTION: ${analysis.recommendedAction}`);
        console.log(`STAKE: $${analysis.suggestedStake.toFixed(2)} (${analysis.recommendedSize})`);
        console.log(`PITCHERS: ${analysis.awayPitcher} vs ${analysis.homePitcher}`);
        console.log(`NOTES: ${analysis.matchupNotes}`);
        console.log("ADVANTAGES:");
        analysis.advantages.forEach(a => console.log(`- ${a}`));
    } else {
        console.log("Game not found.");
    }
}

main();
