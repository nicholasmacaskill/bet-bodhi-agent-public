import { MLBApi } from '../src/lib/mlb-api';

async function main() {
    const api = new MLBApi();
    const games = await api.getSchedule('2026-05-28');
    console.log(`Total games on 2026-05-28: ${games.length}`);
    games.forEach((g: any) => console.log(`${g.awayTeam} @ ${g.homeTeam} (${g.status})`));
}
main().catch(console.error);
