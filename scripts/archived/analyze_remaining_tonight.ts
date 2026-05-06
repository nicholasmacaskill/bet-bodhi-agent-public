
import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';
import { PolymarketApi } from '../../src/lib/polymarket-api';

async function main() {
    const mlb = new MLBApi();
    const pillar = new PillarAnalyzer();
    const poly = new PolymarketApi();

    // Dynamically get today's date in YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n🔍 ANALYZING REMAINING MLB GAMES — ${today}`);
    console.log(`──────────────────────────────────────────────────────────────────────\n`);

    try {
        const games = await mlb.getSchedule(today);
        const remainingGames = games.filter(g => g.status !== 'Final' && g.status !== 'Postponed' && g.status !== 'Completed Early');

        if (remainingGames.length === 0) {
            console.log("No remaining MLB games found for tonight.");
            // List finished games just for context
            if (games.length > 0) {
                console.log("\nFinished Games:");
                games.forEach(g => console.log(`✅ ${g.awayTeam} @ ${g.homeTeam}: ${g.status}`));
            }
            return;
        }

        console.log(`Found ${remainingGames.length} games remaining/in-progress.\n`);

        for (const game of remainingGames) {
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`⚾ ${game.awayTeam} @ ${game.homeTeam} (${game.status})`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            
            const [data, polyMarket] = await Promise.all([
                mlb.getHydratedAnalysisData(game),
                poly.getMarketByTeams(game.homeTeam, game.awayTeam)
            ]);

            const analysis = pillar.analyzeGame(
                game,
                data.details,
                polyMarket,
                data.homeHot.concat(data.awayHot),
                [], // weakPitchers
                undefined, // playerStats
                1000, // bankroll
                'Neutral', // mood
                8, // calmness
                data.rosters
            );

            console.log(`BODHI-8 Score: ${analysis.overallConfidence.toFixed(1)}%`);
            console.log(`Recommended Action: ${analysis.recommendedAction}`);
            console.log(`Value Team: ${analysis.valueTeam || 'None'}`);
            if (analysis.polySharePrice) {
                console.log(`Polymarket Price: ${(analysis.polySharePrice * 100).toFixed(0)}¢`);
                console.log(`Polymarket EV: ${(analysis.polyEV! * 100).toFixed(1)}%`);
            }
            
            console.log(`\nMatchup: ${analysis.matchupNotes}`);
            console.log(`\n✅ Advantages:`);
            analysis.advantages?.forEach(a => console.log(`   ├─ ${a}`));
            
            if (analysis.killCriteria && analysis.killCriteria.length > 0) {
                console.log(`\n🚨 Kill Criteria:`);
                analysis.killCriteria.forEach(k => console.log(`   ├─ ${k}`));
            }
            console.log("");
        }

    } catch (error) {
        console.error("Error during analysis:", error);
    }
}

main();
