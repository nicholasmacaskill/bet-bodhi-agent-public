import * as fs from 'fs';
import * as csv from 'csv-parse/sync';
import 'dotenv/config';

interface CsvRow {
    marketName: string;
    action: string;
    usdcAmount: string;
    tokenAmount: string;
    tokenName: string;
    timestamp: string;
    hash: string;
}

const mlbTeams = [
    'mets', 'nationals', 'braves', 'marlins', 'padres', 'mariners', 'giants', 'athletics',
    'orioles', 'yankees', 'dodgers', 'angels', 'tigers', 'red sox', 'astros', 'rangers',
    'phillies', 'pirates', 'cubs', 'diamondbacks', 'white sox', 'blue jays', 'guardians',
    'rockies', 'royals', 'cardinals', 'brewers', 'reds', 'twins', 'rays'
];

function isMlb(marketName: string): boolean {
    const name = marketName.toLowerCase();
    if (name.includes('kbo:')) return false; 
    if (name.includes('nhl') || name.includes('nba') || name.includes('ufc')) return false;
    return mlbTeams.some(team => name.includes(team));
}

async function main() {
    const filePath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-05-19.csv';
    if (!fs.existsSync(filePath)) {
        console.error(`CSV file not found at ${filePath}`);
        return;
    }

    let fileContent = fs.readFileSync(filePath, 'utf-8');
    if (fileContent.startsWith('\uFEFF')) {
        fileContent = fileContent.substring(1);
    }

    const records: CsvRow[] = csv.parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });

    const markets = new Map<string, {
        buys: number;
        sells: number;
        redeems: number;
        lastTx: number;
    }>();

    for (const r of records) {
        if (!isMlb(r.marketName)) continue;

        if (!markets.has(r.marketName)) {
            markets.set(r.marketName, {
                buys: 0,
                sells: 0,
                redeems: 0,
                lastTx: parseInt(r.timestamp)
            });
        }

        const m = markets.get(r.marketName)!;
        const usdc = parseFloat(r.usdcAmount) || 0;
        const ts = parseInt(r.timestamp);

        if (ts > m.lastTx) m.lastTx = ts;

        if (r.action.toLowerCase() === 'buy') {
            m.buys += usdc;
        } else if (r.action.toLowerCase() === 'sell') {
            m.sells += usdc;
        } else if (r.action.toLowerCase() === 'redeem') {
            m.redeems += usdc;
        }
    }

    // Convert to sorted list of closed trade events
    const events = Array.from(markets.values())
        .map(m => {
            const pnl = (m.sells + m.redeems) - m.buys;
            return {
                timestamp: m.lastTx,
                date: new Date(m.lastTx * 1000).toISOString().split('T')[0],
                pnl
            };
        })
        // Sort chronologically
        .sort((a, b) => a.timestamp - b.timestamp);

    // Group by date and calculate cumulative profit
    const dailyPnL = new Map<string, number>();
    for (const e of events) {
        dailyPnL.set(e.date, (dailyPnL.get(e.date) || 0) + e.pnl);
    }

    const sortedDates = Array.from(dailyPnL.keys()).sort();
    let cumulative = 0;
    const curve: { date: string; profit: number }[] = [];

    for (const d of sortedDates) {
        cumulative += dailyPnL.get(d)!;
        curve.push({ date: d, profit: cumulative });
    }

    console.log("Timeline points count:", curve.length);
    console.log("Start Date:", curve[0]?.date);
    console.log("End Date:", curve[curve.length - 1]?.date);
    console.log("Final Profit:", curve[curve.length - 1]?.profit.toFixed(2));
    
    // Print a few sample points
    console.log("\nSample Data Points (every 5th day):");
    curve.filter((_, idx) => idx % 5 === 0 || idx === curve.length - 1).forEach(pt => {
        console.log(`- ${pt.date}: $${pt.profit.toFixed(2)}`);
    });
}

main().catch(console.error);
