
import { MLBApi } from '../../src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-04-03';
    const games = await mlb.getSchedule(today);
    
    console.log(`\n⚾ MLB SLATE — ${today}`);
    for (const g of games) {
        console.log(`${g.awayTeam} @ ${g.homeTeam} | Status: ${g.status}`);
        if (g.homeTeam.includes("New York") || g.awayTeam.includes("New York")) {
            console.log(`   🚨 PITCHERS: ${g.probables?.away || 'TBD'} vs ${g.probables?.home || 'TBD'}`);
        }
    }
}
main();
