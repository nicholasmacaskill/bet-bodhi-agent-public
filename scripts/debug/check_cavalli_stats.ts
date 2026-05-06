
import { MLBApi } from '../../src/lib/mlb-api';

async function main() {
    const api = new MLBApi();
    const name = "Cade Cavalli";

    try {
        const id = await api.searchPerson(name);
        if (id) {
            const stats = await api.getPlayerStats(id, 'pitching', '2026');
            console.log(JSON.stringify(stats, null, 2));
        } else {
            console.log(`Could not find ID for ${name}`);
        }
    } catch (e: any) {
        console.error("Failed to fetch stats for Cavalli:", e.message);
    }
}

main();
