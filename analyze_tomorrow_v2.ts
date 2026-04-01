
import { MLBApi } from './src/lib/mlb-api';
import { PillarAnalyzer } from './src/lib/pillar-analyzer';

async function main() {
    const mlbApi = new MLBApi();
    const mlbAnalyzer = new PillarAnalyzer();
    
    // Check Tomorrow's Slate (April 1st, 2026)
    const date = '2026-04-01'; 
    console.log(`--- ANALYZING ACTUAL SLATE FOR ${date} ---\n`);

    try {
        const mlbGames = await mlbApi.getSchedule(date);
        console.log(`Found ${mlbGames.length} MLB Games.\n`);
        
        console.log("RECOMMENDED 'GRINDER' PLAYS (APRIL 1ST):");
        console.log("------------------------------------------");
        
        for (const game of mlbGames) {
            const data = await mlbApi.getHydratedAnalysisData(game);
            const analysis = mlbAnalyzer.analyzeGame(game, data.details, null, data.awayHot.concat(data.homeHot), [], undefined, 500, "Focused", 10, data.rosters);
            
            const isHighConfidence = analysis.overallConfidence >= 65;
            const isValue = analysis.valueTeam !== null;
            
            if (isHighConfidence && isValue) {
                console.log(`✅ ${analysis.awayTeam} @ ${analysis.homeTeam}`);
                console.log(`   PICK: ${analysis.valueTeam} | CONFIDENCE: ${analysis.overallConfidence}%`);
                console.log(`   RECOMMENDED STAKE: $15.00 (Flat Unit)`);
                console.log("");
            }
        }
    } catch (e: any) {
        console.error("Error fetching tomorrow's slate:", e.message);
    }
}

main();
