
import { supabaseAdmin } from './src/lib/supabase-admin';
import 'dotenv/config';

async function researchBettingShift() {
    console.log("Fetching all bets to analyze the shift...");
    
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

    // Season Start Date (Opening Day was March 27, 2026 for most teams)
    const SEASON_START = new Date('2026-03-27T00:00:00Z');

    const springBets = bets.filter(b => new Date(b.created_at) < SEASON_START);
    const seasonBets = bets.filter(b => new Date(b.created_at) >= SEASON_START);

    function analyzePeriod(name: string, periodBets: any[]) {
        const totalBets = periodBets.length;
        const wins = periodBets.filter(b => b.result === 'win').length;
        const losses = periodBets.filter(b => b.result === 'loss').length;
        const winRate = totalBets > 0 ? (wins / (wins + losses) * 100) : 0;
        
        const totalStaked = periodBets.reduce((acc, b) => acc + parseFloat(b.amount), 0);
        const totalPayout = periodBets.reduce((acc, b) => {
            if (b.result === 'win') {
                return acc + (parseFloat(b.amount) * parseFloat(b.odds));
            }
            return acc;
        }, 0);
        
        const netProfit = totalPayout - totalStaked;
        const roi = totalStaked > 0 ? (netProfit / totalStaked * 100) : 0;
        const avgStake = totalBets > 0 ? (totalStaked / totalBets) : 0;
        const avgOdds = totalBets > 0 ? (periodBets.reduce((acc, b) => acc + parseFloat(b.odds), 0) / totalBets) : 0;

        console.log(`\n--- ${name} ---`);
        console.log(`Total Bets: ${totalBets}`);
        console.log(`Win Rate: ${winRate.toFixed(1)}% (${wins}W - ${losses}L)`);
        console.log(`Total Staked: $${totalStaked.toFixed(2)}`);
        console.log(`Net Profit: $${netProfit.toFixed(2)}`);
        console.log(`ROI: ${roi.toFixed(1)}%`);
        console.log(`Avg Stake: $${avgStake.toFixed(2)}`);
        console.log(`Avg Odds: ${avgOdds.toFixed(3)}`);
        
        // Pillar distribution
        const pillars: Record<string, number> = {};
        periodBets.forEach(b => {
            pillars[b.pillar_focus] = (pillars[b.pillar_focus] || 0) + 1;
        });
        console.log("Pillars:", pillars);

        // Average Emotional Pulse
        const avgPulse = periodBets.reduce((acc, b) => acc + (b.emotional_pulse || 0), 0) / totalBets;
        console.log(`Avg Emotional Pulse: ${avgPulse.toFixed(1)}`);
        
        // Max stake
        const maxStake = Math.max(...periodBets.map(b => parseFloat(b.amount)));
        console.log(`Max Stake: $${maxStake.toFixed(2)}`);
    }

    analyzePeriod("Spring Training (Before Mar 27)", springBets);
    analyzePeriod("Regular Season (Mar 27 - Present)", seasonBets);

    console.log("\n--- Result Distribution (Season) ---");
    const seasonResults = seasonBets.reduce((acc, b) => {
        acc[b.result] = (acc[b.result] || 0) + 1;
        return acc;
    }, {});
    console.log(seasonResults);

    // Deep dive into recent "In the negatives" period
    const last3Days = bets.filter(b => {
        const d = new Date(b.created_at);
        const now = new Date();
        return (now.getTime() - d.getTime()) < (3 * 24 * 60 * 60 * 1000);
    });
    
    if (last3Days.length > 0) {
        console.log("\n--- Last 3 Days Bets ---");
        last3Days.forEach((b) => {
            console.log(`${new Date(b.created_at).toISOString()} | ${b.team.padEnd(25)} | $${b.amount.toString().padEnd(6)} | Odds: ${b.odds} | Result: ${b.result}`);
        });
    }

    analyzePeriod("Last 3 Days Deep Dive", last3Days);
}

researchBettingShift();
