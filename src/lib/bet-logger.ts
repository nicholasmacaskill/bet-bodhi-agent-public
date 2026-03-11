/**
 * Bodhi Bet Logger
 * ----------------
 * Central function for logging all bets with psychometric tracking.
 * Use this for every new bet going forward.
 */

import 'dotenv/config';
import { supabaseAdmin } from './supabase-admin';

export type MotivationTag =
    | 'bodhi_signal'   // Engine-generated, pre-committed pick
    | 'analysis'       // Researched well in advance (2+ hrs before game)
    | 'gut_feel'       // Instinct / narrative / "feels right"
    | 'chase_win'      // Placed after a recent win (momentum bias)
    | 'fade_public'    // Fading the popular/mainstream side
    | 'line_value';    // Spotted a specific market pricing error

export interface BetLogEntry {
    team: string;
    sport: string;
    odds: number;
    amount: number;
    gameStartTime: Date;      // When the game starts (used to compute time_to_kickoff)
    motivationTag: MotivationTag | 'external_sync';
    emotionalPulse?: number;  // 1-10: How "pumped up" you feel (10 = euphoric)
    physiologicalScore?: number; // 1-10: How rested/sharp you feel
    researchLog?: string;
    pillarFocus?: string;
    platform?: 'manual' | 'polymarket' | 'agent';
    externalId?: string;
}

export async function logBet(entry: BetLogEntry): Promise<void> {
    const now = new Date();
    const minutesToKickoff = Math.round((entry.gameStartTime.getTime() - now.getTime()) / 60000);

    // Psychometric warning flags
    if (minutesToKickoff < 30) {
        console.warn(`⚠️  PRE-GAME RUSH FLAG: Bet placed only ${minutesToKickoff} min before kickoff.`);
        console.warn(`   The Bodhi 2-Hour Rule recommends committing picks 2+ hrs in advance.`);
    }
    if (entry.motivationTag === 'chase_win') {
        console.warn(`⚠️  CHASE-WIN BIAS FLAG: This bet is tagged as momentum-driven.`);
        console.warn(`   Consider waiting for the next clean Bodhi signal instead.`);
    }

    // 1. Get User Profile
    const { data: profiles, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, current_balance')
        .limit(1);

    if (profileError || !profiles || profiles.length === 0) {
        console.error('❌ User profile not found. Cannot log bet.');
        return;
    }

    const userId = profiles[0].id;
    const currentBalance = Number(profiles[0].current_balance);

    // 2. Insert Bet
    const { error: betError } = await supabaseAdmin
        .from('bets')
        .insert([{
            user_id: userId,
            team: entry.team,
            odds: entry.odds,
            amount: entry.amount,
            emotional_pulse: entry.emotionalPulse ?? 5,
            physiological_score: entry.physiologicalScore ?? 5,
            research_log: entry.researchLog ?? '',
            pillar_focus: entry.pillarFocus ?? 'technical_sport',
            result: 'pending',
            time_to_kickoff_minutes: minutesToKickoff,
            motivation_tag: entry.motivationTag,
            platform: entry.platform || 'manual',
            external_id: entry.externalId,
        }]);

    if (betError) {
        // If column doesn't exist yet, fall back gracefully
        if (betError.message.includes('time_to_kickoff') || betError.message.includes('motivation_tag')) {
            console.warn('⚠️  Psychometric columns not yet in DB. Run the SQL migration first.');
            console.warn('   Logging bet WITHOUT psychometric fields as fallback...');
            await supabaseAdmin.from('bets').insert([{
                user_id: userId,
                team: entry.team,
                odds: entry.odds,
                amount: entry.amount,
                emotional_pulse: entry.emotionalPulse ?? 5,
                physiological_score: entry.physiologicalScore ?? 5,
                research_log: entry.researchLog ?? '',
                pillar_focus: entry.pillarFocus ?? 'technical_sport',
                result: 'pending',
            }]);
        } else {
            console.error('❌ Failed to log bet:', betError.message);
            return;
        }
    }

    // 3. Deduct from Bankroll
    const newBalance = currentBalance - entry.amount;
    await supabaseAdmin
        .from('user_profiles')
        .update({ current_balance: newBalance })
        .eq('id', userId);

    // 4. Output Summary
    console.log(`\n✅ BET LOGGED`);
    console.log(`   Team:        ${entry.team}`);
    console.log(`   Sport:       ${entry.sport}`);
    console.log(`   Odds:        ${entry.odds} (${entry.odds >= 2.0 ? '+' + Math.round((entry.odds - 1) * 100) : '-' + Math.round(100 / (entry.odds - 1))})`);
    console.log(`   Stake:       $${entry.amount.toFixed(2)}`);
    console.log(`   To Win:      $${((entry.odds - 1) * entry.amount).toFixed(2)}`);
    console.log(`   Motivation:  ${entry.motivationTag}`);
    console.log(`   Pre-Game:    ${minutesToKickoff} min to kickoff`);
    console.log(`   Balance:     $${newBalance.toFixed(2)}`);
    if (minutesToKickoff < 120) {
        console.log(`   ⚠️  Bodhi Flag: <2-hour window. Carry this read into the bias report.`);
    }
}
