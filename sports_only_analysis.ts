import * as fs from 'fs';

function analyzeSportsOnly() {
    const csvPath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-03-24.csv';
    const csvData = fs.readFileSync(csvPath, 'utf8');
    const lines = csvData.split('\n').filter(l => l.trim() !== '');
    
    interface CSVRow {
        marketName: string;
        action: string;
        usdcAmount: number;
        timestamp: number;
    }

    const rows: CSVRow[] = lines.slice(1).map(line => {
        const values = []; let current = ''; let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '\"') inQuotes = !inQuotes;
            else if (line[i] === ',' && !inQuotes) { values.push(current); current = ''; }
            else current += line[i];
        }
        values.push(current);
        return {
            marketName: values[0],
            action: values[1],
            usdcAmount: parseFloat(values[2] || '0'),
            timestamp: parseInt(values[5] || '0')
        };
    });

    const cryptoKeywords = ['bitcoin', 'solana', 'btc', 'eth', 'up or down', 'crypto', 'price of'];
    const sportsRows = rows.filter(r => !cryptoKeywords.some(k => r.marketName.toLowerCase().includes(k)));

    const markets: Record<string, CSVRow[]> = {};
    sportsRows.forEach(r => {
        if (!markets[r.marketName]) markets[r.marketName] = [];
        markets[r.marketName].push(r);
    });

    const buckets: Record<string, { stake: number, payout: number, count: number, wins: number }> = {
        '0-120m (Late)': { stake: 0, payout: 0, count: 0, wins: 0 },
        '120-240m (Mid)': { stake: 0, payout: 0, count: 0, wins: 0 },
        '240m+ (Early)': { stake: 0, payout: 0, count: 0, wins: 0 }
    };

    Object.entries(markets).forEach(([name, mRows]) => {
        const buys = mRows.filter(r => r.action === 'Buy');
        const end = mRows.find(r => r.action === 'Redeem' || r.action === 'Sell');
        
        if (buys.length > 0 && end) {
            buys.forEach(buy => {
                const diffMinutes = (end.timestamp - buy.timestamp) / 60;
                let bucket = '';
                if (diffMinutes <= 120) bucket = '0-120m (Late)';
                else if (diffMinutes <= 240) bucket = '120-240m (Mid)';
                else bucket = '240m+ (Early)';

                const isWin = end.action === 'Sell' ? (end.usdcAmount > buy.usdcAmount) : (end.usdcAmount > 0);
                
                buckets[bucket].stake += buy.usdcAmount;
                buckets[bucket].payout += (isWin ? (end.action === 'Sell' ? end.usdcAmount : end.usdcAmount) : 0);
                
                buckets[bucket].count++;
                if (isWin) buckets[bucket].wins++;
            });
        }
    });

    console.log('\n--- SPORTS ONLY ROI ANALYSIS ---');
    Object.entries(buckets).forEach(([name, data]) => {
        const wr = data.count > 0 ? (data.wins / data.count * 100) : 0;
        const roi = data.stake > 0 ? ((data.payout - data.stake) / data.stake * 100) : 0;
        console.log(`${name.padEnd(15)} | Win Rate: ${wr.toFixed(1).padStart(5)}% | Bets: ${data.count.toString().padEnd(3)} | ROI: ${roi.toFixed(1).padStart(6)}% | Net: $${(data.payout - data.stake).toFixed(2).padStart(8)}`);
    });
}

analyzeSportsOnly();
