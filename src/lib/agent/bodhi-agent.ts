/**
 * Bodhi Agent v1.0
 * -----------------
 * A proactive, autonomous entity that uses the BodhiToolbox to monitor 
 * markets, detect bias, and "Coach" you through the day.
 */

import { BodhiPrism } from './prism';
import { supabaseAdmin } from '../supabase-admin';

export class BodhiAgent {
    private prism = new BodhiPrism();
    private identity = "Bodhi-Alpha-1";

    /**
     * Morning Briefing: Scans the world and sets the tone for the day.
     */
    async awaken(date: string) {
        console.log(`\n=====================================================`);
        console.log(`   🌅 ${this.identity}: MORNING BREIFING (${date})   `);
        console.log(`=====================================================\n`);

        const mlbOpportunities = await this.prism.scanMLB(date);
        const nhlOpportunities = await this.prism.scanNHL(date);
        const userState = await this.prism.getUserState();
        const biasAlert = await this.prism.analyzeBiases();

        console.log(`-> Hello. I've scanned today's slate.`);
        console.log(`   Your current bankroll is $${userState?.current_balance?.toFixed(2) || '500.00'}.`);
        console.log(`   Found ${mlbOpportunities.length} MLB and ${nhlOpportunities.length} NHL value plays.\n`);

        if (biasAlert !== "No immediate high-risk psychological patterns detected.") {
            console.warn(`🛑 ATTENTION: ${biasAlert}`);
            console.warn(`   Our goal today is "Neutral Execution". Let's stick to the engine signals.`);
        } else {
            console.log(`✅ Your psychology looks stable. No recent overconfidence detected.`);
        }

        // Log this to internal memory
        await this.logInternal('awaken', `Morning scan complete. Found ${mlbOpportunities.length + nhlOpportunities.length} total plays. User balance: $${userState?.current_balance}`, {
            mlbCount: mlbOpportunities.length,
            nhlCount: nhlOpportunities.length
        });

        return { mlb: mlbOpportunities, nhl: nhlOpportunities };
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
