import fetch from 'node-fetch';

/**
 * Macro Regime Shift Architecture: Historical Backtester
 * 
 * Verifies the "League Volatility Index" by iterating over the last 14 days
 * and calculating the 3-day rolling average of late-inning (7th, 8th, 9th) 
 * lead changes.
 */

function formatDateString(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
}

async function fetchDayStats(dateStr: string) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateStr}`;
    const res = await fetch(url);
    const data = await res.json();
    
    let lateInningLeadChanges = 0;
    const games = data.events || [];
    
    for (const event of games) {
        if (!event.competitions || event.competitions.length === 0) continue;
        
        const comp = event.competitions[0];
        const away = comp.competitors.find((c: any) => c.homeAway === 'away');
        const home = comp.competitors.find((c: any) => c.homeAway === 'home');
        
        if (!away || !home) continue;

        const awayScores = away.linescores || [];
        const homeScores = home.linescores || [];
        
        let awayTotal = 0;
        let homeTotal = 0;
        let currentLeader = 'TIE';
        
        const maxInnings = Math.max(awayScores.length, homeScores.length);
        
        for (let i = 0; i < maxInnings; i++) {
            const awayRuns = awayScores[i]?.value || 0;
            const homeRuns = homeScores[i]?.value || 0;
            
            awayTotal += awayRuns;
            homeTotal += homeRuns;
            
            let newLeader = 'TIE';
            if (awayTotal > homeTotal) newLeader = 'AWAY';
            else if (homeTotal > awayTotal) newLeader = 'HOME';
            
            // Only count if it flipped from one leader to another, or from a tie to a lead.
            if (newLeader !== currentLeader && currentLeader !== 'TIE' && newLeader !== 'TIE') {
                if (i >= 6) { // 7th inning or later
                    lateInningLeadChanges++;
                }
            }
            currentLeader = newLeader;
        }
    }
    
    return {
        dateStr,
        gameCount: games.length,
        lateInningLeadChanges
    };
}

async function main() {
    console.log("=========================================");
    console.log("   MACRO REGIME SHIFT BACKTESTER (MLB)   ");
    console.log("=========================================\n");

    const stats = [];
    const today = new Date('2026-06-11T00:00:00Z');
    
    for (let i = 14; i >= 1; i--) {
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() - i);
        const dateStr = formatDateString(targetDate);
        
        const dayStat = await fetchDayStats(dateStr);
        stats.push(dayStat);
    }
    
    console.log("DATE       | GAMES | LATE CHANGES | 3-DAY ROLLING AVG");
    console.log("-----------------------------------------------------");
    
    for (let i = 0; i < stats.length; i++) {
        const current = stats[i];
        
        let rollingSum = 0;
        let daysCount = 0;
        
        // Look back 3 days including current
        for (let j = 0; j < 3; j++) {
            if (i - j >= 0) {
                rollingSum += stats[i - j].lateInningLeadChanges;
                daysCount++;
            }
        }
        
        const rollingAvg = rollingSum / daysCount;
        
        const dateFormatted = `${current.dateStr.slice(0, 4)}-${current.dateStr.slice(4, 6)}-${current.dateStr.slice(6, 8)}`;
        const gamesStr = String(current.gameCount).padEnd(5);
        const changesStr = String(current.lateInningLeadChanges).padEnd(12);
        
        // Add a visual indicator if it drops below 0.5
        let alertMarker = "";
        if (daysCount === 3 && rollingAvg < 0.5) {
            alertMarker = " 🚨 REGIME_FLATLINED";
        }
        
        console.log(`${dateFormatted} | ${gamesStr} | ${changesStr} | ${rollingAvg.toFixed(2)}${alertMarker}`);
    }
    console.log("\nDone.");
}

main().catch(console.error);
