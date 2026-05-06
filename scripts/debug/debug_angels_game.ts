
import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';

async function main() {
    const mlb = new MLBApi();
    const pillar = new PillarAnalyzer();
    const today = '2026-04-03';
    const games = await mlb.getSchedule(today);
    const game = games.find(g => g.awayTeam === 'Seattle Mariners' || g.homeTeam === 'Los Angeles Angels');
    
    if (!game) {
        console.log("Angels game not found.");
        return;
    }

    const data = await mlb.getHydratedAnalysisData(game);
    const analysis = pillar.analyzeGame(game, data.details, undefined, data.homeHot.concat(data.awayHot), [], undefined, 1000, 'Neutral', 8, data.rosters);

    console.log(`\n⚾ BREAKDOWN: ${game.awayTeam} @ ${game.homeTeam}`);
    console.log(`-------------------------------------------`);
    console.log(`Starter Matchup: ${analysis.awayPitcher} vs ${analysis.homePitcher}`);
    console.log(`BODHI-8 Score: ${analysis.overallConfidence.toFixed(1)}%`);
    
    console.log(`\n📋 ROSTER METRICS:`);
    console.log(`   🏠 Angels Hot Bats: ${data.homeHot.join(', ') || 'None'}`);
    console.log(`   ✈️  Mariners Hot Bats: ${data.awayHot.join(', ') || 'None'}`);
    
    console.log(`\n📢 PILLAR ANALYSIS:`);
    analysis.pillars.forEach(p => console.log(`   ├─ ${p.pillar}: ${p.score}/10 (${p.reason})`));
    
    console.log(`\n✅ ADVANTAGES:`);
    analysis.advantages?.forEach(a => console.log(`   ├─ ${a}`));
}
main();
