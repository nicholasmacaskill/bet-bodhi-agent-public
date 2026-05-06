
import * as fs from 'fs';

async function hydrate2025Starters() {
    const schedule = JSON.parse(fs.readFileSync('data/2025_schedule.json', 'utf8'));
    const results = JSON.parse(fs.readFileSync('data/2025_results.json', 'utf8'));
    const hydratedPath = 'data/2025_hydrated_starters.json';
    
    let hydrated = [];
    if (fs.existsSync(hydratedPath)) {
        hydrated = JSON.parse(fs.readFileSync(hydratedPath, 'utf8'));
    }
    
    const hydratedIds = new Set(hydrated.map(h => h.id));
    console.log(`Resuming hydration for ${schedule.length - hydrated.length} games...`);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < schedule.length; i++) {
        const g = schedule[i];
        if (hydratedIds.has(g.id)) continue;

        try {
            const boxRes = await fetch(`https://statsapi.mlb.com/api/v1/game/${g.id}/boxscore`);
            const box = await boxRes.json();
            
            const homeStarterId = box.teams.home.pitchers[0];
            const awayStarterId = box.teams.away.pitchers[0];

            if (homeStarterId && awayStarterId) {
                hydrated.push({
                    id: g.id,
                    date: g.date,
                    homeId: g.homeId,
                    awayId: g.awayId,
                    homeStarterId,
                    awayStarterId,
                    winner: results.find(r => r.id === g.id)?.winner
                });
            }
            
            if (hydrated.length % 50 === 0) {
                console.log(`Hydrated ${hydrated.length}/${schedule.length}...`);
                fs.writeFileSync(hydratedPath, JSON.stringify(hydrated, null, 2));
            }
            
            // Minimal sleep to avoid rate limits
            await sleep(100);

        } catch (e) {
            console.error(`Error hydrating ${g.id}:`, e.message);
        }
    }
    
    fs.writeFileSync(hydratedPath, JSON.stringify(hydrated, null, 2));
    console.log('Final Hydration Complete.');
}

hydrate2025Starters();
