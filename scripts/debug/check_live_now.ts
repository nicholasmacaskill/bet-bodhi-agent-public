
import { MLBApi } from '../../src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-04-03';
    const games = await mlb.getSchedule(today);
    
    console.log(`\n🏟️  LIVE MLB SCOREBOARD — ${today}`);
    console.log(`──────────────────────────────────────────────────────────────────────\n`);

    const liveGames = games.filter(g => g.status === 'In Progress' || g.status.includes('Live'));

    if (liveGames.length === 0) {
        console.log("No games are currently live.");
        return;
    }

    for (const g of liveGames) {
        // Fetch details for more precise score/inning if available
        const details = await mlb.getGameDetails(g.gamePk);
        const score = g.score || "TBD";
        console.log(`⚾ ${g.awayTeam} @ ${g.homeTeam}`);
        console.log(`   🔸 Score: ${score}`);
        console.log(`   🔸 Status: ${g.status}`);
        console.log(`   🔸 Pitching: ${g.probables?.away || 'Unknown'} vs ${g.probables?.home || 'Unknown'}\n`);
    }
}
main();
