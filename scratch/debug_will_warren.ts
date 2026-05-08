import { MLBApi } from '../src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const id = await mlb.searchPerson('Will Warren');
    console.log('Will Warren ID:', id);

    if (id) {
        const stats2024 = await mlb.getPlayerStats(id, 'pitching', '2024', 'R');
        console.log('2024 Stats:', stats2024);

        const stats2025 = await mlb.getPlayerStats(id, 'pitching', '2025', 'R');
        console.log('2025 Stats:', stats2025);
        
        const stats2026S = await mlb.getPlayerStats(id, 'pitching', '2026', 'S');
        console.log('2026 Spring Stats:', stats2026S);
    }
}

main();
