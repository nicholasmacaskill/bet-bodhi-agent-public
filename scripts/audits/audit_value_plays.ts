
import * as fs from 'fs';

const MLB_TEAMS = [
    "Guardians", "Dodgers", "Mets", "Cardinals", "Padres", "Giants", 
    "Rangers", "Orioles", "Yankees", "Mariners", "Twins", "Royals", 
    "Angels", "Cubs", "Astros", "Phillies", "Rays", "Brewers", 
    "Diamondbacks", "Blue Jays", "Marlins", "White Sox", "Pirates", 
    "Nationals", "Athletics", "Rockies", "Red Sox", "Reds", "Tigers"
];

function analyzeValuePlays() {
    const filePath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-04-02.csv';
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/\"/g, '').trim());

    const valuePlays: any[] = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!matches || matches.length < 5) continue;
        
        const r: any = {};
        headers.forEach((h, idx) => {
            r[h] = (matches[idx] || '').replace(/\"/g, '').trim();
        });

        const isMLB = MLB_TEAMS.some(team => r.marketName.includes(team));
        if (!isMLB) continue;

        const amount = parseFloat(r.usdcAmount) || 0;
        const tokens = parseFloat(r.tokenAmount) || 0;
        const price = (amount > 0 && tokens > 0) ? (amount / tokens) : 0;

        // If Buy and Price < 0.50 (Underdog)
        if (r.action === 'Buy' && price > 0 && price <= 0.45) {
            valuePlays.push({
                market: r.marketName,
                team: r.tokenName,
                price: price.toFixed(2),
                amount,
                tokens,
                timestamp: parseInt(r.timestamp),
                won: false
            });
        }
    }

    // Now check if those plays 'won' by looking for a Redeem or Sell (near return)
    // For simplicity in a script, we'll mark as 'won' if the team eventually had a Sell or Redeem with usdcAmount > amount
    valuePlays.forEach(play => {
        const outcomes = lines.filter(l => l.includes(play.market) && l.includes(play.team));
        outcomes.forEach(l => {
            const m = l.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (m && (m[1].includes('Redeem') || m[1].includes('Sell'))) {
                const retAmt = parseFloat(m[2].replace(/\"/g, '')) || 0;
                if (retAmt > play.amount) play.won = true;
            }
        });
    });

    console.log('--- 🛡️ VALUE PLAY AUDIT (UNDERDOGS <= 45c) ---');
    console.log(`Total Value Plays Identified: ${valuePlays.length}`);
    
    // Split by 2 week window (Timestamp < or > ~1774000000 approx)
    const cutOff = 1774000000; 
    const recent = valuePlays.filter(p => p.timestamp >= cutOff);
    const older = valuePlays.filter(p => p.timestamp < cutOff);

    const calcWinRate = (arr: any[]) => {
        const wins = arr.filter(p => p.won).length;
        return { wins, total: arr.length, rate: arr.length > 0 ? (wins / arr.length * 100).toFixed(1) : 0 };
    };

    const recentStats = calcWinRate(recent);
    const olderStats = calcWinRate(older);

    console.log('\n--- 📈 WIN RATE TRENDS ---');
    console.log(`OLDER THAN 2 WEEKS: ${olderStats.wins}/${olderStats.total} (${olderStats.rate}%)`);
    console.log(`LAST 2 WEEKS: ${recentStats.wins}/${recentStats.total} (${recentStats.rate}%) 🚀`);

    console.log('\n--- 🏆 RECENT BIG VALUE HITS ---');
    recent.filter(p => p.won).slice(0, 5).forEach(p => {
        console.log(`${p.market} (${p.team}) @ ${p.price}c | Stake: $${p.amount.toFixed(2)}`);
    });
}

analyzeValuePlays();
