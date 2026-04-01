import { MLBApi } from './src/lib/mlb-api';
import { PillarAnalyzer } from './src/lib/pillar-analyzer';

async function main() {
    const mlb = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const today = '2026-03-29';
    console.log(`Scanning MLB slate for ${today}...`);

    try {
        const games = await mlb.getSchedule(today);
        const results: any[] = [];

        for (const game of games) {
            // Include in-progress games too, but flag them
            try {
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

                results.push({ ...analysis, gameStatus: game.status });
            } catch (e) {
                // skip
            }
        }

        results.sort((a, b) => b.overallConfidence - a.overallConfidence);

        console.log(`\n=============================================================`);
        console.log(`        BODHI TOP VALUE PICKS - MARCH 29, 2026              `);
        console.log(`=============================================================`);

        results.slice(0, 10).forEach((r, i) => {
            console.log(`\n${i + 1}. ${r.awayTeam} @ ${r.homeTeam} (${r.gameStatus})`);
            console.log(`   Confidence: ${r.overallConfidence}% | Side: ${r.valueTeam || 'Neutral'}`);
            console.log(`   Recommendation: ${r.recommendedAction}`);
            console.log(`   Pitchers: ${r.awayPitcher} vs ${r.homePitcher}`);
            console.log(`   Bodhi Edge: ${r.matchupNotes}`);
        });

    } catch (e) {
        console.error(e);
    }
}

main();
