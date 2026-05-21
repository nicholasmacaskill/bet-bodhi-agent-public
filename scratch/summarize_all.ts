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
        rows: CsvRow[];
    }>();

    let totalDeposited = 0;
    let totalWithdrawn = 0;

    for (const r of records) {
        const actionLower = r.action.toLowerCase();
        const usdc = parseFloat(r.usdcAmount) || 0;

        if (actionLower === 'deposit' || r.marketName.toLowerCase().includes('deposit')) {
            totalDeposited += usdc;
            continue;
        } else if (actionLower === 'withdraw' || r.marketName.toLowerCase().includes('withdraw')) {
            totalWithdrawn += usdc;
            continue;
        }

        if (!markets.has(r.marketName)) {
            markets.set(r.marketName, {
                buys: 0,
                sells: 0,
                redeems: 0,
                rows: []
            });
        }

        const m = markets.get(r.marketName)!;
        m.rows.push(r);

        if (actionLower === 'buy') {
            m.buys += usdc;
        } else if (actionLower === 'sell') {
            m.sells += usdc;
        } else if (actionLower === 'redeem') {
            m.redeems += usdc;
        }
    }

    let totalBuyVolume = 0;
    let totalSellVolume = 0;
    let totalRedeemVolume = 0;
    let totalPnl = 0;

    let openMarketsCount = 0;
    let closedMarketsCount = 0;
    let openPositionsNetCost = 0;

    for (const [name, data] of markets.entries()) {
        const pnl = (data.sells + data.redeems) - data.buys;
        totalBuyVolume += data.buys;
        totalSellVolume += data.sells;
        totalRedeemVolume += data.redeems;
        totalPnl += pnl;

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

        // If it was never redeemed, and last transaction shows net shares are outstanding
        const isOpen = Math.abs(netShares) > 0.1 && data.redeems === 0;

        if (isOpen) {
            openMarketsCount++;
            openPositionsNetCost += (data.buys - data.sells);
        } else {
            closedMarketsCount++;
        }
    }

    console.log("====================================================");
    console.log("             OVERALL ACCOUNT RECONCILIATION");
    console.log("====================================================");
    console.log(`Total Deposited Capital  : $${totalDeposited.toFixed(2)}`);
    console.log(`Total Withdrawn Capital  : $${totalWithdrawn.toFixed(2)}`);
    console.log(`Net Capital Deposited    : $${(totalDeposited - totalWithdrawn).toFixed(2)}`);
    console.log(`\nTrading Activity:`);
    console.log(`Total Buy Volume (Bets)  : $${totalBuyVolume.toFixed(2)}`);
    console.log(`Total Sell Volume        : $${totalSellVolume.toFixed(2)}`);
    console.log(`Total Redeem Volume      : $${totalRedeemVolume.toFixed(2)}`);
    console.log(`Total Net Profit/Loss    : ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);
    console.log(`\nPortfolio Breakdown:`);
    console.log(`Open Positions Net Cost  : $${openPositionsNetCost.toFixed(2)}`);
    console.log(`Open Positions Count     : ${openMarketsCount}`);
    console.log(`Closed Positions Count   : ${closedMarketsCount}`);
    
    // Theoretical Balance = Net Capital Deposited + Total Net Profit
    const theoreticalBalance = (totalDeposited - totalWithdrawn) + totalPnl;
    console.log(`\nReconciled Bankroll Value: $${theoreticalBalance.toFixed(2)}`);
    console.log("====================================================");
}

main().catch(console.error);
