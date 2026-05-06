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

const mlbTeams = ['Diamondbacks', 'Dodgers', 'Rockies', 'Marlins', 'Yankees', 'Giants', 'Tigers', 'Padres', 'Nationals', 'Cubs', 'Red Sox', 'Reds', 'Guardians', 'Twins', 'Orioles', 'Brewers', 'Cardinals', 'Braves', 'Athletics', 'Mets', 'Astros', 'White Sox', 'Royals', 'Blue Jays', 'Pirates', 'Rangers', 'Phillies', 'Rays'];

const mlbMarkets: Record<string, any> = {};

rows.forEach(r => {
    const name = r.marketName;
    if (!name || (!mlbTeams.some(t => name.includes(t)) && !name.includes('vs.'))) return;
    
    // Some basic filtering to avoid NHL/NBA that might slip through (already have a list but let's be safe)
    const hockeyKeywords = ['Ducks', 'Islanders', 'Maple Leafs', 'Bruins', 'Canadiens', 'Panthers', 'Canucks', 'Wild', 'Sabres', 'Flyers', 'Blue Jackets', 'Blackhawks', 'Oilers', 'Avalanche', 'Golden Knights', 'Lightning'];
    const basketballKeywords = ['Suns', 'Celtics', 'Warriors', 'Knicks', 'Kings', 'Lakers', 'Timberwolves', 'Rockets', 'Nuggets', 'Hornets', 'Jazz'];
    
    if (hockeyKeywords.some(k => name.includes(k)) || basketballKeywords.some(k => name.includes(k))) return;
    if (name.toLowerCase().includes('bitcoin') || name.toLowerCase().includes('solana') || name.toLowerCase().includes('btc')) return;

    if (!mlbMarkets[name]) mlbMarkets[name] = { buy: 0, ret: 0, actions: [], prices: [], teamsBetOn: [] };
    
    const usdc = parseFloat(r.usdcAmount || '0');
    const tokens = parseFloat(r.tokenAmount || '0');
    
    if (r.action === 'Buy') {
        mlbMarkets[name].buy += usdc;
        if (tokens > 0) mlbMarkets[name].prices.push(usdc / tokens);
        if (r.tokenName) mlbMarkets[name].teamsBetOn.push(r.tokenName);
    } else if (r.action === 'Sell' || r.action === 'Redeem') {
        mlbMarkets[name].ret += usdc;
    }
    
    mlbMarkets[name].actions.push(r);
});

console.log('--- MLB DEEP DIVE: LOSS ANALYSIS ---');

// 1. Analyze by Price Window
const priceWindows = [
    { name: 'Underdog ($0.01-0.40)', min: 0.01, max: 0.40, buy: 0, ret: 0, count: 0 },
    { name: 'Value ($0.40-0.60)', min: 0.40, max: 0.60, buy: 0, ret: 0, count: 0 },
    { name: 'Moderate Favorite ($0.60-0.80)', min: 0.60, max: 0.80, buy: 0, ret: 0, count: 0 },
    { name: 'Heavy Favorite ($0.80-0.99)', min: 0.80, max: 0.99, buy: 0, ret: 0, count: 0 }
];

// 2. Analyze Stake Correlation
let largeBetBuy = 0; let largeBetRet = 0; // > $30
let smallBetBuy = 0; let smallBetRet = 0; // < $30

Object.entries(mlbMarkets).forEach(([name, m]: [string, any]) => {
    if (m.buy === 0) return;
    
    const avgPrice = m.prices.length > 0 ? (m.prices.reduce((a:number,b:number)=>a+b,0) / m.prices.length) : 0;
    const window = priceWindows.find(w => avgPrice >= w.min && avgPrice < w.max);
    if (window) {
        window.buy += m.buy;
        window.ret += m.ret;
        window.count++;
    }
    
    if (m.buy >= 30) {
        largeBetBuy += m.buy;
        largeBetRet += m.ret;
    } else {
        smallBetBuy += m.buy;
        smallBetRet += m.ret;
    }
});

console.log('\n--- PERFORMANCE BY ODDS ---');
priceWindows.forEach(w => {
    const roi = w.buy > 0 ? ((w.ret - w.buy) / w.buy * 100) : 0;
    console.log(`${w.name.padEnd(28)} | ROI: ${roi.toFixed(1).padStart(6)}% | Spent: $${w.buy.toFixed(2).padStart(8)}`);
});

console.log('\n--- PERFORMANCE BY STAKE SIZE ---');
console.log(`Large Bets (>$30):  ROI: ${((largeBetRet - largeBetBuy) / largeBetBuy * 100).toFixed(1).padStart(6)}% | Total Spent: $${largeBetBuy.toFixed(2)}`);
console.log(`Small Bets (<$30):  ROI: ${((smallBetRet - smallBetBuy) / smallBetBuy * 100).toFixed(1).padStart(6)}% | Total Spent: $${smallBetBuy.toFixed(2)}`);

// 3. Find "Averaging Down" patterns
console.log('\n--- POTENTIAL "EVALUATION TILT" (Averaging Down on Losers) ---');
Object.entries(mlbMarkets).forEach(([name, m]: [string, any]) => {
    const buys = m.actions.filter((a:any) => a.action === 'Buy');
    if (buys.length >= 3 && m.ret < m.buy) {
        console.log(`Market: ${name.slice(0, 40).padEnd(40)} | Buys: ${buys.length} | Loss: -$${(m.buy - m.ret).toFixed(2)}`);
    }
});
