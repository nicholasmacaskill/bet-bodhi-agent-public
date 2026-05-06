
import * as fs from 'fs';

function analyzeOddsShift() {
    const csvPath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-03-31.csv';
    if (!fs.existsSync(csvPath)) return;

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    
    interface Market {
        name: string;
        buys: { amount: number, tokens: number, timestamp: number }[];
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
                isSport: containsVs && !isForbidden
            };
        }

        if (action === 'Buy') {
            marketsMap[marketName].buys.push({ amount: usdcAmount, tokens: tokenAmount, timestamp });
        }
    });

    const SEASON_START = 1774569600;

    function stats(name: string, filter: (m: Market) => boolean) {
        const filtered = Object.values(marketsMap).filter(m => m.isSport && m.buys.length > 0 && filter(m));
        if (filtered.length === 0) return;

        const allEntryOdds = filtered.map(m => {
            const totalUSDC = m.buys.reduce((acc, b) => acc + b.amount, 0);
            const totalTokens = m.buys.reduce((acc, b) => acc + b.tokens, 0);
            return totalTokens > 0 ? (totalTokens / totalUSDC) : 0;
        }).filter(o => o > 0);

        const avgOdds = allEntryOdds.reduce((acc, o) => acc + o, 0) / allEntryOdds.length;
        const sorted = [...allEntryOdds].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        
        // Buckets
        const buckets = { 'Heavy Fav (<1.5)': 0, 'Fav (1.5-2.5)': 0, 'Mid (2.5-5.0)': 0, 'Dog (5.0+)': 0 };
        allEntryOdds.forEach(o => {
            if (o < 1.5) buckets['Heavy Fav (<1.5)']++;
            else if (o < 2.5) buckets['Fav (1.5-2.5)']++;
            else if (o < 5.0) buckets['Mid (2.5-5.0)']++;
            else buckets['Dog (5.0+)']++;
        });

        console.log(`\n--- ${name} ---`);
        console.log(`Average Entry Odds: ${avgOdds.toFixed(2)}`);
        console.log(`Median Entry Odds: ${median.toFixed(2)}`);
        console.log(`Distribution:`, buckets);
    }

    console.log("ODDS ENTRANCE ANALYSIS (SPORTS ONLY)");
    stats("Spring Training (Before Mar 27)", m => Math.min(...m.buys.map(b => b.timestamp)) < SEASON_START);
    stats("Regular Season (Mar 27+)", m => Math.min(...m.buys.map(b => b.timestamp)) >= SEASON_START);
}

analyzeOddsShift();
