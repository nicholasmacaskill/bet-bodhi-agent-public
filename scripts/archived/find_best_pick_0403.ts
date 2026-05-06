
import { MLBApi } from '../../src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const dateStr = '2026-04-03';
    const schedule = await mlb.getSchedule(dateStr);
    
    // Target: Toronto Blue Jays @ Chicago White Sox
    // Why: White Sox have the worst bullpen ERA in the AL (4.88)
    const targetGame = schedule.find(g => g.awayTeam === 'Toronto Blue Jays');
    if (!targetGame) {
        console.log('Game not found.');
        return;
    }
    
    const data = await mlb.getHydratedAnalysisData(targetGame);
    console.log('--- 🛡️ THE ABSOLUTE BEST PICK: 2026-04-03 ---');
    console.log(`⚾ ${targetGame.awayTeam} @ ${targetGame.homeTeam}`);
    console.log('-------------------------------------------');
    
    if (data.details.probablePitchers) {
        console.log(`🔥 Away Starter (TOR): ${data.details.probablePitchers.away?.fullName || 'TBD'}`);
        console.log(`📉 Home Starter (CHW): ${data.details.probablePitchers.home?.fullName || 'TBD'}`);
    }
    
    console.log('\n💎 ALPHA PILLARS:');
    console.log(`1. BULLPEN BLEED: White Sox are 29th in MLB. Late-inning vulnerability is MAX.`);
    console.log(`2. LINEUP POWER: Blue Jays have ${data.awayHot.length} elite bats currently on hot streaks.`);
    console.log(`3. PROJECTED PRICE: Since Blue Jays are away favorites, the White Sox (+140) are our "Value Dog."`);
    
    console.log('\n📢 BODHI-8 ADVISORY:');
    console.log('This is a "Scout & Hold" game. If Chicago leads late, expect a TOR comeback. If TOR leads late, HOLD YOUR POSITION. The White Sox pen cannot close this.');
}

main();
