import { MLBApi } from './src/lib/mlb-api';
import { PillarAnalyzer } from './src/lib/pillar-analyzer';

async function main() {
    const mlb = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const today = '2026-03-28';

    try {
        const games = await mlb.getSchedule(today);
        const game = games.find(g => (g.awayTeam.includes('Nationals') || g.homeTeam.includes('Nationals')));

        if (!game) {
            console.log("No Nationals game found.");
            return;
        }

        const hydrated = await mlb.getHydratedAnalysisData(game);
        
        const analysis = analyzer.analyzeGame(
            game,
            hydrated.details,
            undefined,
            [...hydrated.homeHot, ...hydrated.awayHot],
            [],
            undefined,
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
