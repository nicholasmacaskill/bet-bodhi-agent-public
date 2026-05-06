import * as fs from 'fs';

const csvPath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-03-29.csv';

function parseLine(line: string) {
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
    return values;
}

const data = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const lines = data.split('\n').filter(l => l.trim().length > 0);
const headers = parseLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));

const rows = lines.slice(1).map(line => {
    const values = parseLine(line);
    const obj: any = {};
    headers.forEach((h, i) => {
        obj[h] = values[i] ? values[i].trim().replace(/^"|"$/g, '') : '';
    });
    return obj;
});

const markets: Record<string, any> = {};

rows.forEach(r => {
    const marketName = r.marketName;
    if (!marketName || ['Deposited funds', 'Withdrew funds'].includes(marketName)) return;
    if (!markets[marketName]) markets[marketName] = { buy: 0, return: 0, actions: [] };
    
    const usdc = parseFloat(r.usdcAmount || '0');
    if (r.action === 'Buy') markets[marketName].buy += usdc;
    else if (r.action === 'Sell' || r.action === 'Redeem') markets[marketName].return += usdc;
    
    markets[marketName].actions.push(r);
});

const mlbTeams = ['Diamondbacks', 'Dodgers', 'Rockies', 'Marlins', 'Yankees', 'Giants', 'Tigers', 'Padres', 'Nationals', 'Cubs', 'Red Sox', 'Reds', 'Guardians', 'Twins', 'Orioles', 'Brewers', 'Cardinals', 'Braves', 'Athletics', 'Mets', 'Astros', 'White Sox', 'Royals', 'Blue Jays', 'Pirates', 'Rangers', 'Phillies', 'Rays'];

const stats: any = {
    MLB: { buy: 0, ret: 0, markets: 0, wins: 0, losses: 0 },
    Crypto: { buy: 0, ret: 0, markets: 0, wins: 0, losses: 0 },
    Other: { buy: 0, ret: 0, markets: 0, wins: 0, losses: 0 }
};

Object.entries(markets).forEach(([name, data]: [string, any]) => {
    const profit = data.return - data.buy;
    const isWin = profit > 0.05;
    const isLoss = profit < -0.05;
    
    let cat = 'Other';
    if (name.toLowerCase().includes('bitcoin') || name.toLowerCase().includes('solana') || name.toLowerCase().includes('btc') || name.toLowerCase().includes('up or down')) {
        cat = 'Crypto';
    } else if (mlbTeams.some(t => name.includes(t)) || name.includes('vs.')) {
        cat = 'MLB';
    }
    
    stats[cat].buy += data.buy;
    stats[cat].ret += data.return;
    stats[cat].markets++;
    if (isWin) stats[cat].wins++;
    else if (isLoss) stats[cat].losses++;
});

const totalProfit = stats.MLB.ret + stats.Crypto.ret + stats.Other.ret - (stats.MLB.buy + stats.Crypto.buy + stats.Other.buy);

console.log('--- BODHI DAILY RETURN AUDIT (MARCH 29 SNAPSHOT) ---');
console.log(`MLB Profit:    $${(stats.MLB.ret - stats.MLB.buy).toFixed(2)}`);
console.log(`Crypto Profit: $${(stats.Crypto.ret - stats.Crypto.buy).toFixed(2)}`);
console.log(`Total Profit:  $${totalProfit.toFixed(2)}`);

const prevProfit = 50.95;
console.log(`\nDelta from Prev Snapshot: $${(totalProfit - prevProfit).toFixed(2)}`);
