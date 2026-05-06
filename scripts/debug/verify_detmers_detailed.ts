
import { MLBApi } from '../../src/lib/mlb-api';

async function verifyDetmers() {
    const mlb = new MLBApi();
    const id = await mlb.searchPerson("Reid Detmers");
    
    if (id) {
        console.log(`--- 🔍 DETMERS STATS: REGULAR vs SPRING ---`);
        for (const type of ['R', 'S']) {
            for (const season of ['2023', '2024', '2025', '2026']) {
                const url = `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=statsSingleSeason&group=pitching&season=${season}&gameType=${type}`;
                const res = await fetch(url);
                const data = await res.json();
                const stat = data.stats?.[0]?.splits?.[0]?.stat;
                if (stat) {
                    console.log(`📡 ${season} Type ${type}: ERA: ${stat.era}, WHIP: ${stat.whip}, Innings: ${stat.inningsPitched}`);
                }
            }
        }
    }
}
verifyDetmers();
