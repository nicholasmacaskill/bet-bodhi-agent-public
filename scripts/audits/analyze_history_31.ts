
import * as fs from 'fs';

function analyzeHistory() {
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
    }

    const markets: Record<string, Market> = {};

    // Skip header
    lines.slice(1).forEach(line => {
        // Simple CSV parse (considering quotes)
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

        if (!markets[marketName]) {
            markets[marketName] = { name: marketName, buys: [], sells: [], redeems: [] };
        }

        if (action === 'Buy') markets[marketName].buys.push({ amount: usdcAmount, timestamp });
        else if (action === 'Sell') markets[marketName].sells.push({ amount: usdcAmount, timestamp });
        else if (action === 'Redeem') markets[marketName].redeems.push({ amount: usdcAmount, timestamp });
    });

    const SEASON_START = 1774569600; // 2026-03-27 00:00:00 UTC

    function runStats(name: string, filter: (m: Market) => boolean) {
        let totalStaked = 0;
        let totalRefilled = 0; // Sells or Redeems
        let wins = 0;
        let losses = 0;
        let pending = 0;
        let marketCount = 0;

        Object.values(markets).forEach(m => {
            // Determine if the market as a whole fits the filter (e.g. earliest buy)
            const earliestBuy = Math.min(...m.buys.map(b => b.timestamp));
            if (m.buys.length === 0 || !filter(m)) return;

            marketCount++;
            const staked = m.buys.reduce((acc, b) => acc + b.amount, 0);
            const returned = m.sells.reduce((acc, s) => acc + s.amount, 0) + m.redeems.reduce((acc, r) => acc + r.amount, 0);
            
            totalStaked += staked;
            totalRefilled += returned;

            const isSettled = m.sells.length > 0 || m.redeems.length > 0;
            if (isSettled) {
                if (returned > staked) wins++;
                else losses++;
            } else {
                pending++;
            }
        });

        const net = totalRefilled - totalStaked;
        const roi = totalStaked > 0 ? (net / totalStaked * 100) : 0;

        console.log(`\n--- ${name} ---`);
        console.log(`Markets: ${marketCount} (Wins: ${wins}, Losses: ${losses}, Pending: ${pending})`);
        console.log(`Total Staked: $${totalStaked.toFixed(2)}`);
        console.log(`Total Returned: $${totalRefilled.toFixed(2)}`);
        console.log(`Net P/L: $${net.toFixed(2)}`);
        console.log(`ROI: ${roi.toFixed(1)}%`);
    }

    runStats("Spring Training (Before Mar 27)", m => Math.min(...m.buys.map(b => b.timestamp)) < SEASON_START);
    runStats("Regular Season (Mar 27+)", m => Math.min(...m.buys.map(b => b.timestamp)) >= SEASON_START);

    // Deep dive into recent "tilt" behavior
    const TILT_WINDOW = 1774813200; // Approx Mar 30th
    runStats("Last 48 Hours Deep Dive", m => Math.min(...m.buys.map(b => b.timestamp)) >= TILT_WINDOW);
}

analyzeHistory();
