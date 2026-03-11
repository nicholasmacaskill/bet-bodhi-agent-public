/**
 * Bodhi Agent Prism
 * -------------------
 * This module unifies all the standalone analysis and logging scripts 
 * into a single clarity layer that an AI Agent can use to refract data.
 */

import { PillarAnalyzer } from '../pillar-analyzer';
import { NHLPillarAnalyzer } from '../nhl-pillar-analyzer';
import { MLBApi } from '../mlb-api';
import { NHLApi } from '../nhl-api';
import { OddsApi } from '../odds-api';
import { logBet, BetLogEntry } from '../bet-logger';
import { supabaseAdmin } from '../supabase-admin';

export class BodhiPrism {
    private mlb = new MLBApi();
    private nhl = new NHLApi();
    private odds = new OddsApi();
    private mlbAnalyzer = new PillarAnalyzer();
    private nhlAnalyzer = new NHLPillarAnalyzer();

    /**
     * Scans all MLB games for a given date and returns +EV opportunities.
     */
    async scanMLB(date: string, bankroll: number = 464) {
        const games = await this.mlb.getSchedule(date);
        const odds = await this.odds.getMLBOdds();

        // In a real agentic flow, we'd fetch specific game details here
        // For now, we'll map through them similar to our scripts
        return games.map(g => {
            // Simplified for the toolbox; real logic would fetch 'details' per game
            return this.mlbAnalyzer.analyzeGame(g, { probables: {}, lineups: {} }, odds, [], [], new Map(), bankroll);
        }).filter(a => a.overallConfidence >= 60);
    }

    /**
     * Scans all NHL games for a given date and returns +EV opportunities.
     */
    async scanNHL(date: string, bankroll: number = 464) {
        const games = await this.nhl.getSchedule(date);
        const stats = await this.nhl.getTeamStats();
        const odds = await this.odds.getNHLOdds();
        const leaders = await this.nhl.getGoalieLeaders();

        return games.map(g => {
            return this.nhlAnalyzer.analyzeGame(g, stats, odds, leaders, undefined, bankroll);
        }).filter(a => a.overallConfidence >= 60);
    }

    /**
     * Logs a bet with full psychometric tracking.
     */
    async recordBet(entry: BetLogEntry) {
        return await logBet(entry);
    }

    /**
     * Retrieves the user's current bankroll and performance stats.
     */
    async getUserState() {
        const { data } = await supabaseAdmin
            .from('user_profiles')
            .select('*')
            .limit(1)
            .single();
        return data;
    }

    /**
     * Analyzes recent betting behavior for psychological biases.
     */
    async analyzeBiases() {
        const { data: bets } = await supabaseAdmin
            .from('bets')
            .select('*')
            .order('created_at', { ascending: false });

        if (!bets || bets.length === 0) return "No betting history yet.";

        // We can add logic here to specifically detect things like 'chase_win'
        const recentWins = bets.filter(b => b.result === 'win').slice(0, 3);
        const nextBetAfterWin = bets.find(b => {
            const winTime = new Date(recentWins[0]?.created_at).getTime();
            const betTime = new Date(b.created_at).getTime();
            return betTime > winTime && (betTime - winTime) < (24 * 60 * 60 * 1000);
        });

        if (recentWins.length > 0 && nextBetAfterWin && nextBetAfterWin.amount > recentWins[0].amount * 1.5) {
            return "COMPLACENCY/OVERCONFIDENCE: You recently won a bet and increased your next stake by >50%.";
        }

        return "No immediate high-risk psychological patterns detected.";
    }

    /**
     * Circuit Breaker: Checks for a recent losing streak to throttle stakes.
     */
    async checkSlump(): Promise<{ isSlump: boolean; multiplier: number; reason: string }> {
        const { data: recentBets } = await supabaseAdmin
            .from('bets')
            .select('result')
            .not('result', 'eq', 'pending')
            .order('created_at', { ascending: false })
            .limit(5);

        if (!recentBets || recentBets.length < 3) {
            return { isSlump: false, multiplier: 1.0, reason: "Insufficient data" };
        }

        // Check if last 3 are losses
        const last3Losses = recentBets.slice(0, 3).every(b => b.result === 'loss');
        // Check if 4 of last 5 are losses
        const lossCount = recentBets.filter(b => b.result === 'loss').length;
        const last5Slump = recentBets.length === 5 && lossCount >= 4;

        if (last3Losses || last5Slump) {
            return {
                isSlump: true,
                multiplier: 0.5,
                reason: `SLUMP DETECTED: ${last3Losses ? "3 consecutive losses" : "4 losses in last 5 bets"}. Stakes throttled by 50%.`
            };
        }

        // Check for a win to break the slump
        if (recentBets[0].result === 'win') {
             // Slump broken
        }

        return { isSlump: false, multiplier: 1.0, reason: "Normal operations" };
    }
}
