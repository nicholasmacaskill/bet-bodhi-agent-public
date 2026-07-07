import { db } from '../src/lib/sqlite-client';

async function main() {
    const bets = db.prepare(`
        SELECT * FROM bets 
        ORDER BY created_at DESC 
        LIMIT 100
    `).all() as any[];

    console.log("=== ACTUAL BETS AUDIT (LAST 100) ===");
    console.log(`Total bets retrieved: ${bets.length}`);

    let totalWagered = 0;
    let totalPnl = 0;
    let wins = 0;
    let losses = 0;
    let pending = 0;

    const monthlyPnL: Record<string, { wagered: number; pnl: number; wins: number; total: number }> = {};

    for (const b of bets) {
        const amount = b.amount || 0;
        const odds = b.odds || 1;
        const result = b.result; // 'win', 'loss', 'pending'
        const date = b.created_at ? b.created_at.split(' ')[0] : 'Unknown';
        const month = date.substring(0, 7);

        if (!monthlyPnL[month]) {
            monthlyPnL[month] = { wagered: 0, pnl: 0, wins: 0, total: 0 };
        }

        monthlyPnL[month].total++;
        monthlyPnL[month].wagered += amount;
        totalWagered += amount;

        let pnl = 0;
        if (result === 'win') {
            // payout = amount * odds
            // profit = payout - amount
            pnl = (amount * odds) - amount;
            wins++;
            monthlyPnL[month].wins++;
            monthlyPnL[month].pnl += pnl;
            totalPnl += pnl;
        } else if (result === 'loss') {
            pnl = -amount;
            losses++;
            monthlyPnL[month].pnl += pnl;
            totalPnl += pnl;
        } else {
            pending++;
        }
    }

    console.log("\n=== ACTUAL MONTHLY PERFORMANCE ===");
    for (const [month, stats] of Object.entries(monthlyPnL)) {
        const wr = stats.total > 0 ? (stats.wins / (stats.total - pending)) * 100 : 0;
        console.log(`Month: ${month}`);
        console.log(`  - Total Bets: ${stats.total}`);
        console.log(`  - Win Rate (Resolved): ${wr.toFixed(1)}%`);
        console.log(`  - Total Wagered: $${stats.wagered.toFixed(2)}`);
        console.log(`  - Net Profit/Loss: $${stats.pnl.toFixed(2)}`);
    }

    console.log("\n=== RECENT BETS DETAILED LOG (LAST 20) ===");
    bets.slice(0, 20).forEach(b => {
        console.log(`[${b.created_at}] ${b.team} - Stake: $${b.amount} | Odds: ${b.odds} | Result: ${b.result} | Motivation: ${b.motivation_tag}`);
    });
}

main().catch(console.error);
