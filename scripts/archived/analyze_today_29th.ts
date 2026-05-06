import * as fs from 'fs';

const csvPath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-03-29.csv';
const MIDNIGHT_29_UTC = 1774742400; // March 29, 00:00:00 UTC
// But the user is at -03:00. 
// 00:00:00 local on Mar 29 = 03:00:00 UTC on Mar 29.
const MIDNIGHT_29_LOCAL = 1774742400 + (3 * 3600); // 1774753200

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

console.log(`--- BODHI RETURN AUDIT: MARCH 29TH (SINCE MIDNIGHT) ---`);

const todayRows = rows.filter(r => parseInt(r.timestamp) >= MIDNIGHT_29_LOCAL);

let totalBuy = 0;
let totalReturn = 0;

todayRows.forEach(r => {
    const usdc = parseFloat(r.usdcAmount || '0');
    console.log(`[${r.action}] ${r.marketName}: $${usdc.toFixed(2)} (${new Date(parseInt(r.timestamp) * 1000).toISOString()})`);
    if (r.action === 'Buy') totalBuy += usdc;
    else if (r.action === 'Sell' || r.action === 'Redeem') totalReturn += usdc;
});

console.log(`\n================================`);
console.log(`March 29th Buy:    $${totalBuy.toFixed(2)}`);
console.log(`March 29th Return: $${totalReturn.toFixed(2)}`);
console.log(`March 29th P/L:    $${(totalReturn - totalBuy).toFixed(2)}`);
console.log(`================================`);
