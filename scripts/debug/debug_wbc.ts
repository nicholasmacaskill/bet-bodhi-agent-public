import { MLBApi } from '../../src/lib/mlb-api';

async function checkWBC() {
    const baseUrl = 'https://statsapi.mlb.com/api/v1';
    const date = '2026-03-10';
    // Let's try multiple sportIds commonly associated with international/WBC
    const sportIds = [51, 1, 10, 11]; 
    
    for (const sportId of sportIds) {
        const url = `${baseUrl}/schedule?sportId=${sportId}&date=${date}&hydrate=team,lineups,probablePitcher,venue`;
        console.log(`Checking sportId ${sportId}...`);
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.dates && data.dates.length > 0) {
                console.log(`Found ${data.dates[0].games.length} games for sportId ${sportId}:`);
                data.dates[0].games.forEach((g: any) => {
                    console.log(`- ${g.teams.away.team.name} vs ${g.teams.home.team.name}`);
                });
            }
        } catch (e) {
            console.error(`Error checking sportId ${sportId}:`, e);
        }
    }
}

checkWBC();
