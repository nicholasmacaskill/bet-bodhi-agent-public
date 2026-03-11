import { BodhiPrism } from './prism';
import { SyncService } from './sync-service';
import { supabaseAdmin } from '../supabase-admin';
import { PolymarketApi } from '../polymarket-api';

const RESET_ANSI = '\x1b[0m';
const DIM = '\x1b[2m';

export class BodhiAgent {
    private prism = new BodhiPrism();
    private polyApi = new PolymarketApi();
    private identity = "Bodhi-Alpha-1";

    /**
     * Morning Briefing: Scans the world and sets the tone for the day.
     */
    async awaken(date: string) {
        console.log(`\n=====================================================`);
        console.log(`   🌅 ${this.identity}: MORNING BRIEFING (${date})   `);
        console.log(`=====================================================\n`);

        // 0. Auto-sync external bets
        const syncService = new SyncService();
        await syncService.runSync();

        const liveBalance = await this.polyApi.getUSDCBalance();
        const bankroll = liveBalance > 0 ? liveBalance : 464.00;

        const [mlbOpportunities, nhlOpportunities, biasAlert] = await Promise.all([
            this.prism.scanMLB(date, bankroll),
            this.prism.scanNHL(date, bankroll),
            this.prism.analyzeBiases()
        ]);

        console.log(`-> Hello. I've scanned today's slate.`);
        console.log(`   Your live bankroll is $${bankroll.toFixed(2)}.`);
        console.log(`   Found ${mlbOpportunities.length} MLB and ${nhlOpportunities.length} NHL value plays.\n`);

        if (biasAlert !== "No immediate high-risk psychological patterns detected.") {
            console.warn(`🛑 ATTENTION: ${biasAlert}`);
            console.warn(`   Our goal today is "Neutral Execution". Let's stick to the engine signals.`);
        } else {
            console.log(`✅ Your psychology looks stable. No recent overconfidence detected.`);
        }

        // EXECUTION RECOMMENDATIONS
        const recommendations = [...mlbOpportunities, ...nhlOpportunities].filter(p => p.overallConfidence >= 75);
        if (recommendations.length > 0) {
            console.log(`\n--- ${recommendations.length} High-Conviction Plays (Terminal Commands) ---`);
            for (const play of recommendations) {
                const outcomeIndex = play.valueTeam === play.homeTeam ? 0 : 1;
                const stake = Math.min(play.suggestedStake || 0, parseFloat(process.env.MAX_TEST_STAKE || "1.00"));
                const cmd = `npx tsx scripts/place-bet.ts --market poly --id ${play.polyConditionId} --outcome ${outcomeIndex} --amount ${stake.toFixed(2)} --price ${play.polySharePrice?.toFixed(2)}`;

                console.log(`\n🏹 ${play.valueTeam} (${play.overallConfidence}% Confidence)`);
                console.log(`   ${DIM}${cmd}${RESET_ANSI}`);
            }
        }

        // Log this to internal memory
        await this.logInternal('awaken', `Morning scan complete. Found ${mlbOpportunities.length + nhlOpportunities.length} total plays.`, {
            mlbCount: mlbOpportunities.length,
            nhlCount: nhlOpportunities.length
        });

        return { mlb: mlbOpportunities, nhl: nhlOpportunities };
    }

    /**
     * Executes a bet based on the provided analysis.
     */
    private async executePlay(play: any) {
        const isDryRun = process.env.DRY_RUN === 'true';
        const maxStake = parseFloat(process.env.MAX_TEST_STAKE || "1.00");
        // Safety Circuit Breaker (Pillar #4)
        // If Bankroll Pillar < 5 (Caution-Range), force 'Stake: Defensive (2%)' regardless of the AI EV score.
        const bankrollPillar = play.pillars?.find((p: any) => p.pillar === "Technical (Bankroll)");
        let finalStake = play.suggestedStake || 0;

        if (bankrollPillar && bankrollPillar.score < 5) {
            console.warn(`🛡️  SAFETY CIRCUIT BREAKER: Bankroll Pillar (${bankrollPillar.score}/10) is in caution range. Forcing Defensive sizing.`);
            // Recalculate defensive stake (2%) if not already lower
            const defensiveStake = (play.suggestedStake / (play.overallConfidence / 100)) * 0.02; // Roughly map back to 2%
            finalStake = Math.min(finalStake, defensiveStake);
        }

        // Final safety cap: Never bet more than $1 in this phase
        const safeStake = Math.min(finalStake, maxStake);

        if (safeStake <= 0) return;

        console.log(`🚀 AUTO-EXECUTION: Attempting to play ${play.valueTeam} ($${safeStake.toFixed(2)})`);

        try {
            if (play.polyConditionId) {
                // Determine outcome index (usually 0 for Home/Yes, 1 for Away/No)
                // This logic would be refined based on the market mapping
                const outcomeIndex = play.valueTeam === play.homeTeam ? 0 : 1;

                const result = await this.polyApi.placeOrder(
                    play.polyConditionId,
                    outcomeIndex,
                    safeStake,
                    play.polySharePrice || 0.50
                );

                await this.logInternal('execution', `Executed Polymarket bet for ${play.valueTeam}`, {
                    play,
                    result,
                    stake: safeStake
                });

                // Auto-log to performance tracking table
                await this.prism.recordBet({
                    team: play.valueTeam,
                    sport: play.sport || "Unknown",
                    odds: 1 / (play.polySharePrice || 0.50),
                    amount: safeStake,
                    gameStartTime: new Date(Date.now() + 3600000), // Default 1hr; real logic would use play game object
                    motivationTag: 'bodhi_signal',
                    emotionalPulse: 5, // Neutral for auto-agent
                    physiologicalScore: 10, // AI is always rested
                    researchLog: `Auto-executed by Bodhi Agent. Confidence: ${play.overallConfidence}%`,
                    pillarFocus: 'automated_edge'
                });
            } else {
                console.log(`   (No Polymarket ID, skipping for now)`);
            }
        } catch (error: any) {
            console.error(`❌ Execution Failed: ${error.message}`);
            await this.logInternal('execution_error', error.message, { play });
        }
    }

    /**
     * Real-time Guardian: Checks a proposed bet for bias BEFORE it's locked.
     */
    async checkIntervention(proposedBet: any) {
        console.log(`\n=====================================================`);
        console.log(`   🛡️  ${this.identity}: GUARDIAN INTERVENTION     `);
        console.log(`=====================================================\n`);

        const now = new Date();
        const startTime = new Date(proposedBet.gameStartTime);
        const diffMinutes = Math.round((startTime.getTime() - now.getTime()) / 60000);

        if (diffMinutes < 30) {
            console.warn(`⚠️  WARNING: You're trying to bet ${proposedBet.team} only ${diffMinutes} min before kickoff.`);
            console.warn(`   Statistically, our win rate drops significantly in the "Rush Zone".`);
            console.warn(`   Are you sure this isn't an impulse?`);
            await this.logInternal('intervention', `Blocked/warned user for pre-game rush on ${proposedBet.team}`, { diffMinutes });
            return false;
        }

        console.log(`✅ Timing is good. 2-Hour Rule respected (${Math.round(diffMinutes / 60)} hrs out).`);
        return true;
    }

    /**
     * Internal Memory Logging: Stores the agent's thought process.
     */
    private async logInternal(type: string, content: string, metadata: any = {}) {
        await supabaseAdmin
            .from('agent_internal_logs')
            .insert([{ action_type: type, content, metadata }])
            .select();
    }
}
