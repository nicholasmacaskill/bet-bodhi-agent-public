
import * as fs from 'fs';

function analyzeOddsEfficiency() {
    const csvPath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-03-31.csv';
    if (!fs.existsSync(csvPath)) return;

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
        const tokenAmount = parseFloat(parts[3] || '0');
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

        if (action === 'Buy') {
            // Odds = usdcAmount / tokenAmount (e.g. 0.50 USDC for 1 Token = 2x Odds)
            // But Polymarket CSV usually has tokenAmount as the NUMBER OF TOKENS.
            // If USDC is 21 and Tokens is 75, Price = 21/75 = 0.28. Odds = 1/0.28 = 3.57.
            const odds = tokenAmount > 0 ? (tokenAmount / usdcAmount) : 0;
            marketsMap[marketName].buys.push({ amount: usdcAmount, timestamp });
            // Let's store odds in the market if we want to analyze it
            (marketsMap[marketName] as any).lastOdds = odds;
        }
        else if (action === 'Sell') marketsMap[marketName].sells.push({ amount: usdcAmount, timestamp });
        else if (action === 'Redeem') marketsMap[marketName].redeems.push({ amount: usdcAmount, timestamp });
    });

    const SEASON_START = 1774569600;

    function stats(name: string, filter: (m: Market) => boolean) {
        const filtered = Object.values(marketsMap).filter(m => m.isSport && m.buys.length > 0 && filter(m));
        if (filtered.length === 0) return;

        const odds = filtered.map(m => (m as any).lastOdds).filter(o => o > 0);
        const avgOdds = odds.reduce((acc, o) => acc + o, 0) / odds.length;
        
        const settled = filtered.filter(m => m.sells.length > 0 || m.redeems.length > 0);
        const returns = settled.map(m => m.sells.reduce((acc, s) => acc + s.amount, 0) + m.redeems.reduce((acc, r) => acc + r.amount, 0));
        const wins = settled.filter((m, i) => returns[i] > (m.buys.reduce((acc, b) => acc + b.amount, 0)));
        
        const winOdds = wins.map(m => (m as any).lastOdds);
        const lossOdds = settled.filter((m, i) => returns[i] <= (m.buys.reduce((acc, b) => acc + b.amount, 0))).map(m => (m as any).lastOdds);

        console.log(`\n--- ${name} ---`);
        console.log(`Avg Odds (Overall): ${avgOdds.toFixed(2)}`);
        console.log(`Avg Odds (Wins): ${winOdds.length > 0 ? (winOdds.reduce((a, b) => a + b, 0) / winOdds.length).toFixed(2) : 'N/A'}`);
        console.log(`Avg Odds (Losses): ${lossOdds.length > 0 ? (lossOdds.reduce((a, b) => a + b, 0) / lossOdds.length).toFixed(2) : 'N/A'}`);
    }

    stats("Spring Training (Before Mar 27)", m => Math.min(...m.buys.map(b => b.timestamp)) < SEASON_START);
    stats("Regular Season (Mar 27+)", m => Math.min(...m.buys.map(b => b.timestamp)) >= SEASON_START);
}

analyzeOddsEfficiency();
