import { MLBApi } from './src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-29';
    
    // Explicitly check the schedule response
    const schedule = await mlb.getSchedule(today);
    console.log(`Found ${schedule.length} games.`);
    
    schedule.forEach(g => {
        console.log(`- ${g.awayTeam} @ ${g.homeTeam}: ${g.status}`);
    });
}

main();
