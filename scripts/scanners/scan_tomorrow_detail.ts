
import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';

async function main() {
    const api = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const date = '2026-03-20';
    
    console.log(`Analyzing High Confidence MLB games for ${date}...\n`);

    const games = await api.getSchedule(date);
    
    for (const game of games) {
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

        if (analysis.overallConfidence >= 75) {
            console.log(`=== ${analysis.awayTeam} @ ${analysis.homeTeam} ===`);
            console.log(`Confidence: ${analysis.overallConfidence}% | Value: ${analysis.valueTeam}`);
            console.log(`Pitchers: ${analysis.awayPitcher} vs ${analysis.homePitcher}`);
            console.log(`Reasoning: ${analysis.matchupNotes}`);
            console.log("-------------------------------------------\n");
        }
    }
}

main();
