import { MLBApi } from './src/lib/mlb-api';
import { PillarAnalyzer } from './src/lib/pillar-analyzer';

async function main() {
    const mlb = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const today = '2026-03-28';

    try {
        const games = await mlb.getSchedule(today);
        const game = games.find(g => 
            (g.awayTeam.includes('Rays') && g.homeTeam.includes('Cardinals')) ||
            (g.homeTeam.includes('Rays') && g.awayTeam.includes('Cardinals'))
        );

        if (!game) {
            console.log("No Rays vs Cardinals game found today.");
            return;
        }

        const hydrated = await mlb.getHydratedAnalysisData(game);
        
        // We don't have polyMarket data yet, but we can see the technical lean
        const analysis = analyzer.analyzeGame(
            game,
            hydrated.details,
            undefined, // no polymarket yet
            [...hydrated.homeHot, ...hydrated.awayHot],
            [],
            undefined, // no playerStats map yet
            464, // bankroll
            "Ready",
            8,
            hydrated.rosters
        );

        console.log(JSON.stringify(analysis, null, 2));

    } catch (e) {
        console.error(e);
    }
}

main();
