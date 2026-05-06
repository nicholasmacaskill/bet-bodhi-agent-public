import * as fs from 'fs';

function analyzeCSV() {
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
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') inQuotes = !inQuotes;
            else if (line[i] === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else current += line[i];
        }
        values.push(current);
        return {
            marketName: values[0],
            action: values[1],
            usdcAmount: parseFloat(values[2] || '0'),
            timestamp: parseInt(values[5] || '0')
        };
    });

    // Group by market
    const markets: Record<string, CSVRow[]> = {};
    rows.forEach(r => {
        if (!markets[r.marketName]) markets[r.marketName] = [];
        markets[r.marketName].push(r);
    });

    const winWindows: number[] = [];
    const lossWindows: number[] = [];

    Object.entries(markets).forEach(([name, mRows]) => {
        const buys = mRows.filter(r => r.action === 'Buy');
        const end = mRows.find(r => r.action === 'Redeem' || r.action === 'Sell');
        
        if (buys.length > 0 && end) {
            const isWin = end.action === 'Sell' ? (end.usdcAmount > buys[0].usdcAmount) : (end.usdcAmount > 0);
            
            buys.forEach(buy => {
                const diffMinutes = (end.timestamp - buy.timestamp) / 60;
                if (isWin) winWindows.push(diffMinutes);
                else lossWindows.push(diffMinutes);
            });
        }
    });

    const avgWinWindow = winWindows.reduce((a, b) => a + b, 0) / winWindows.length;
    const avgLossWindow = lossWindows.reduce((a, b) => a + b, 0) / lossWindows.length;

    console.log('\n--- RELATIVE TIME WINDOW ANALYSIS (Minutes before Market End) ---');
    console.log('Avg Time to End (Wins):', avgWinWindow.toFixed(1), 'minutes');
    console.log('Avg Time to End (Losses):', avgLossWindow.toFixed(1), 'minutes');
    
    // Distribution
    const buckets = [30, 60, 120, 240];
    console.log('\nWin Rate by Time before End:');
    buckets.forEach((limit, i) => {
        const lower = i === 0 ? 0 : buckets[i-1];
        const bucketWins = winWindows.filter(w => w > lower && w <= limit).length;
        const bucketLosses = lossWindows.filter(w => w > lower && w <= limit).length;
        const wr = bucketWins + bucketLosses > 0 ? (bucketWins / (bucketWins + bucketLosses) * 100) : 0;
        console.log(`${lower}-${limit} mins: ${wr.toFixed(1)}% (${bucketWins + bucketLosses} bets)`);
    });
    console.log('240+ mins:   ', (winWindows.filter(w => w > 240).length / (winWindows.filter(w => w > 240).length + lossWindows.filter(w => w > 240).length) * 100).toFixed(1) + '%');
}

analyzeCSV();
