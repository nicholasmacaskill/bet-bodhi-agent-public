
import * as fs from 'fs';

const MLB_MARKETS = [
    "Guardians", "Dodgers", "Mets", "Cardinals", "Padres", "Giants", 
    "Rangers", "Orioles", "Yankees", "Mariners", "Twins", "Royals", 
    "Angels", "Cubs", "Astros", "Phillies", "Rays", "Brewers", 
    "Diamondbacks", "Blue Jays", "Marlins", "White Sox", "Pirates", 
    "Nationals", "Athletics", "Rockies", "Red Sox", "Reds", "Tigers"
];

function analyzeMLBPnl() {
    const filePath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-04-02.csv';
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/\"/g, '').trim());

    console.log('--- ⚾ MLB-ONLY PNL AUDIT (APRIL 2nd UPDATE) ---');
    
    let totalInvested = 0;
    let totalCashedOut = 0;
    
    const gameStats: Record<string, { invested: number, returns: number }> = {};

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // Custom parser to handle quotes containing commas
        const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!matches || matches.length < 3) continue;
        
        const r: any = {};
        headers.forEach((h, idx) => {
            r[h] = (matches[idx] || '').replace(/\"/g, '').trim();
        });

        const marketName = r.marketName;
        const action = r.action;
        const amount = parseFloat(r.usdcAmount) || 0;

        const isMLB = MLB_MARKETS.some(team => marketName.includes(team));
        if (!isMLB) continue;

        if (!gameStats[marketName]) {
            gameStats[marketName] = { invested: 0, returns: 0 };
        }

        if (action === 'Buy') {
            totalInvested += amount;
            gameStats[marketName].invested += amount;
        } else if (action === 'Sell' || action === 'Redeem') {
            totalCashedOut += amount;
            gameStats[marketName].returns += amount;
        }
    }

    console.log(`\n${'Market'.padEnd(50)} | ${'Invested'.padEnd(10)} | ${'Returned'.padEnd(10)} | ${'Net PNL'.padEnd(10)}`);
    console.log('-'.repeat(85));

    Object.entries(gameStats).forEach(([name, stats]) => {
        const net = stats.returns - stats.invested;
        if (stats.invested > 0 || stats.returns > 0) {
            console.log(`${name.padEnd(50)} | $${stats.invested.toFixed(2).padEnd(9)} | $${stats.returns.toFixed(2).padEnd(9)} | ${net >= 0 ? '+' : '-'}$${Math.abs(net).toFixed(2)}`);
        }
    });

    const finalNet = totalCashedOut - totalInvested;
    console.log('-'.repeat(85));
    console.log(`TOTAL INVESTED: $${totalInvested.toFixed(2)}`);
    console.log(`TOTAL RETURNED: $${totalCashedOut.toFixed(2)}`);
    console.log(`FINAL BASEBALL NET PNL: ${finalNet >= 0 ? '+' : '-'}$${Math.abs(finalNet).toFixed(2)}`);
}

analyzeMLBPnl();
