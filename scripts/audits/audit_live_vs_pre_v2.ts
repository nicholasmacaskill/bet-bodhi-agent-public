
import * as fs from 'fs';
import { MLBApi } from '../../src/lib/mlb-api';
import { NHLApi } from '../../src/lib/nhl-api';

async function auditLiveVsPreV2() {
    const csvPath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-03-31.csv';
    const mlbApi = new MLBApi();
    const nhlApi = new NHLApi();
    
    if (!fs.existsSync(csvPath)) return;
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() !== '');

    interface Market {
        name: string;
        firstBuy: number;
        staked: number;
        returned: number;
        isSport: boolean;
    }

    const markets: Record<string, Market> = {};

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
            markets[mName] = { name: mName, firstBuy: ts, staked: 0, returned: 0, isSport: true };
        }

        if (action === 'Buy') {
            markets[mName].staked += amount;
            if (ts < markets[mName].firstBuy) markets[mName].firstBuy = ts;
        } else if (action === 'Sell' || action === 'Redeem') {
            markets[mName].returned += amount;
        }
    });

    const SEASON_START = 1774569600;
    const results: any = {
        spring: { pre: { count: 0, pnl: 0, staked: 0 }, live: { count: 0, pnl: 0, staked: 0 } },
        season: { pre: { count: 0, pnl: 0, staked: 0 }, live: { count: 0, pnl: 0, staked: 0 } }
    };

    console.log("Analyzing sports markets for Live vs Pre-Game audit...");

    for (const m of Object.values(markets)) {
        const d = new Date(m.firstBuy * 1000).toISOString().split('T')[0];
        const period = m.firstBuy < SEASON_START ? 'spring' : 'season';
        
        let startTimeTs: number | null = null;

        try {
            // Try MLB
            const mlbSchedule = await mlbApi.getSchedule(d);
            const mlbGame = mlbSchedule.find(g => m.name.includes(g.awayTeam) || m.name.includes(g.homeTeam));
            if (mlbGame && mlbGame.date) {
                startTimeTs = new Date(mlbGame.date).getTime() / 1000;
            } else {
                // Try NHL
                const nhlSchedule = await nhlApi.getSchedule(d);
                const nhlGame = nhlSchedule.find(g => m.name.includes(g.awayTeam) || m.name.includes(g.homeTeam));
                if (nhlGame && nhlGame.startTime) {
                    startTimeTs = new Date(nhlGame.startTime).getTime() / 1000;
                }
            }

            if (startTimeTs) {
                const isLive = m.firstBuy > (startTimeTs + 120); // 2 min buffer
                const type = isLive ? 'live' : 'pre';
                
                results[period][type].count++;
                results[period][type].staked += m.staked;
                results[period][type].pnl += (m.returned - m.staked);
            } else {
                // console.log(`Could not find game start for: ${m.name}`);
            }
        } catch (e) {
            // Skip
        }
    }

    console.log("\n--- LIVE VS PRE-GAME PERFORMANCE ---");
    ['spring', 'season'].forEach(p => {
        ['pre', 'live'].forEach(t => {
            const data = results[p][t];
            const roi = data.staked > 0 ? (data.pnl / data.staked * 100) : 0;
            console.log(`${p.charAt(0).toUpperCase() + p.slice(1)} (${t.toUpperCase()}): Count: ${data.count}, P/L: $${data.pnl.toFixed(2)}, ROI: ${roi.toFixed(1)}%`);
        });
    });
}

auditLiveVsPreV2();
