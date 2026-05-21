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

    let totalDeposited = 0;
    let totalWithdrawn = 0;

    for (const r of records) {
        const actionLower = r.action.toLowerCase();
        const usdc = parseFloat(r.usdcAmount) || 0;
        
        if (actionLower === 'deposit' || r.marketName.toLowerCase().includes('deposit')) {
            totalDeposited += usdc;
        } else if (actionLower === 'withdraw' || r.marketName.toLowerCase().includes('withdraw')) {
            totalWithdrawn += usdc;
        }
    }

    // Let's print out the deposit/withdrawal details to verify
    console.log("====================================================");
    console.log("             CAPITAL FLOW SUMMARY");
    console.log("====================================================");
    console.log(`Total USDC Deposited : $${totalDeposited.toFixed(2)}`);
    console.log(`Total USDC Withdrawn : $${totalWithdrawn.toFixed(2)}`);
    console.log(`Net Capital Invested : $${(totalDeposited - totalWithdrawn).toFixed(2)}`);
    console.log("====================================================");
}

main().catch(console.error);
