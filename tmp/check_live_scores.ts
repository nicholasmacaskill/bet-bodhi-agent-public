
import { MLBApi } from '../src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-04-04';
    const games = await mlb.getSchedule(today);
    
    console.log(`\nLIVE SCOREBOARD - ${today}`);
    console.log(`-----------------------------------`);
    games.forEach(g => {
        console.log(`${g.awayTeam} @ ${g.homeTeam}: ${g.status}`);
        if (g.score) {
            console.log(`   SCORE: ${g.score}`);
        }
        console.log(`-----------------------------------`);
    });
}

main();
