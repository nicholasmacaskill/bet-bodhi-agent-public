
import { MLBApi } from './src/lib/mlb-api';
import { PillarAnalyzer } from './src/lib/pillar-analyzer';

async function main() {
    const mlbApi = new MLBApi();
    const mlbAnalyzer = new PillarAnalyzer();
    
    const date = '2026-03-25';
    console.log(`Analyzing Opening Day Slate for ${date}...\n`);

    try {
        const mlbGames = await mlbApi.getSchedule(date);
        console.log(`--- ${mlbGames.length} MLB Games Found ---`);
        
        const targetGame = mlbGames.find(g => 
            (g.awayTeam.includes('Yankees') && g.homeTeam.includes('Giants')) ||
            (g.awayTeam.includes('Giants') && g.homeTeam.includes('Yankees'))
        );

        if (!targetGame) {
            console.log("Yankees vs Giants game not found for this date.");
            return;
        }

        console.log(`Processing ${targetGame.awayTeam} @ ${targetGame.homeTeam}...`);
        const data = await mlbApi.getHydratedAnalysisData(targetGame);
        
        // Using sample parameters similar to scan_tomorrow.ts
        const analysis = mlbAnalyzer.analyzeGame(
            targetGame, 
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

        console.log("\n========================================================");
        console.log(`MATCHUP: ${analysis.awayTeam} @ ${analysis.homeTeam}`);
        console.log(`DATE: ${date}`);
        console.log("========================================================");
        console.log(`Away Pitcher: ${data.details.probables?.away?.fullName || data.details.probables?.away || 'TBD'}`);
        console.log(`Home Pitcher: ${data.details.probables?.home?.fullName || data.details.probables?.home || 'TBD'}`);
        console.log("--------------------------------------------------------");
        console.log(`Confidence: ${analysis.overallConfidence}%`);
        console.log(`Lean: ${analysis.valueTeam || 'PASS (No clear edge)'}`);
        console.log(`Action: ${analysis.recommendedAction}`);
        console.log("--------------------------------------------------------");
        console.log("Pillars:");
        analysis.pillars.forEach(p => {
            console.log(`- ${p.pillar}: Score ${p.score}/10`);
            console.log(`  Reason: ${p.reason}`);
        });
        console.log("--------------------------------------------------------");
        console.log("Advantages:");
        analysis.advantages?.forEach(adv => console.log(`- ${adv}`));
        console.log("========================================================\n");

    } catch (error) {
        console.error("Error during analysis:", error);
    }
}

main();
