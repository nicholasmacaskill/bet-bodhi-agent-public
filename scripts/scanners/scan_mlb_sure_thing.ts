
import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';

async function main() {
    const api = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const date = '2026-03-18';
    
    console.log(`Scanning full MLB slate for ${date}...\n`);
    const games = await api.getSchedule(date);
    
    const candidates = [];

    for (const game of games) {
        const analysisData = await api.getHydratedAnalysisData(game);
        
        const analysis = analyzer.analyzeGame(
            game,
            analysisData.details,
            null, // polyMarket
            analysisData.awayHot.concat(analysisData.homeHot),
            [], // weakPitchers
            undefined, // playerStats
            500, // bankroll
            "Focused",
            10,
            analysisData.rosters
        );

        candidates.push(analysis);
    }

    // Sort by confidence
    candidates.sort((a, b) => b.overallConfidence - a.overallConfidence);

    console.log("=== MLB SLATE CONFIDENCE RANKINGS ===");
    candidates.forEach((c, i) => {
        console.log(`${i+1}. ${c.awayTeam} @ ${c.homeTeam}`);
        console.log(`   Confidence: ${c.overallConfidence}% | Value: ${c.valueTeam || 'None'}`);
        console.log(`   Advantage: ${c.matchupNotes}`);
        console.log(`   Status: ${c.recommendedAction}`);
        console.log("-------------------------------------------\n");
    });
}

main();
