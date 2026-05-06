import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';

async function main() {
    const mlb = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const today = '2026-03-28';
    
    const targets = ['Padres', 'Mariners', 'Dodgers', 'Giants', 'Brewers', 'Braves', 'Astros'];

    try {
        const games = await mlb.getSchedule(today);
        const results: any[] = [];

        for (const game of games) {
            if (game.status.includes('Final')) continue;
            if (!targets.some(t => game.awayTeam.includes(t) || game.homeTeam.includes(t))) continue;

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
            results.push(analysis);
        }

        results.sort((a, b) => b.overallConfidence - a.overallConfidence);

        console.log(`\n--- TOP LATE NIGHT LEANS - MARCH 28 (21:30) ---`);
        results.forEach((r, i) => {
            console.log(`\n${i + 1}. ${r.awayTeam} @ ${r.homeTeam} (${r.overallConfidence}%)`);
            console.log(`   Signal: ${r.recommendedAction}`);
            console.log(`   Edge: ${r.matchupNotes}`);
        });

    } catch (e) {
        console.error(e);
    }
}

main();
