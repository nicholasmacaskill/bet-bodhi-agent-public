import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { sendTelegramAlert } from '../src/lib/agent/telegram-notify';

dotenv.config();

const API_KEY = process.env.API_SPORTS_KEY;
if (!API_KEY) {
    console.error("❌ Missing API_SPORTS_KEY in .env");
    process.exit(1);
}

const KBO_LEAGUE_ID = 21; 
const STATE_FILE = path.join(__dirname, '../data/kbo_macro_regime_state.json');
const ALERT_THRESHOLD = 0.5;

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
        headers: { 'x-apisports-key': API_KEY as string }
    });
    
    const data = await res.json();
    
    if (data.errors && Object.keys(data.errors).length > 0) {
        console.error(`❌ API Error for ${dateStr}:`, data.errors);
        return { dateStr, gameCount: 0, completedGames: 0, lateInningLeadChanges: 0 };
    }
    
    let lateInningLeadChanges = 0;
    const games = data.response || [];
    let completedGames = 0;
    
    for (const game of games) {
        const status = game.status?.short;
        if (status === 'FT' || status === 'AOT') {
            completedGames++;
        }
        
        const homeInnings = game.scores?.home?.innings || {};
        const awayInnings = game.scores?.away?.innings || {};
        
        let awayTotal = 0;
        let homeTotal = 0;
        let currentLeader = 'TIE';
        
        const maxInnings = Math.max(Object.keys(homeInnings).length, Object.keys(awayInnings).length, 9);
        
        for (let i = 1; i <= maxInnings; i++) {
            const awayRuns = awayInnings[String(i)] || 0;
            const homeRuns = homeInnings[String(i)] || 0;
            
            if (awayRuns === null && homeRuns === null) continue;

            awayTotal += (awayRuns || 0);
            homeTotal += (homeRuns || 0);
            
            let newLeader = 'TIE';
            if (awayTotal > homeTotal) newLeader = 'AWAY';
            else if (homeTotal > awayTotal) newLeader = 'HOME';
            
            if (newLeader !== currentLeader && currentLeader !== 'TIE' && newLeader !== 'TIE') {
                if (i >= 7) { 
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
    console.log("🏃 Running KBO Macro Regime Daemon...");
    
    let state = { lastUpdated: "", history: [] as any[], currentRollingAvg: 0 };
    if (fs.existsSync(STATE_FILE)) {
        state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = formatDateString(yesterday);

    if (state.lastUpdated === dateStr) {
        console.log(`✅ Already processed data for ${dateStr}. Exiting.`);
        return;
    }

    console.log(`Fetching KBO stats for ${dateStr}...`);
    const dayStats = await fetchDayStats(dateStr);
    
    if (dayStats.gameCount === 0) {
        console.log(`⚠️  No games found or API error. Will not update rolling average.`);
        return;
    }
    
    if (dayStats.completedGames < dayStats.gameCount) {
        console.log(`⚠️  Games are still active. Will not update rolling average yet.`);
        return;
    }

    state.history.push({
        date: dateStr,
        games: dayStats.gameCount,
        lateLeadChanges: dayStats.lateInningLeadChanges
    });
    
    if (state.history.length > 3) {
        state.history.shift(); 
    }
    
    let rollingSum = 0;
    for (const day of state.history) {
        rollingSum += day.lateLeadChanges;
    }
    const rollingAvg = rollingSum / state.history.length;
    
    state.currentRollingAvg = rollingAvg;
    state.lastUpdated = dateStr;

    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    
    console.log(`📊 Current KBO 3-Day Rolling Average: ${rollingAvg.toFixed(2)}`);

    if (state.history.length === 3 && rollingAvg < ALERT_THRESHOLD) {
        console.log(`🚨 ALERT TRIGGERED! KBO Regime Flatlined.`);
        const msg = `🚨 *KBO REGIME_FLATLINED* 🚨\n\nMacro Volatility Index has dropped below threshold.\n` + 
                    `The 3-Day Rolling Average for KBO late-game lead changes is currently *${rollingAvg.toFixed(2)}*.\n\n` + 
                    `*Variance Detected:* Reduce unit sizing via standard percentage reduction. Avoid 'Trailing Favorite' angles until environment expands.`;
        
        await sendTelegramAlert(msg, 'Markdown');
    } else {
        console.log(`✅ KBO Macro environment is healthy. Edge intact.`);
    }
}

main().catch(console.error);
