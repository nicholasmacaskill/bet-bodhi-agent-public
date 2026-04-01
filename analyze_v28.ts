import * as fs from 'fs';

const csvPath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-03-28.csv';

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

let rushZoneInvestment = 0;
let rushZoneReturn = 0;
let standardInvestment = 0;
let standardReturn = 0;

Object.entries(markets).forEach(([name, data]: [string, any]) => {
    const endAction = data.actions.find((a: any) => a.action === 'Redeem' || a.action === 'Sell');
    if (!endAction) return;
    
    const endTime = parseInt(endAction.timestamp);
    
    data.actions.forEach((a: any) => {
        if (a.action === 'Buy') {
            const buyTime = parseInt(a.timestamp);
            const diffMinutes = (endTime - buyTime) / 60;
            const usdc = parseFloat(a.usdcAmount);
            
            // Heuristic: If we bought within 3 hours of the game ending, it's a "Rush" (likely late in game or just before)
            // Typically games last ~2.5 to 3 hours.
            if (diffMinutes < 180) { // 3 hours
                rushZoneInvestment += usdc;
                // Pro-rate return? No, let's just use the whole market result for simplicity
            } else {
                standardInvestment += usdc;
            }
        }
    });
    
    // Simplistic return attribution
    const profit = data.return - data.buy;
    // We'll just use the total market outcome for the categorization of the dominant buy? No.
});

console.log('--- RUSH ZONE HEURISTIC ANALYSIS ---');
console.log(`Note: This assumes the "Redeem" or "Sell" happens near game end.`);
// Need a better way to attribute return to specific buys. 
// Let's just calculate ROI for markets where ALL buys were "Early" vs markets where some were "Late".

let earlyMarkets = { buy: 0, ret: 0, count: 0 };
let lateMarkets = { buy: 0, ret: 0, count: 0 };

Object.entries(markets).forEach(([name, m]: [string, any]) => {
    const end = m.actions.find((a: any) => a.action === 'Redeem' || a.action === 'Sell');
    if (!end || m.buy === 0) return;
    
    const endTime = parseInt(end.timestamp);
    const earliestBuy = Math.min(...m.actions.filter((a: any) => a.action === 'Buy').map((a: any) => parseInt(a.timestamp)));
    const diffHours = (endTime - earliestBuy) / 3600;
    
    if (diffHours < 4) { // Less than 4 hours from first buy to end -> "Late/Rush"
        lateMarkets.buy += m.buy;
        lateMarkets.ret += m.return;
        lateMarkets.count++;
    } else {
        earlyMarkets.buy += m.buy;
        earlyMarkets.ret += m.return;
        earlyMarkets.count++;
    }
});

console.log('\nEARLY ENTRIES (>4h before end):');
console.log(`Markets: ${earlyMarkets.count} | Investment: $${earlyMarkets.buy.toFixed(2)} | ROI: ${((earlyMarkets.ret - earlyMarkets.buy) / earlyMarkets.buy * 100).toFixed(1)}%`);

console.log('\nLATE ENTRIES (<4h before end):');
console.log(`Markets: ${lateMarkets.count} | Investment: $${lateMarkets.buy.toFixed(2)} | ROI: ${((lateMarkets.ret - lateMarkets.buy) / lateMarkets.buy * 100).toFixed(1)}%`);
