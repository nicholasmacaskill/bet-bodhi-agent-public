import { PillarScore, BodhiAnalysis } from './pillar-analyzer';
import { FighterStats } from './mma-api';

export class MMAPillarAnalyzer {

    analyzeFight(
        fight: any,
        fighterStats: Record<string, FighterStats>,
        polyMarket?: any,
        bankroll: number = 464,
        mood?: string,
        calmness?: number
    ): BodhiAnalysis {
        const pillars: PillarScore[] = [];

        const f1 = fighterStats[fight.fighter1];
        const f2 = fighterStats[fight.fighter2];

        if (!f1 || !f2) {
            return {
                gamePk: 0,
                homeTeam: fight.fighter2,
                awayTeam: fight.fighter1,
                overallConfidence: 50,
                pillars: [],
                recommendedAction: "PASS - Missing fighter data.",
                recommendedSize: "Zero (0%)",
                suggestedStake: 0
            };
        }

        // 1. Technical Combat (Performance Stats)
        const techCombat = this.scoreTechnicalCombat(f1, f2);
        pillars.push(techCombat);

        // 2. Altitude/Environment (Mexico City Factor)
        const envScore = this.scoreAltitudeFactor(f1, f2);
        pillars.push(envScore);

        // 3. Psychological (Players)
        const psychPlayersScore = {
            pillar: "Psychological (Players)",
            score: 6,
            reason: "Standard matchup intent. No championship-level psychological multipliers detected."
        };
        pillars.push(psychPlayersScore);

        // bodhiProb calculation
        const bodhiProb = (techCombat.score + envScore.score + psychPlayersScore.score) / 30;

        // 4. Technical (Bookies)
        let bookieScore: PillarScore = {
            pillar: "Technical (Bookies)",
            score: 5,
            reason: "No Polymarket match found. Neutral default.",
            side: "neutral"
        };

        let recommendedAction = "PASS - No clear edge.";
        let valueTeam = undefined;
        let polyConditionId = undefined;
        let polySharePrice = undefined;
        let polyEV = undefined;
        let homePrice = 0; // Price for f2 (home team)
        let awayPrice = 0; // Price for f1 (away team)
        let homeIdx = -1;
        let awayIdx = -1;

        // 3. Polymarket EV Calculation
        if (polyMarket && polyMarket.outcomes) {
            polyConditionId = polyMarket.conditionId;

            for (let i = 0; i < polyMarket.outcomes.length; i++) {
                const outcomeName = polyMarket.outcomes[i].toLowerCase();
                const price = parseFloat(polyMarket.outcomePrices[i]);

                const f1Parts = f1.name.toLowerCase().split(' ');
                const f2Parts = f2.name.toLowerCase().split(' ');

                if (f1Parts.some((p: string) => outcomeName.includes(p)) || outcomeName.includes(f1.name.toLowerCase())) {
                    awayPrice = price; // Fighter 1 (away)
                    awayIdx = i;
                } else if (f2Parts.some((p: string) => outcomeName.includes(p)) || outcomeName.includes(f2.name.toLowerCase())) {
                    homePrice = price; // Fighter 2 (home)
                    homeIdx = i;
                }
            }

            const techFavored = techCombat.side;

            if (techFavored !== 'neutral') {
                let marketPrice = techFavored === f1.name ? awayPrice : homePrice;
                valueTeam = techFavored === f1.name ? f1.name : f2.name;

                if (marketPrice > 0) {
                    polyEV = bodhiProb - marketPrice;
                    polySharePrice = marketPrice;

                    if (polyEV > 0.10) {
                        bookieScore.score = 9;
                        bookieScore.reason = `Massive Web3 Arb. Bodhi: ${(bodhiProb * 100).toFixed(1)}% vs Crowd: ${(marketPrice * 100).toFixed(1)}%. +${(polyEV * 100).toFixed(1)}% EV.`;
                        bookieScore.side = techFavored;
                        recommendedAction = `HIGH CONVICTION - Buy ${valueTeam} Shares on Polymarket (+${(polyEV * 100).toFixed(1)}% EV).`;
                    } else if (polyEV > 0.03) {
                        bookieScore.score = 7;
                        bookieScore.reason = `Small Web3 edge (+${(polyEV * 100).toFixed(1)}% EV) on ${valueTeam}.`;
                        bookieScore.side = techFavored;
                        recommendedAction = `LEAN - Small EV edge on ${valueTeam}. Buy shares.`;
                    } else if (polyEV < -0.10) {
                        bookieScore.score = 2;
                        bookieScore.reason = `Fading Crowd. Bodhi lean strongly opposed by Polymarket. Negative EV (${(polyEV * 100).toFixed(1)}%).`;
                        bookieScore.side = techFavored === 'away' ? 'home' : 'away';
                        recommendedAction = `PASS - Negative EV (${(polyEV * 100).toFixed(1)}%). Crowd hates this bet.`;
                        valueTeam = undefined;
                    } else {
                        bookieScore.score = 5;
                        bookieScore.reason = "Bodhi probability accurately mirrors Polymarket share price. No edge.";
                        recommendedAction = "PASS - Efficient Market. No EV edge.";
                        valueTeam = undefined;
                    }
                }
            }
        }
        pillars.push(bookieScore);

        // 5. Technical (Bankroll)
        pillars.push({
            pillar: "Technical (Bankroll)",
            score: bankroll >= 400 ? 9 : 6,
            reason: "Bankroll capacity supports MMA variance."
        });

        // 6. Psychological (Bettor)
        let bettorScore = 10;
        let bettorReason = "Flow state confirmed. Objective Bodhi signals followed.";
        if (calmness !== undefined) {
            bettorScore = Math.min(10, Math.max(1, calmness));
            if (calmness < 7) {
                bettorReason = `Mindset Alert: Low calmness (${calmness}/10). Risk appetite throttled.`;
            } else if (calmness >= 9) {
                bettorReason = `Elite Focus: High calmness (${calmness}/10). Objective clarity is peak.`;
            } else {
                bettorReason = `Stable mindset confirmed (${calmness}/10).`;
            }
        }
        pillars.push({
            pillar: "Psychological (Bettor)",
            score: bettorScore,
            reason: bettorReason
        });

        // 7. Physiological/Spiritual
        let spiritualScore = 8;
        let spiritualReason = "Bio-feedback neutral. Decision crispness high.";
        if (mood) {
            const negativeMoods = ["anxious", "tilted", "tired", "stressed", "frustrated", "angry", "annoyed"];
            const isNegative = negativeMoods.some(m => mood.toLowerCase().includes(m));
            if (isNegative) {
                spiritualScore = 4;
                spiritualReason = `VETO WARNING: Negative emotional state detected (${mood}). Decisions may be compromised.`;
            } else {
                spiritualScore = 9;
                spiritualReason = `Positive resonance: State of ${mood} supports high-clarity execution.`;
            }
        }
        pillars.push({
            pillar: "Physiological/Spiritual",
            score: spiritualScore,
            reason: spiritualReason
        });

        const totalScore = pillars.reduce((sum, p) => sum + p.score, 0);
        const overallConfidence = (totalScore / 70) * 100;

        // Finalize sizing
        let suggestedStake = 0;
        let recommendedSize = "Zero (0%)";
        if (valueTeam) {
            let calmnessModifier = 1.0;
            if (calmness !== undefined && calmness < 7) {
                calmnessModifier = 0.5;
            }
            const sizing = this.getMMAComplexitySizing(overallConfidence, bankroll);
            recommendedSize = calmness !== undefined && calmness < 7 ? "Throttled (Caution)" : sizing.label;
            suggestedStake = sizing.amount * calmnessModifier;
        }

        return {
            gamePk: Math.floor(Math.random() * 100000),
            homeTeam: f2.name,
            awayTeam: f1.name,
            overallConfidence: Math.round(overallConfidence),
            pillars,
            valueTeam,
            polyConditionId,
            polySharePrice,
            polyEV,
            polyOutcomeIndex: valueTeam ? (valueTeam === f2.name ? homeIdx : awayIdx) : undefined,
            homeOdds: homePrice === 0 ? undefined : homePrice,
            awayOdds: awayPrice === 0 ? undefined : awayPrice,
            recommendedAction,
            recommendedSize,
            suggestedStake,
            matchupNotes: `${techCombat.reason}`
        };
    }

    private scoreTechnicalCombat(f1: FighterStats, f2: FighterStats): any {
        // Strike Differential
        const f1Diff = f1.slpm - f1.sapm;
        const f2Diff = f2.slpm - f2.sapm;

        // Grappling Threat (Efficiency index)
        const f1Grapple = f1.tdAvg * f1.tdAcc;
        const f2Grapple = f2.tdAvg * f2.tdAcc;

        const diff = f1Diff - f2Diff;
        const grappleDiff = f1Grapple - f2Grapple;

        const favored = diff + (grappleDiff * 0.5) > 0 ? 'away' : 'home';
        const absDiff = Math.abs(diff + (grappleDiff * 0.5));

        let reason = `Strike volume differential favors ${favored === 'away' ? f1.name : f2.name} (+${absDiff.toFixed(2)} index).`;

        // 🔥 MISMATCH: Striker vs Grappler
        if (f1.slpm > 5.0 && f2.tdAvg < 1.0) {
            reason += ` 🔥 MISMATCH: Elite striker (${f1.name}) vs low-threat grappler.`;
        } else if (f2.slpm > 5.0 && f1.tdAvg < 1.0) {
            reason += ` 🔥 MISMATCH: Elite striker (${f2.name}) vs low-threat grappler.`;
        }

        if (f1.tdAvg > 3.0 && f2.tdDef < 50) {
            reason += ` 🔥 MISMATCH: Dominant grappler (${f1.name}) vs weak takedown defense.`;
        } else if (f2.tdAvg > 3.0 && f1.tdDef < 50) {
            reason += ` 🔥 MISMATCH: Dominant grappler (${f2.name}) vs weak takedown defense.`;
        }

        return {
            pillar: "Technical (Performance)",
            score: Math.min(5 + Math.floor(absDiff * 4), 10),
            reason,
            side: favored
        };
    }

    private scoreAltitudeFactor(f1: FighterStats, f2: FighterStats): PillarScore {
        // Mexico City altitude is a cardio killer. 
        // Penalize fighters with high SApM (Significant Strikes Absorbed) as they likely wear down faster.
        const f1CardioRisk = f1.sapm > 4.5 ? -1 : 0;
        const f2CardioRisk = f2.sapm > 4.5 ? -1 : 0;

        if (f1CardioRisk < f2CardioRisk) {
            return {
                pillar: "Seasonal (Environment)",
                score: 4,
                reason: `Altitude warning: ${f1.name} absorbs high volume (${f1.sapm}/min). High risk of gassing in Mexico City.`
            };
        }

        if (f2CardioRisk < f1CardioRisk) {
            return {
                pillar: "Seasonal (Environment)",
                score: 4,
                reason: `Altitude warning: ${f2.name} absorbs high volume (${f2.sapm}/min). High risk of gassing in Mexico City.`
            };
        }

        return {
            pillar: "Seasonal (Environment)",
            score: 7,
            reason: "Altitude baseline: Both fighters show disciplined cardio profiles."
        };
    }

    private getMMAComplexitySizing(confidence: number, bankroll: number): { label: string, amount: number } {
        if (confidence >= 80) return { label: "Aggressive (7.5%)", amount: bankroll * 0.075 };
        if (confidence >= 70) return { label: "Standard (4.0%)", amount: bankroll * 0.04 };
        return { label: "Zero (0%)", amount: 0 };
    }

    private getMMARecommendation(confidence: number, valueTeam?: string): string {
        if (confidence >= 80 && valueTeam) return `BODHI LOCK - Bet ${valueTeam.toUpperCase()}`;
        if (confidence >= 70 && valueTeam) return `Underdog Lean - ${valueTeam.toUpperCase()}`;
        return "PASS - High variance combat market.";
    }
}
