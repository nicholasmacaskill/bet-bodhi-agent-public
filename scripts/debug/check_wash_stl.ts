
import { MLBApi } from '../../src/lib/mlb-api';
import { NHLApi } from '../../src/lib/nhl-api';

async function main() {
    const mlb = new MLBApi();
    const nhl = new NHLApi();
    const dates = ['2026-03-19', '2026-03-20'];
    
    for (const d of dates) {
        console.log(`--- Checking ${d} ---`);
        const mlbGames = await mlb.getSchedule(d);
        const nhlGames = await nhl.getSchedule(d);
        
        const washStlMLB = mlbGames.find(g => 
            (g.homeTeam.includes('Nationals') || g.awayTeam.includes('Nationals')) && 
            (g.homeTeam.includes('Cardinals') || g.awayTeam.includes('Cardinals'))
        );
        
        const washStlNHL = nhlGames.find(g => 
            (g.homeTeam.includes('Capitals') || g.awayTeam.includes('Capitals')) && 
            (g.homeTeam.includes('Blues') || g.awayTeam.includes('Blues'))
        );

        if (washStlMLB) console.log(`[MLB] ${washStlMLB.awayTeam} @ ${washStlMLB.homeTeam}`);
        if (washStlNHL) console.log(`[NHL] ${washStlNHL.awayTeam} @ ${washStlNHL.homeTeam}`);
        
        if (!washStlMLB && !washStlNHL) console.log("No direct matchup found.");
    }
}

main();
