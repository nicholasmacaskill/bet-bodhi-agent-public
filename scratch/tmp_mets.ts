import { MLBApi } from './src/lib/mlb-api';
async function run() {
    const api = new MLBApi();
    const schedule = await api.getSchedule('2026-04-07');
    const game = schedule.find((g: any) => g.homeTeam.includes('Mets') || g.awayTeam.includes('Mets') || g.homeTeam.includes('New York') && !g.homeTeam.includes('Yankees'));
    console.log(JSON.stringify(game?.probables, null, 2));
}
run();
