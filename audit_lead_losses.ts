
import * as fs from 'fs';
import { MLBApi } from './src/lib/mlb-api';

async function auditLeadLosses() {
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

    const markets: Record<string, any> = {};
    rows.forEach(r => {
        const m = r.marketName;
        if (!markets[m]) markets[m] = { name: m, staked: 0, returned: 0, ts: parseInt(r.timestamp) };
        if (r.action === 'Buy') markets[m].staked += parseFloat(r.usdcAmount || '0');
        else if (r.action === 'Sell' || r.action === 'Redeem') markets[m].returned += parseFloat(r.usdcAmount || '0');
    });

    const losses = Object.values(markets).filter(m => m.staked > 10 && m.returned < (m.staked * 0.1));
    
    console.log(`\n--- LEAD LOSS AUDIT (Top ${losses.length} Losses) ---\n`);

    for (const loss of losses) {
        const date = new Date(loss.ts * 1000).toISOString().split('T')[0];
        try {
            const schedule = await mlb.getSchedule(date);
            const game = schedule.find(g => loss.name.includes(g.awayTeam) || loss.name.includes(g.homeTeam));
            
            if (game) {
                const res = await fetch(`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/linescore`);
                const data = await res.json();
                
                // Track max lead
                let maxLead = 0;
                let blownInning = 0;
                let myTeam = loss.name.split(' vs. ')[0]; // Basic guess
                
                (data.innings || []).forEach((inn: any) => {
                    const awayR = inn.away.runs || 0;
                    const homeR = inn.home.runs || 0;
                    // For simplicity, let's just see if ANYONE had a big lead and lost
                    const lead = Math.abs(awayR - homeR);
                    if (lead > maxLead) maxLead = lead;
                });

                console.log(`${loss.name.padEnd(45)} | Max Lead (any): ${maxLead} | Stake: $${loss.staked.toFixed(2)}`);
            }
        } catch (e) {
            // skip
        }
    }
}

auditLeadLosses();
