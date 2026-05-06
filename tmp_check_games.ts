import { MLBApi } from './src/lib/mlb-api';
async function run() {
    const api = new MLBApi();
    const schedule = await api.getSchedule('2026-04-09');
    console.log(`Total games on 2026-04-09: ${schedule.length}`);
    schedule.forEach((g: any) => {
        console.log(`[${g.status}] ${g.awayTeam} @ ${g.homeTeam}`);
    });
}
run();
