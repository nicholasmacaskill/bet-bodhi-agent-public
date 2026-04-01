
import { MLBApi } from './src/lib/mlb-api';
import { PillarAnalyzer } from './src/lib/pillar-analyzer';

async function getDetailedValuePlays() {
    const mlbApi = new MLBApi();
    const mlbAnalyzer = new PillarAnalyzer();
    const date = '2026-04-01'; 
    
    console.log(`--- DEEP DIVE: VALUE PLAYS FOR ${date} ---\n`);

    const mlbGames = await mlbApi.getSchedule(date);
    const recommendations = [];

    for (const game of mlbGames) {
        const data = await mlbApi.getHydratedAnalysisData(game);
        const analysis = mlbAnalyzer.analyzeGame(game, data.details, null, data.awayHot.concat(data.homeHot), [], undefined, 500, "Focused", 10, data.rosters);
        
        // Stricter Filter for "The Grinder" Style
        // 1. Confidence > 70%
        // 2. Clear Value Team
        if (analysis.overallConfidence >= 70 && analysis.valueTeam) {
            recommendations.push({
                matchup: `${analysis.awayTeam} @ ${analysis.homeTeam}`,
                pick: analysis.valueTeam,
                confidence: analysis.overallConfidence,
                reasoning: analysis.pillars.map(p => p.reason).slice(0, 2),
                pitchers: analysis.probables
            });
        }
    }

    console.log(JSON.stringify(recommendations, null, 2));
}

getDetailedValuePlays();
