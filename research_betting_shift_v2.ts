
import { supabaseAdmin } from './src/lib/supabase-admin';
import 'dotenv/config';

async function researchBettingShiftV2() {
    console.log("Fetching detailed betting data for audit...");
    
    // Fetch all bets
    const { data: bets, error } = await supabaseAdmin
        .from('bets')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching bets:", error);
        return;
    }

    if (!bets || bets.length === 0) {
        console.log("No bets found.");
        return;
    }

    const SEASON_START = new Date('2026-03-27T00:00:00Z');

    function analyzePeriod(name: string, periodBets: any[]) {
        const total = periodBets.length;
        const wins = periodBets.filter(b => b.result === 'win');
        const losses = periodBets.filter(b => b.result === 'loss');
        const pending = periodBets.filter(b => b.result === 'pending');
        const settled = periodBets.filter(b => b.result !== 'pending');

        const totalStaked = periodBets.reduce((acc, b) => acc + Number(b.amount), 0);
        const settledStaked = settled.reduce((acc, b) => acc + Number(b.amount), 0);
        const pendingStaked = pending.reduce((acc, b) => acc + Number(b.amount), 0);
        
        // Sum payouts if they exist, or fallback to amount * odds for wins
        const totalPayout = settled.reduce((acc, b) => {
            if (b.result === 'win') {
                return acc + (b.payout && Number(b.payout) > 0 ? Number(b.payout) : Number(b.amount) * Number(b.odds));
            }
            if (b.result === 'push') return acc + Number(b.amount);
            return acc;
        }, 0);

        const settledNet = totalPayout - settledStaked;
        const settledROI = settledStaked > 0 ? (settledNet / settledStaked * 100) : 0;
        
        const weightedAvgOdds = settledStaked > 0 ? (settled.reduce((acc, b) => acc + Number(b.amount) * Number(b.odds), 0) / settledStaked) : 0;

        console.log(`\n--- ${name} ---`);
        console.log(`Total Bets: ${total} (Settled: ${settled.length}, Pending: ${pending.length})`);
        console.log(`Settled Win Rate: ${settled.length > 0 ? (wins.length / settled.length * 100).toFixed(1) : 0}% (${wins.length}W - ${losses.length}L)`);
        console.log(`Settled Stake: $${settledStaked.toFixed(2)}`);
        console.log(`Settled Payout: $${totalPayout.toFixed(2)}`);
        console.log(`Settled Net: $${settledNet.toFixed(2)}`);
        console.log(`Settled ROI: ${settledROI.toFixed(1)}%`);
        console.log(`Pending Stake: $${pendingStaked.toFixed(2)}`);
        console.log(`Weighted Avg Odds (Settled): ${weightedAvgOdds.toFixed(3)}`);
        
        // Breakdown by pillar
        const pillars: Record<string, { staked: number, pnl: number }> = {};
        settled.forEach(b => {
            const p = b.pillar_focus;
            if (!pillars[p]) pillars[p] = { staked: 0, pnl: 0 };
            const payout = b.result === 'win' ? (b.payout && Number(b.payout) > 0 ? Number(b.payout) : Number(b.amount) * Number(b.odds)) : (b.result === 'push' ? Number(b.amount) : 0);
            pillars[p].staked += Number(b.amount);
            pillars[p].pnl += (payout - Number(b.amount));
        });
        console.log("Pillar Performance (Settled):", pillars);
    }

    const springBets = bets.filter(b => new Date(b.created_at) < SEASON_START);
    const seasonBets = bets.filter(b => new Date(b.created_at) >= SEASON_START);

    analyzePeriod("Spring Training (Before Mar 27)", springBets);
    analyzePeriod("Regular Season (Mar 27+)", seasonBets);

    // Investigating Pending Spring Training Bets
    const oldPending = springBets.filter(b => b.result === 'pending');
    if (oldPending.length > 0) {
        console.log(`\n--- WARNING: ${oldPending.length} Spring Training bets are still PENDING ---`);
        console.log(`Oldest: ${new Date(oldPending[0].created_at).toISOString()}`);
        console.log(`Total Staked in pending Spring Training: $${oldPending.reduce((acc, b) => acc + Number(b.amount), 0).toFixed(2)}`);
    }
}

researchBettingShiftV2();
