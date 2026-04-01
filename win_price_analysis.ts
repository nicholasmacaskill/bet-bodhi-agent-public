import * as fs from 'fs';

function analyzeWinPrices() {
    const csvPath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-03-24.csv';
    const csvData = fs.readFileSync(csvPath, 'utf8');
    const lines = csvData.split('\n').filter(l => l.trim().length > 0);
    const rows = lines.slice(1).map(line => {
        const values = []; let current = ''; let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') inQuotes = !inQuotes;
            else if (line[i] === ',' && !inQuotes) { values.push(current); current = ''; }
            else current += line[i];
        }
        values.push(current);
        return { market: values[0], action: values[1], usdc: parseFloat(values[2]), tokens: parseFloat(values[3]), time: parseInt(values[5]) };
    });

    const markets: Record<string, any[]> = {}; 
    rows.forEach(r => { if (!markets[r.market]) markets[r.market] = []; markets[r.market].push(r); });

    console.log('\n--- WINNING BETS: BUY PRICES ---');
    let lowPriceWins = 0;
    let highPriceWins = 0;
    let totalWins = 0;

    Object.entries(markets).forEach(([name, mRows]) => {
        const buys = mRows.filter(r => r.action === 'Buy');
        const end = mRows.find(r => r.action === 'Redeem' || r.action === 'Sell');
        if (buys.length > 0 && end) {
            const isWin = end.action === 'Sell' ? (end.usdc > buys[0].usdc) : (end.usdc > 0);
            if (isWin) {
                totalWins++;
                buys.forEach(buy => {
                    const price = buy.usdc / buy.tokens;
                    if (price <= 0.50) lowPriceWins++;
                    else highPriceWins++;
                    console.log(`Priced at $${price.toFixed(3)} | Market: ${name}`);
                });
            }
        }
    });

    console.log(`\nWins at <= $0.50 (Comeback): ${lowPriceWins}`);
    console.log(`Wins at > $0.50 (Momentum): ${highPriceWins}`);
}

analyzeWinPrices();
