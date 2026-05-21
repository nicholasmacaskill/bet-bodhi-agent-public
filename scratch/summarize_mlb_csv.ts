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
        firstTx: number;
        lastTx: number;
        rows: CsvRow[];
    }>();

    for (const r of records) {
        if (!isMlb(r.marketName)) continue;

        if (!markets.has(r.marketName)) {
            markets.set(r.marketName, {
                buys: 0,
                sells: 0,
                redeems: 0,
                firstTx: parseInt(r.timestamp),
                lastTx: parseInt(r.timestamp),
                rows: []
            });
        }

        const m = markets.get(r.marketName)!;
        const usdc = parseFloat(r.usdcAmount) || 0;
        const ts = parseInt(r.timestamp);

        if (ts < m.firstTx) m.firstTx = ts;
        if (ts > m.lastTx) m.lastTx = ts;
        m.rows.push(r);

        if (r.action.toLowerCase() === 'buy') {
            m.buys += usdc;
        } else if (r.action.toLowerCase() === 'sell') {
            m.sells += usdc;
        } else if (r.action.toLowerCase() === 'redeem') {
            m.redeems += usdc;
        }
    }

    const summary: any[] = [];
    let totalInvested = 0;
    let totalReturned = 0;
    let totalPnl = 0;
    let wins = 0;
    let losses = 0;

    for (const [name, data] of markets.entries()) {
        const pnl = (data.sells + data.redeems) - data.buys;

        let netShares = 0;
        for (const row of data.rows) {
            const shares = parseFloat(row.tokenAmount) || 0;
            if (row.action.toLowerCase() === 'buy') {
                netShares += shares;
            } else if (row.action.toLowerCase() === 'sell') {
                netShares -= shares;
            } else if (row.action.toLowerCase() === 'redeem') {
                netShares = 0;
            }
        }

        const isOpen = Math.abs(netShares) > 0.1 && data.redeems === 0 && (Date.now()/1000 - data.lastTx < 86400 * 2);

        if (isOpen) {
            // Do not classify as win/loss yet
        } else {
            if (pnl > 0.05) wins++;
            else if (pnl < -0.05) losses++;
        }

        totalInvested += data.buys;
        totalReturned += (data.sells + data.redeems);
        totalPnl += pnl;

        summary.push({
            name,
            buys: data.buys,
            sells: data.sells,
            redeems: data.redeems,
            pnl,
            isOpen,
            netShares,
            firstTx: new Date(data.firstTx * 1000).toLocaleDateString(),
            lastTx: new Date(data.lastTx * 1000).toLocaleDateString()
        });
    }

    const closedMarkets = summary.filter(m => !m.isOpen).sort((a, b) => b.pnl - a.pnl);
    const winRate = (wins / (wins + losses)) * 100;
    const roi = (totalPnl / totalInvested) * 100;

    console.log("====================================================");
    console.log("             MLB PERFORMANCE SUMMARY");
    console.log("====================================================");
    console.log(`Total MLB Markets Traded : ${markets.size}`);
    console.log(`Resolved Markets         : ${closedMarkets.length}`);
    console.log(`Wins (Closed)            : ${wins}`);
    console.log(`Losses (Closed)          : ${losses}`);
    console.log(`Win Rate                 : ${winRate.toFixed(1)}%`);
    console.log(`Total USDC Invested      : $${totalInvested.toFixed(2)}`);
    console.log(`Total USDC Returned      : $${totalReturned.toFixed(2)}`);
    console.log(`Total PnL (Closed+Open)  : ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);
    console.log(`Overall Return on Capital: ${roi.toFixed(1)}%`);
    console.log("====================================================");

    // Save full investor report markdown
    const reportPath = '/Users/nicholasmacaskill/.gemini/antigravity/brain/31e9aa45-4f40-4f7d-bb74-56cbfcb1135b/browser/mlb_investor_report.md';
    let md = `# MLB Betting Performance Report\n`;
    md += `*Generated from on-chain history as of ${new Date().toLocaleDateString()}*\n\n`;
    md += `## Executive Summary\n`;
    md += `This report outlines the historical performance of the MLB sports betting model and strategy executed on Polymarket. The strategy utilizes a Bayesian predictive engine integrated with real-time roster and pitching data to identify mispriced moneyline contracts.\n\n`;
    
    md += `### Key Metrics\n`;
    md += `| Metric | Value |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **Total MLB Markets Traded** | ${markets.size} |\n`;
    md += `| **Resolved Markets** | ${closedMarkets.length} |\n`;
    md += `| **Wins** | ${wins} |\n`;
    md += `| **Losses** | ${losses} |\n`;
    md += `| **Win Rate** | **${winRate.toFixed(1)}%** |\n`;
    md += `| **Total Capital Invested** | $${totalInvested.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDC |\n`;
    md += `| **Total Capital Returned** | $${totalReturned.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDC |\n`;
    md += `| **Net Profit (PnL)** | **$${totalPnl.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDC** |\n`;
    md += `| **Return on Investment (ROI)** | **${roi.toFixed(1)}%** |\n\n`;

    md += `## Top 10 Most Profitable Matches\n`;
    md += `| Matchup | Invested | PnL | ROI | Date |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    closedMarkets.slice(0, 10).forEach(m => {
        const mRoi = (m.pnl / m.buys) * 100;
        md += `| ${m.name} | $${m.buys.toFixed(2)} | +$${m.pnl.toFixed(2)} | ${mRoi.toFixed(1)}% | ${m.lastTx} |\n`;
    });

    md += `\n## Top 5 Largest Drawdowns / Losses\n`;
    md += `| Matchup | Invested | PnL | ROI | Date |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    closedMarkets.slice(-5).reverse().forEach(m => {
        const mRoi = (m.pnl / m.buys) * 100;
        md += `| ${m.name} | $${m.buys.toFixed(2)} | $${m.pnl.toFixed(2)} | ${mRoi.toFixed(1)}% | ${m.lastTx} |\n`;
    });

    fs.writeFileSync(reportPath, md);
    console.log(`Saved detailed report to ${reportPath}`);
}

main().catch(console.error);
