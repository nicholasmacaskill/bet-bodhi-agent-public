
import 'dotenv/config';
import { MLBApi } from '../src/lib/mlb-api';
import { NHLApi } from '../src/lib/nhl-api';
import { NBAApi } from '../src/lib/nba-api';

async function listToday() {
    const mlb = new MLBApi();
    const nhl = new NHLApi();
    const nba = new NBAApi();
    const today = '2026-03-17';
    const nbaDate = '20260317';

    console.log(`\n📅 SLATE FOR ${today}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
        const [mlbSchedule, nhlSchedule, nbaSchedule] = await Promise.all([
            mlb.getSchedule(today).catch(() => []),
            nhl.getSchedule(today).catch(() => []),
            nba.getSchedule(nbaDate).catch(() => [])
        ]);

        if (mlbSchedule && mlbSchedule.length > 0) {
            console.log(`\n⚾ MLB (${mlbSchedule.length} games):`);
            mlbSchedule.slice(0, 10).forEach(g => console.log(`   - ${g.awayTeam} @ ${g.homeTeam} (${g.status})`));
        } else {
            console.log(`\n⚾ MLB: No games found for today.`);
        }

        if (nhlSchedule && nhlSchedule.length > 0) {
            console.log(`\n🏒 NHL (${nhlSchedule.length} games):`);
            nhlSchedule.slice(0, 10).forEach(g => console.log(`   - ${g.awayTeam} @ ${g.homeTeam} (${g.status})`));
        } else {
            console.log(`\n🏒 NHL: No games found for today.`);
        }

        if (nbaSchedule && nbaSchedule.length > 0) {
            console.log(`\n🏀 NBA (${nbaSchedule.length} games):`);
            nbaSchedule.slice(0, 10).forEach(g => console.log(`   - ${g.awayTeam} @ ${g.homeTeam} (${g.status})`));
        } else {
            console.log(`\n🏀 NBA: No games found for today.`);
        }

    } catch (e) {
        console.error("Failed to fetch schedule:", e);
    }
}

listToday();
