import 'dotenv/config';
import { supabaseAdmin } from '../src/lib/supabase-admin';

type Bet = {
    team: string;
    odds: number;
    amount: number;
    result: string;
    motivation_tag: string | null;
    time_to_kickoff_minutes: number | null;
    pillar_focus: string | null;
    emotional_pulse: number | null;
    physiological_score: number | null;
    created_at: string;
};

async function analyze() {
    const { data: bets, error } = await supabaseAdmin
        .from('bets')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !bets || bets.length === 0) {
        console.error('Error fetching bets or no bets found:', error);
        return;
    }

    const allBets = bets as Bet[];
    const resolved = allBets.filter(b => b.result === 'win' || b.result === 'loss');
    
    console.log(`Loaded ${allBets.length} total bets. Resolved: ${resolved.length}.`);

    // Helper functions
    const getStats = (group: Bet[]) => {
        const resGroup = group.filter(b => b.result === 'win' || b.result === 'loss');
        if (resGroup.length === 0) return { count: 0, winRate: '0%', profit: 0, roi: '0%' };
        const wins = resGroup.filter(b => b.result === 'win').length;
        let profit = 0;
        for (const b of resGroup) {
            if (b.result === 'win') profit += (b.odds - 1) * b.amount;
            else profit -= b.amount;
        }
        const staked = resGroup.reduce((s, b) => s + b.amount, 0);
        return {
            count: resGroup.length,
            winRate: `${Math.round((wins / resGroup.length) * 100)}% (${wins}/${resGroup.length})`,
            profit,
            roi: `${((profit / staked) * 100).toFixed(1)}%`
        };
    };

    // 1. By Odds Ranges
    console.log('\n--- 🎯 ODDS RANGE ANALYSIS ---');
    const ranges: [string, (b: Bet) => boolean][] = [
        ['Favorites (Odds < 1.7)', b => b.odds < 1.7],
        ['Slight Favorites/Evens (1.7 - 2.1)', b => b.odds >= 1.7 && b.odds <= 2.1],
        ['Underdogs (2.1 - 3.0)', b => b.odds > 2.1 && b.odds <= 3.0],
        ['Deep Underdogs (Odds > 3.0)', b => b.odds > 3.0]
    ];
    for (const [name, filter] of ranges) {
        const stats = getStats(resolved.filter(filter));
        console.log(`${name.padEnd(40)} | Count: ${stats.count} | WinRate: ${stats.winRate.padEnd(12)} | Profit: $${stats.profit.toFixed(2).padStart(8)} | ROI: ${stats.roi}`);
    }

    // 2. By Pillar Focus
    console.log('\n--- 🏛️ PILLAR FOCUS ANALYSIS ---');
    const pillars = Array.from(new Set(resolved.map(b => b.pillar_focus).filter(Boolean)));
    for (const p of pillars) {
        const stats = getStats(resolved.filter(b => b.pillar_focus === p));
        console.log(`${String(p).padEnd(40)} | Count: ${stats.count} | WinRate: ${stats.winRate.padEnd(12)} | Profit: $${stats.profit.toFixed(2).padStart(8)} | ROI: ${stats.roi}`);
    }

    // 3. By Team (Top 10 Profitable vs Top 10 Unprofitable)
    console.log('\n--- 🏟️ TEAM-BY-TEAM ANALYSIS ---');
    const teamMap: { [team: string]: Bet[] } = {};
    for (const b of resolved) {
        if (!teamMap[b.team]) teamMap[b.team] = [];
        teamMap[b.team].push(b);
    }
    const teamStats = Object.entries(teamMap).map(([team, group]) => {
        const stats = getStats(group);
        return { team, ...stats };
    });
    
    // Sort by profit descending
    teamStats.sort((a, b) => b.profit - a.profit);
    console.log('Top 8 Most Profitable Teams:');
    teamStats.slice(0, 8).forEach(t => {
        console.log(`  ${t.team.padEnd(30)} | Count: ${t.count} | WinRate: ${t.winRate.padEnd(12)} | Profit: $${t.profit.toFixed(2).padStart(8)} | ROI: ${t.roi}`);
    });
    
    console.log('\nTop 8 Least Profitable Teams:');
    teamStats.slice(-8).reverse().forEach(t => {
        console.log(`  ${t.team.padEnd(30)} | Count: ${t.count} | WinRate: ${t.winRate.padEnd(12)} | Profit: $${t.profit.toFixed(2).padStart(8)} | ROI: ${t.roi}`);
    });

    // 4. By Timing & Kickoff
    console.log('\n--- ⏱️ TIMING & KICKOFF RUN ---');
    const timings: [string, (b: Bet) => boolean][] = [
        ['Live Bets (Placed after kickoff)', b => b.time_to_kickoff_minutes !== null && b.time_to_kickoff_minutes < 0],
        ['Pre-Game Bets (Total)', b => b.time_to_kickoff_minutes !== null && b.time_to_kickoff_minutes >= 0],
        ['  - Under 30 mins pre-kickoff', b => b.time_to_kickoff_minutes !== null && b.time_to_kickoff_minutes >= 0 && b.time_to_kickoff_minutes < 30],
        ['  - 30m to 2h pre-kickoff', b => b.time_to_kickoff_minutes !== null && b.time_to_kickoff_minutes >= 30 && b.time_to_kickoff_minutes < 120],
        ['  - 2h to 6h pre-kickoff', b => b.time_to_kickoff_minutes !== null && b.time_to_kickoff_minutes >= 120 && b.time_to_kickoff_minutes < 360],
        ['  - Over 6h pre-kickoff', b => b.time_to_kickoff_minutes !== null && b.time_to_kickoff_minutes >= 360],
    ];
    for (const [name, filter] of timings) {
        const stats = getStats(resolved.filter(filter));
        console.log(`${name.padEnd(40)} | Count: ${stats.count} | WinRate: ${stats.winRate.padEnd(12)} | Profit: $${stats.profit.toFixed(2).padStart(8)} | ROI: ${stats.roi}`);
    }

    // 5. By Month
    console.log('\n--- 📅 MONTH-BY-MONTH SUMMARY ---');
    const monthlyMap: { [month: string]: Bet[] } = {};
    for (const b of resolved) {
        const month = b.created_at.slice(0, 7); // YYYY-MM
        if (!monthlyMap[month]) monthlyMap[month] = [];
        monthlyMap[month].push(b);
    }
    const sortedMonths = Object.keys(monthlyMap).sort();
    for (const m of sortedMonths) {
        const stats = getStats(monthlyMap[m]);
        console.log(`${m.padEnd(40)} | Count: ${stats.count} | WinRate: ${stats.winRate.padEnd(12)} | Profit: $${stats.profit.toFixed(2).padStart(8)} | ROI: ${stats.roi}`);
    }
}

analyze().catch(console.error);
