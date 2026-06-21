import '../src/lib/sentry';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { sendTelegramAlert } from '../src/lib/agent/telegram-notify';

const STATE_FILE = path.join(__dirname, '../data/macro_regime_state.json');
const ALERT_THRESHOLD = 0.5;

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
    let completedGames = 0;
    
    for (const event of games) {
        if (!event.competitions || event.competitions.length === 0) continue;
        
        const comp = event.competitions[0];
        const status = event.status?.type?.state;
        if (status === 'post') {
            completedGames++;
        }
        
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
        completedGames,
        lateInningLeadChanges
    };
}

async function main() {
    console.log("🏃 Running Macro Regime Daemon...");
    
    // Read state
    let state = { lastUpdated: "", history: [] as any[], currentRollingAvg: 0 };
    if (fs.existsSync(STATE_FILE)) {
        state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }

    // Usually run for yesterday's completed games to ensure full slate is done
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = formatDateString(yesterday);
    const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

    if (state.lastUpdated === formattedDate) {
        console.log(`✅ Already processed data for ${formattedDate}. Exiting.`);
        return;
    }

    console.log(`Fetching stats for ${formattedDate}...`);
    const dayStats = await fetchDayStats(dateStr);
    
    // Only update if all games are completed
    if (dayStats.completedGames < dayStats.gameCount && dayStats.gameCount > 0) {
        console.log(`⚠️  Games are still active. Will not update rolling average yet.`);
        return;
    }

    // Keep history at 3 days max
    state.history.push({
        date: formattedDate,
        games: dayStats.gameCount,
        lateLeadChanges: dayStats.lateInningLeadChanges
    });
    
    if (state.history.length > 3) {
        state.history.shift(); // Remove oldest
    }
    
    // Compute rolling average
    let rollingSum = 0;
    for (const day of state.history) {
        rollingSum += day.lateLeadChanges;
    }
    const rollingAvg = rollingSum / state.history.length;
    
    state.currentRollingAvg = rollingAvg;
    state.lastUpdated = formattedDate;

    // Save state
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    
    console.log(`📊 Current 3-Day Rolling Average: ${rollingAvg.toFixed(2)}`);

    // Alert if threshold breached
    if (state.history.length === 3 && rollingAvg < ALERT_THRESHOLD) {
        console.log(`🚨 ALERT TRIGGERED! Regime Flatlined.`);
        const msg = `🚨 *REGIME_FLATLINED* 🚨\n\nMacro Volatility Index has dropped below threshold.\n` + 
                    `The 3-Day Rolling Average for late-game lead changes is currently *${rollingAvg.toFixed(2)}*.\n\n` + 
                    `*Variance Detected:* Reduce unit sizing via standard percentage reduction. Avoid 'Trailing Favorite' angles until environment expands.`;
        
        await sendTelegramAlert(msg, 'Markdown');
    } else {
        console.log(`✅ Macro environment is healthy. Edge intact.`);
    }
}

main().catch(console.error);
