
import { MLBApi } from '../../src/lib/mlb-api';

async function verifyDetailed() {
    const mlb = new MLBApi();
    const id = await mlb.searchPerson("Bryan Woo");
    
    if (id) {
        console.log(`--- 🔍 WOO STATS: REGULAR vs SPRING ---`);
        for (const type of ['R', 'S']) {
            const url = `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=statsSingleSeason&group=pitching&season=2024&gameType=${type}`;
            const res = await fetch(url);
            const data = await res.json();
            const stat = data.stats?.[0]?.splits?.[0]?.stat;
            if (stat) {
                console.log(`📡 2024 Type ${type}: ERA: ${stat.era}, WHIP: ${stat.whip}, Innings: ${stat.inningsPitched}`);
            }
        }
    }
}
verifyDetailed();
