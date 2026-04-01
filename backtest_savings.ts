
import * as fs from 'fs';
import { MLBApi } from './src/lib/mlb-api';

const mlb = new MLBApi();
const csvPath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-03-31 (1).csv';
const content = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const lines = content.split('\n').filter(l => l.trim());
const headers = lines[0].split(',').map(h => h.trim().replace(/^\"|\"$/g, ''));
const rows = lines.slice(1).map(line => {
    const vals: string[] = [];
    let cur = ''; let q = false;
    for (const c of line) {
        if (c === '\"') q = !q;
        else if (c === ',' && !q) { vals.push(cur.trim()); cur = ''; }
        else cur += c;
    }
    vals.push(cur.trim());
    const obj: any = {};
    headers.forEach((h, i) => obj[h] = vals[i] || '');
    return obj;
});

async function runBacktest() {
    const markets: Record<string, any> = {};
    rows.forEach(r => {
        const m = r.marketName;
        if (!markets[m]) markets[m] = { name: m, staked: 0, returned: 0, ts: parseInt(r.timestamp) };
        if (r.action === 'Buy') markets[m].staked += parseFloat(r.usdcAmount || '0');
        else if (r.action === 'Sell' || r.action === 'Redeem') markets[m].returned += parseFloat(r.usdcAmount || '0');
    });

    const losses = Object.values(markets).filter(m => m.staked > 10 && m.returned < (m.staked * 0.1));
    let totalPotentialSavings = 0;
    let savedGamesCount = 0;

    console.log('--- SAVINGS CALCULATION (If Cashing Out After 7th Lead) ---\n');

    for (const loss of losses) {
        const date = new Date(loss.ts * 1000).toISOString().split('T')[0];
        try {
            const schedule = await mlb.getSchedule(date);
            const game = schedule.find(g => loss.name.includes(g.awayTeam) || loss.name.includes(g.homeTeam));
            if (game) {
                const res = await fetch('https://statsapi.mlb.com/api/v1/game/' + game.gamePk + '/linescore');
                const data = await res.json();
                
                // Track total runs up to 7th
                let awayR = 0; let homeR = 0;
                (data.innings || []).slice(0, 7).forEach((i: any) => {
                    awayR += (i.away?.runs || 0);
                    homeR += (i.home?.runs || 0);
                });

                // Assume we were betting on the favorite who held a lead
                const diff = awayR - homeR;
                if (Math.abs(diff) >= 2) {
                    const cashoutValue = loss.staked * 0.75; 
                    totalPotentialSavings += cashoutValue;
                    savedGamesCount++;
                    console.log(`[SAVED] ${loss.name.padEnd(40)} | Lead at 7th: ${Math.abs(diff)} | Reclaimed: $${cashoutValue.toFixed(2)}`);
                }
            }
        } catch(e) {}
    }

    console.log(`\n--- PRELIMINARY SAVINGS REPORT ---`);
    console.log(`Total 'Lead Losses' Recovered: ${savedGamesCount}`);
    console.log(`Total Potential USDC Reclaimed: $${totalPotentialSavings.toFixed(2)}`);
    console.log(`Recovery Potential: +${((totalPotentialSavings / 474) * 100).toFixed(1)}% bankroll increase`);
}

runBacktest();
