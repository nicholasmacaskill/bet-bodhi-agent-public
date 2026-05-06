
import { MLBApi } from '../../src/lib/mlb-api';

async function verify2026() {
    const mlb = new MLBApi();
    const id = await mlb.searchPerson("Bryan Woo");
    
    if (id) {
        console.log(`--- 🔍 WOO STATS: 2026 SPRING TRAINING ---`);
        const url = `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=statsSingleSeason&group=pitching&season=2026&gameType=S`;
        const res = await fetch(url);
        const data = await res.json();
        const stat = data.stats?.[0]?.splits?.[0]?.stat;
        if (stat) {
            console.log(`📡 2026 Type S: ERA: ${stat.era}, WHIP: ${stat.whip}, Innings: ${stat.inningsPitched}`);
        } else {
            console.log(`📡 2026 Type S: No stats found yet.`);
        }
    }
}
verify2026();
