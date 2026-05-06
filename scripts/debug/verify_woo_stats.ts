
import { MLBApi } from '../../src/lib/mlb-api';

async function verify() {
    const mlb = new MLBApi();
    const p1 = "Bryan Woo";
    const id = await mlb.searchPerson(p1);
    
    if (id) {
        console.log(`--- 🔍 VERIFYING BRYAN WOO STATS ---`);
        for (const season of ['2023', '2024', '2025']) {
            const stats = await mlb.getPlayerStats(id, 'pitching', season);
            if (stats) {
                console.log(`📡 Season ${season}: ERA: ${stats.era}, WHIP: ${stats.whip}, Innings: ${stats.inningsPitched}`);
            } else {
                console.log(`📡 Season ${season}: No stats found.`);
            }
        }
    }
}
verify();
