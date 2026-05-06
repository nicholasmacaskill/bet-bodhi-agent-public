import { MLBApi } from '../../src/lib/mlb-api';
import 'dotenv/config';

async function verifyStarters() {
    const api = new MLBApi();
    const date = '2026-03-17';
    console.log(`--- MLB STARTER VERIFICATION FOR ${date} ---`);

    try {
        const schedule = await api.getSchedule(date);
        const seattleGames = schedule.filter(g => g.homeTeam.includes("Mariners") || g.awayTeam.includes("Mariners"));
        
        console.log(`Found ${seattleGames.length} Mariners games:`);
        for (const g of seattleGames) {
            console.log(`\nMatchup: ${g.matchup || (g.awayTeam + " @ " + g.homeTeam)}`);
            console.log(`GamePk: ${g.gamePk} | Time: ${g.date}`);
            console.log(`Starters (Hydrated): Away: ${g.probables?.away} | Home: ${g.probables?.home}`);
            
            // Double check via game feed
            const details = await api.getGameDetails(g.gamePk);
            console.log(`Starters (Live Feed): Away: ${details?.probables?.away} | Home: ${details?.probables?.home}`);
        }

    } catch (e: any) {
        console.error("Verification failed:", e.message);
    }
}

verifyStarters();
