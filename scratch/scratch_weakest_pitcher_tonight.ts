import { MLBApi } from './src/lib/mlb-api';

async function checkRemainingGames() {
    const mlb = new MLBApi();
    const today = new Date().toISOString().split('T')[0]; // "2026-04-13" (depending on UTC, it might be 14th)
    // Actually let's use the hardcoded date for the slate just in case
    const slateDate = "2026-04-14";
    
    console.log(`Fetching schedule for ${slateDate}...`);
    const schedule = await mlb.getSchedule(slateDate);
    
    const remaining = schedule.filter(g => g.status !== 'Final' && g.status !== 'Completed' && g.status !== 'Game Over');
    
    console.log(`Found ${remaining.length} games not yet final.`);
    
    for (const game of remaining) {
        console.log(`- ${game.awayTeam} @ ${game.homeTeam} | Status: ${game.status} | Home Pitcher: ${game.probables?.home || 'TBD'} | Away Pitcher: ${game.probables?.away || 'TBD'} | Date: ${game.date}`);
    }
}

checkRemainingGames().catch(console.error);
