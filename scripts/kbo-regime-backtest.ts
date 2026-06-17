import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.API_SPORTS_KEY;
if (!API_KEY) {
    console.error("❌ Missing API_SPORTS_KEY in .env");
    process.exit(1);
}

// 21 is typically the API-Sports ID for KBO (South Korea)
// If it changes, update this const.
const KBO_LEAGUE_ID = 21; 

function formatDateString(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

async function fetchDayStats(dateStr: string) {
    const url = `https://v1.baseball.api-sports.io/games?date=${dateStr}&league=${KBO_LEAGUE_ID}`;
    
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'x-apisports-key': API_KEY as string
        }
    });
    
    const data = await res.json();
    
    if (data.errors && Object.keys(data.errors).length > 0) {
        console.error(`❌ API Error for ${dateStr}:`, data.errors);
        return { dateStr, gameCount: 0, lateInningLeadChanges: 0 };
    }

    let lateInningLeadChanges = 0;
    const games = data.response || [];
    
    for (const game of games) {
        // Only count finished games
        if (game.status?.short !== 'FT' && game.status?.short !== 'AOT') continue;

        const homeInnings = game.scores?.home?.innings || {};
        const awayInnings = game.scores?.away?.innings || {};
        
        let awayTotal = 0;
        let homeTotal = 0;
        let currentLeader = 'TIE';
        
        // Baseball typically has 9 innings, maybe extra
        const maxInnings = Math.max(Object.keys(homeInnings).length, Object.keys(awayInnings).length, 9);
        
        for (let i = 1; i <= maxInnings; i++) {
            const awayRuns = awayInnings[String(i)] || 0;
            const homeRuns = homeInnings[String(i)] || 0;
            
            // Note: API-Sports might return null for unplayed innings
            if (awayRuns === null && homeRuns === null) continue;

            awayTotal += (awayRuns || 0);
            homeTotal += (homeRuns || 0);
            
            let newLeader = 'TIE';
            if (awayTotal > homeTotal) newLeader = 'AWAY';
            else if (homeTotal > awayTotal) newLeader = 'HOME';
            
            // Only count if it flipped from one leader to another, or from a tie to a lead.
            if (newLeader !== currentLeader && currentLeader !== 'TIE' && newLeader !== 'TIE') {
                if (i >= 7) { // 7th inning or later
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
    console.log("   MACRO REGIME SHIFT BACKTESTER (KBO)   ");
    console.log("=========================================\n");

    const stats = [];
    const today = new Date('2026-06-11T00:00:00Z'); // Baseline from prompt
    
    for (let i = 14; i >= 1; i--) {
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() - i);
        const dateStr = formatDateString(targetDate);
        
        const dayStat = await fetchDayStats(dateStr);
        stats.push(dayStat);
        
        // Rate limit protection: API-sports allows ~10 req/second on free tier, but play it safe.
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log("DATE       | KBO GAMES | LATE CHANGES | 3-DAY ROLLING AVG");
    console.log("---------------------------------------------------------");
    
    for (let i = 0; i < stats.length; i++) {
        const current = stats[i];
        
        let rollingSum = 0;
        let daysCount = 0;
        
        for (let j = 0; j < 3; j++) {
            if (i - j >= 0) {
                rollingSum += stats[i - j].lateInningLeadChanges;
                daysCount++;
            }
        }
        
        const rollingAvg = rollingSum / daysCount;
        
        const gamesStr = String(current.gameCount).padEnd(9);
        const changesStr = String(current.lateInningLeadChanges).padEnd(12);
        
        let alertMarker = "";
        if (daysCount === 3 && rollingAvg < 0.5) {
            alertMarker = " 🚨 REGIME_FLATLINED";
        }
        
        console.log(`${current.dateStr} | ${gamesStr} | ${changesStr} | ${rollingAvg.toFixed(2)}${alertMarker}`);
    }
    console.log("\nDone.");
}

main().catch(console.error);
