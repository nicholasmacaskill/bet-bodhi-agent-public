
import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';

async function main() {
    const mlb = new MLBApi();
    const pillar = new PillarAnalyzer();
    const today = '2026-04-04';
    const games = await mlb.getSchedule(today);
    
    const targets = [
        { away: 'Chicago Cubs', home: 'Cleveland Guardians' },
        { away: 'Atlanta Braves', home: 'Arizona Diamondback' },
        { away: 'Seattle Mariners', home: 'Los Angeles Angel' }
    ];

    console.log(`--- 🕵️ DEEP SCAN: SATURDAY APRIL 4, 2026 ---`);

    for (const target of targets) {
        const game = games.find(g => g.awayTeam.includes(target.away) || g.homeTeam.includes(target.home));
        if (game) {
            const data = await mlb.getHydratedAnalysisData(game);
            const analysis = pillar.analyzeGame(game, data.details, undefined, data.homeHot.concat(data.awayHot), [], data.playerStats);
            console.log(`\n⚾ ${game.awayTeam} @ ${game.homeTeam}`);
            console.log(`   🔸 Matchup: ${analysis.awayPitcher} vs ${analysis.homePitcher}`);
            console.log(`   🔸 BODHI-8 Score: ${analysis.overallConfidence.toFixed(1)}%`);
            console.log(`   🔸 Value Team: ${analysis.valueTeam}`);
            console.log(`   ✅ Advantages:`);
            analysis.advantages?.slice(0, 3).forEach(a => console.log(`      ├─ ${a}`));
        }
    }
}
main();
