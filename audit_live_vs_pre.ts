
import * as fs from 'fs';
import { MLBApi } from './src/lib/mlb-api';

async function auditLiveVsPre() {
    const csvPath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-03-31.csv';
    const mlbApi = new MLBApi();
    
    if (!fs.existsSync(csvPath)) return;
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() !== '');

    interface Market {
        name: string;
        firstBuy: number;
        staked: number;
        returned: number;
        isSport: boolean;
        date: string;
    }

    const markets: Record<string, Market> = {};
    const gameDateCache: Record<string, string> = {};

    lines.slice(1).forEach(line => {
        const p = [];
        let cur = '';
        let q = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '\"') q = !q;
            else if (line[i] === ',' && !q) { p.push(cur); cur = ''; }
            else cur += line[i];
        }
        p.push(cur);

        const mName = p[0];
        const action = p[1];
        const amount = parseFloat(p[2] || '0');
        const ts = parseInt(p[5] || '0');

        if (!/vs\./.test(mName) || /Bitcoin|Solana/.test(mName)) return;

        if (!markets[mName]) {
            markets[mName] = { name: mName, firstBuy: ts, staked: 0, returned: 0, isSport: true, date: '' };
        }

        if (action === 'Buy') {
            markets[mName].staked += amount;
            if (ts < markets[mName].firstBuy) markets[mName].firstBuy = ts;
        } else if (action === 'Sell' || action === 'Redeem') {
            markets[mName].returned += amount;
        }
    });

    const SEASON_START = 1774569600;
    const results = {
        spring: { pre: { count: 0, pnl: 0 }, live: { count: 0, pnl: 0 } },
        season: { pre: { count: 0, pnl: 0 }, live: { count: 0, pnl: 0 } }
    };

    console.log("Analyzing 50+ sports markets for Live vs Pre-Game audit...");

    for (const m of Object.values(markets)) {
        // Find the date from timestamp to help MLB API
        const d = new Date(m.firstBuy * 1000).toISOString().split('T')[0];
        
        try {
            // Check if it's a live bet by comparing timestamp to schedule
            const schedule = await mlbApi.getSchedule(d);
            const teamNames = m.name.split(' vs. ');
            const game = schedule.find(g => 
                (g.awayTeam.includes(teamNames[0]) || g.homeTeam.includes(teamNames[0])) &&
                (g.awayTeam.includes(teamNames[1]) || g.homeTeam.includes(teamNames[1]))
            );

            if (game) {
                const startTimeTs = new Date(game.gameDate).getTime() / 1000;
                const isLive = m.firstBuy > (startTimeTs + 300); // 5 min buffer

                const period = m.firstBuy < SEASON_START ? 'spring' : 'season';
                const type = isLive ? 'live' : 'pre';
                
                results[period][type].count++;
                results[period][type].pnl += (m.returned - m.staked);
            }
        } catch (e) {
            // Skip non-MLB or errors
        }
    }

    console.log("\n--- LIVE VS PRE-GAME PERFORMANCE ---");
    console.log("Spring Training (Pre-Game):", results.spring.pre);
    console.log("Spring Training (Live):", results.spring.live);
    console.log("Regular Season (Pre-Game):", results.season.pre);
    console.log("Regular Season (Live):", results.season.live);
}

auditLiveVsPre();
