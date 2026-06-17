import fetch from 'node-fetch';

async function main() {
    const dateStr = '20260605';
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateStr}`;
    const res = await fetch(url);
    const data = await res.json();
    
    console.log(`Found ${data.events?.length} MLB games.`);
    
    let totalLateInningLeadChanges = 0;
    
    for (const event of data.events) {
        const comp = event.competitions[0];
        const away = comp.competitors.find((c: any) => c.homeAway === 'away');
        const home = comp.competitors.find((c: any) => c.homeAway === 'home');
        
        console.log(`${away.team.abbreviation} @ ${home.team.abbreviation}`);
        
        // linescores is an array of objects: { value: number }
        const awayScores = away.linescores || [];
        const homeScores = home.linescores || [];
        
        let awayTotal = 0;
        let homeTotal = 0;
        let currentLeader = 'TIE';
        
        let leadChanges = 0;
        let lateLeadChanges = 0;
        
        const maxInnings = Math.max(awayScores.length, homeScores.length);
        
        for (let i = 0; i < maxInnings; i++) {
            const awayRuns = awayScores[i]?.value || 0;
            const homeRuns = homeScores[i]?.value || 0;
            
            awayTotal += awayRuns;
            homeTotal += homeRuns;
            
            let newLeader = 'TIE';
            if (awayTotal > homeTotal) newLeader = 'AWAY';
            else if (homeTotal > awayTotal) newLeader = 'HOME';
            
            if (newLeader !== currentLeader && currentLeader !== 'TIE' && newLeader !== 'TIE') {
                leadChanges++;
                // Inning i is 0-indexed. 7th inning is i=6, 8th is i=7, 9th is i=8.
                if (i >= 6) {
                    lateLeadChanges++;
                }
            }
            currentLeader = newLeader;
        }
        
        console.log(`  └ Total Lead Changes: ${leadChanges} | Late Lead Changes (7th+): ${lateLeadChanges}`);
        totalLateInningLeadChanges += lateLeadChanges;
    }
    
    console.log(`\nMLB Total Late-Inning Lead Changes on ${dateStr}: ${totalLateInningLeadChanges}`);
}

main().catch(console.error);
