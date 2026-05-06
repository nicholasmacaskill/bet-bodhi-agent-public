import { MLBApi } from './src/lib/mlb-api';

async function run() {
    const api = new MLBApi();
    const id = await api.searchPerson('Freddy Peralta');
    if (!id) {
        console.log("Could not find Freddy Peralta");
        return;
    }
    const [reg, spr] = await Promise.all([
        api.getPlayerStats(id, 'pitching', '2024', 'R'),
        api.getPlayerStats(id, 'pitching', '2026', 'S')
    ]);
    console.log("Freddy Peralta Stats:");
    console.log("2024 Regular Season ERA:", reg?.era, "xERA approximations not in this endpoint but we can see ERA");
    console.log("2026 Spring Training ERA:", spr?.era);
    console.log("All 2024 Reg Stats:", JSON.stringify(reg, null, 2));
}
run();
