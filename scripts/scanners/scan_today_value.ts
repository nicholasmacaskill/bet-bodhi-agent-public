import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';

async function main() {
    const mlb = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const today = '2026-03-28';
    console.log(`Scanning MLB slate for ${today}...`);

    try {
        const games = await mlb.getSchedule(today);
        const results: any[] = [];

        for (const game of games) {
            // Only analyze games that haven't started or are still in early innings
            if (game.status.includes('Final') || game.status.includes('Postponed')) continue;

            try {
                const hydrated = await mlb.getHydratedAnalysisData(game);
                const analysis = analyzer.analyzeGame(
                    game,
                    hydrated.details,
                    undefined, // no polyMarket data for bulk yet
                    [...hydrated.homeHot, ...hydrated.awayHot],
                    [],
                    undefined,
                    464, // bankroll
                    "Ready",
                    8,
                    hydrated.rosters
                );

                results.push(analysis);
            } catch (e) {
                // skip failed games
            }
        }

        // Sort by Confidence and technical strength
        results.sort((a, b) => b.overallConfidence - a.overallConfidence);

        console.log(`\n=============================================================`);
        console.log(`        BODHI TOP VALUE PICKS - MARCH 28, 2026              `);
        console.log(`=============================================================`);

        results.slice(0, 5).forEach((r, i) => {
            console.log(`\n${i + 1}. ${r.awayTeam} @ ${r.homeTeam}`);
            console.log(`   Confidence: ${r.overallConfidence}% | Side: ${r.valueTeam || 'Neutral'}`);
            console.log(`   Recommendation: ${r.recommendedAction}`);
            console.log(`   Pitchers: ${r.awayPitcher} vs ${r.homePitcher}`);
            console.log(`   Bodhi Edge: ${r.matchupNotes}`);
            if (r.advantages && r.advantages.length > 0) {
                console.log(`   Key Advantages:`);
                r.advantages.slice(0, 2).forEach((adv: string) => console.log(`    - ${adv}`));
            }
        });
        console.log(`\n=============================================================`);

    } catch (e) {
        console.error(e);
    }
}

main();
