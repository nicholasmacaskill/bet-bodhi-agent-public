import { MLBApi } from './src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-28';

    try {
        const games = await mlb.getSchedule(today);
        const game = games.find(g => (g.awayTeam.includes('Nationals') || g.homeTeam.includes('Nationals')));
        
        if (game) {
            console.log(`\nMATCHUP: ${game.awayTeam} @ ${game.homeTeam}`);
            console.log(`DATE: ${game.date}`);
            console.log(`STATUS: ${game.status}`);
            console.log(`PITCHERS: ${game.probables?.away || 'TBD'} vs ${game.probables?.home || 'TBD'}`);
            
            // Look for details to analyze lineups
            const hydrated = await mlb.getHydratedAnalysisData(game);
             console.log("\nHydrated Analysis Data Found:");
             console.log(`Home Hot: ${hydrated.homeHot.join(', ')}`);
             console.log(`Away Hot: ${hydrated.awayHot.join(', ')}`);
        } else {
            console.log(`No Nationals game found for ${today}.`);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
