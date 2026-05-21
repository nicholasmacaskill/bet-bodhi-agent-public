import 'dotenv/config';
import { MLBApi } from '../src/lib/mlb-api';

async function test() {
    const api = new MLBApi();
    const id = await api.searchPerson("Jesús Luzardo");
    console.log("ID found for Jesús Luzardo:", id);
    if (id) {
        const stats2026Reg = await api.getPlayerStats(id, 'pitching', '2026', 'R');
        console.log("2026 Regular Season Stats:", stats2026Reg);
    }
}

test();
