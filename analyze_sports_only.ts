
import * as fs from 'fs';

function analyzeSportsOnly() {
    const csvPath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-03-31.csv';
    if (!fs.existsSync(csvPath)) {
        console.error("CSV not found at:", csvPath);
        return;
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    
    interface Market {
        name: string;
        buys: { amount: number, timestamp: number }[];
        sells: { amount: number, timestamp: number }[];
        redeems: { amount: number, timestamp: number }[];
        isSport: boolean;
    }

    const marketsMap: Record<string, Market> = {};

    lines.slice(1).forEach(line => {
        const parts = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') inQuotes = !inQuotes;
            else if (line[i] === ',' && !inQuotes) {
                parts.push(current);
                current = '';
            } else current += line[i];
        }
        parts.push(current);

        const marketName = parts[0];
        const action = parts[1];
        const usdcAmount = parseFloat(parts[2] || '0');
        const timestamp = parseInt(parts[5] || '0');

        if (!marketsMap[marketName]) {
            const isForbidden = /Bitcoin|Solana|Deposited|Withdrew|Up or Down/.test(marketName);
            const containsVs = /vs\./.test(marketName);
            
            marketsMap[marketName] = { 
                name: marketName, 
                buys: [], 
                sells: [], 
                redeems: [],
                isSport: containsVs && !isForbidden
            };
        }

        if (action === 'Buy') marketsMap[marketName].buys.push({ amount: usdcAmount, timestamp });
        else if (action === 'Sell') marketsMap[marketName].sells.push({ amount: usdcAmount, timestamp });
        else if (action === 'Redeem') marketsMap[marketName].redeems.push({ amount: usdcAmount, timestamp });
    });

    const SEASON_START = 1774569600; // 2026-03-27

    function detailedStats(name: string, filter: (m: Market) => boolean) {
        const filtered = Object.values(marketsMap).filter(m => m.isSport && m.buys.length > 0 && filter(m));
        if (filtered.length === 0) {
            console.log(`\n--- ${name} --- (No Sports Data)`);
            return;
        }

        const stakes = filtered.map(m => m.buys.reduce((acc, b) => acc + b.amount, 0));
        const totalStaked = stakes.reduce((acc, s) => acc + s, 0);
        const avgStake = totalStaked / filtered.length;
        
        const sortedStakes = [...stakes].sort((a, b) => a - b);
        const medianStake = sortedStakes[Math.floor(sortedStakes.length / 2)];
        
        const settled = filtered.filter(m => m.sells.length > 0 || m.redeems.length > 0);
        const returns = settled.map(m => m.sells.reduce((acc, s) => acc + s.amount, 0) + m.redeems.reduce((acc, r) => acc + r.amount, 0));
        const wins = settled.filter((m, i) => returns[i] > (m.buys.reduce((acc, b) => acc + b.amount, 0))).length;
        const net = returns.reduce((acc, r) => acc + r, 0) - filtered.reduce((acc, m) => acc + m.buys.reduce((a, b) => a + b.amount, 0), 0);

        console.log(`\n--- ${name} ---`);
        console.log(`Sports Markets: ${filtered.length}`);
        console.log(`Avg Stake: $${avgStake.toFixed(2)} | Median: $${medianStake.toFixed(2)}`);
        console.log(`Settled Win Rate: ${settled.length > 0 ? (wins / settled.length * 100).toFixed(1) : 0}% (${wins}W - ${settled.length - wins}L)`);
        console.log(`Net Sports P/L: $${net.toFixed(2)}`);
    }

    console.log("SPORTS-ONLY PERFORMANCE ANALYSIS");
    detailedStats("Spring Training (Before Mar 27)", m => Math.min(...m.buys.map(b => b.timestamp)) < SEASON_START);
    detailedStats("Regular Season (Mar 27+)", m => Math.min(...m.buys.map(b => b.timestamp)) >= SEASON_START);
}

analyzeSportsOnly();
