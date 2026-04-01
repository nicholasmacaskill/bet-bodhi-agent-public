import { PillarScore, BodhiAnalysis, getSizing } from './pillar-analyzer';
import { FighterStats } from './mma-api';

// Known high-altitude venues where cardio risk is statistically elevated
const HIGH_ALTITUDE_KEYWORDS = ['mexico city', 'denver', 'bogota', 'quito', 'la paz', 'salt lake city', 'albuquerque'];

export class MMAPillarAnalyzer {

    analyzeFight(
        fight: any,
        fighterStats: Record<string, FighterStats>,
        polyMarket?: any,
        bankroll: number = 464,
        mood?: string,
        calmness?: number,
        slumpMultiplier: number = 1.0,
        eventLocation?: string
    ): BodhiAnalysis {
        const pillars: PillarScore[] = [];
        const incompleteReasons: string[] = [];

        const f1 = fighterStats[fight.fighter1];
        const f2 = fighterStats[fight.fighter2];

        if (!f1) incompleteReasons.push(`Missing stats for ${fight.fighter1}`);
        if (!f2) incompleteReasons.push(`Missing stats for ${fight.fighter2}`);

        if (!f1 || !f2) {
            return {
                gamePk: 0,
                homeTeam: fight.fighter2,
                awayTeam: fight.fighter1,
                overallConfidence: 50,
                pillars: [],
                recommendedAction: "PASS - Missing fighter data.",
                recommendedSize: "Zero (0%)",
                suggestedStake: 0,
                dataIntegrity: 'incomplete',
                incompleteReasons
            };
        }

        // 1. Technical Combat (Performance Stats)
        const techCombat = this.scoreTechnicalCombat(f1, f2);
        pillars.push(techCombat);

        // 2. Seasonal/Environment — altitude penalty only when location confirms it
        const envScore = this.scoreEnvironment(f1, f2, eventLocation);
        pillars.push(envScore);

        // Objective probability: data-driven pillars only (no hardcoded psych filler)
        const bodhiProb = (techCombat.score + envScore.score) / 20;

        // 3. Technical (Bookies) — EV calculation
        let bookieScore: PillarScore = {
            pillar: "Technical (Bookies)",
            score: 5,
            reason: "No Polymarket match found. Neutral default.",
            side: "neutral"
        };

        let recommendedAction = "PASS - No clear edge.";
        let valueTeam: string | undefined = undefined;
        let polyConditionId: string | undefined = undefined;
        let polySharePrice: number | undefined = undefined;
        let polyEV: number | undefined = undefined;
        let homePrice = 0;
        let awayPrice = 0;
        let homeIdx = -1;
        let awayIdx = -1;

        if (polyMarket && polyMarket.outcomes) {
            polyConditionId = polyMarket.conditionId;

            for (let i = 0; i < polyMarket.outcomes.length; i++) {
                const outcomeName = polyMarket.outcomes[i].toLowerCase();
                const price = parseFloat(polyMarket.outcomePrices[i]);
                const f1Parts = f1.name.toLowerCase().split(' ');
                const f2Parts = f2.name.toLowerCase().split(' ');

                if (f1Parts.some((p: string) => outcomeName.includes(p)) || outcomeName.includes(f1.name.toLowerCase())) {
                    awayPrice = price; awayIdx = i;
                } else if (f2Parts.some((p: string) => outcomeName.includes(p)) || outcomeName.includes(f2.name.toLowerCase())) {
                    homePrice = price; homeIdx = i;
                }
            }

            const techFavored = techCombat.side;
            if (techFavored !== 'neutral') {
                // FIX: techFavored is 'away' (f1) or 'home' (f2), not a fighter name
                const marketPrice = techFavored === 'away' ? awayPrice : homePrice;
                valueTeam = techFavored === 'away' ? f1.name : f2.name;

                if (marketPrice > 0) {
                    polyEV = bodhiProb - marketPrice;
                    polySharePrice = marketPrice;

                    if (polyEV > 0.10) {
                        bookieScore = { score: 9, pillar: "Technical (Bookies)", reason: `Massive Web3 Arb. Bodhi: ${(bodhiProb * 100).toFixed(1)}% vs Crowd: ${(marketPrice * 100).toFixed(1)}%. +${(polyEV * 100).toFixed(1)}% EV.`, side: techFavored };
                        recommendedAction = `HIGH CONVICTION - Buy ${valueTeam} Shares on Polymarket (+${(polyEV * 100).toFixed(1)}% EV).`;
                    } else if (polyEV > 0.03) {
                        bookieScore = { score: 7, pillar: "Technical (Bookies)", reason: `Small Web3 edge (+${(polyEV * 100).toFixed(1)}% EV) on ${valueTeam}.`, side: techFavored };
                        recommendedAction = `LEAN - Small EV edge on ${valueTeam}. Buy shares.`;
                    } else if (polyEV < -0.10) {
                        bookieScore = { score: 2, pillar: "Technical (Bookies)", reason: `Fading Crowd. Negative EV (${(polyEV * 100).toFixed(1)}%).`, side: techFavored === 'away' ? 'home' : 'away' };
                        recommendedAction = `PASS - Negative EV (${(polyEV * 100).toFixed(1)}%).`;
                        valueTeam = undefined;
                    } else {
                        bookieScore = { score: 5, pillar: "Technical (Bookies)", reason: "Bodhi probability mirrors Polymarket share price. No edge.", side: 'neutral' };
                        recommendedAction = "PASS - Efficient Market. No EV edge.";
                        valueTeam = undefined;
                    }
                }
            }
        }
        pillars.push(bookieScore);

        // Objective confidence: 3 data-driven pillars only
        const objectiveConfidence = Math.round(
            ((techCombat.score + envScore.score + bookieScore.score) / 30) * 100
        );

        // ── Soft Pillars (display + sizing modifiers only, excluded from confidence) ──

        // 4. Technical (Bankroll)
        pillars.push({
            pillar: "Technical (Bankroll)",
            score: bankroll >= 400 ? 9 : 6,
            reason: bankroll >= 400 ? "Bankroll capacity supports MMA variance." : "Bankroll depth is caution-range."
        });

        // 5. Psychological (Players) — no championship-context data available
        pillars.push({
            pillar: "Psychological (Players)",
            score: 5,
            reason: "[ASSUMED] Neutral motivation baseline. No title/rivalry multiplier data available."
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
        pillars.push({ pillar: "Psychological (Bettor)", score: bettorScore, reason: bettorReason });

        // 7. Physiological/Spiritual — dynamic mood-based, display only
        let spiritualScore = 8;
        let spiritualReason = "Bio-feedback neutral. Decision crispness high.";
        if (mood) {
            const negativeMoods = ["anxious", "tilted", "tired", "stressed", "frustrated", "angry", "annoyed"];
            if (negativeMoods.some(m => mood.toLowerCase().includes(m))) {
                spiritualScore = 4;
                spiritualReason = `VETO WARNING: Negative emotional state detected (${mood}). Decisions may be compromised.`;
            } else {
                spiritualScore = 9;
                spiritualReason = `Positive resonance: State of ${mood} supports high-clarity execution.`;
            }
        }
        pillars.push({ pillar: "Physiological/Spiritual", score: spiritualScore, reason: spiritualReason });

        // ── Sizing (objectiveConfidence + soft modifiers) ──
        let recommendedSize = "Zero (0%)";
        let suggestedStake = 0;
        if (valueTeam) {
            const calmnessModifier = calmness !== undefined && calmness < 7 ? 0.5 : 1.0;
            const sizing = getSizing(objectiveConfidence, bankroll);
            if (slumpMultiplier < 1.0) {
                recommendedSize = "Throttled (Slump Detection)";
            } else if (calmness !== undefined && calmness < 7) {
                recommendedSize = "Throttled (Caution)";
            } else {
                recommendedSize = sizing.label;
            }
            suggestedStake = sizing.amount * calmnessModifier * slumpMultiplier;
        }

        return {
            gamePk: Math.floor(Math.random() * 100000),
            homeTeam: f2.name,
            awayTeam: f1.name,
            overallConfidence: objectiveConfidence,
            pillars,
            valueTeam,
            polyConditionId,
            polySharePrice,
            polyEV,
            polyOutcomeIndex: valueTeam ? (valueTeam === f2.name ? homeIdx : awayIdx) : undefined,
            homeOdds: homePrice || undefined,
            awayOdds: awayPrice || undefined,
            recommendedAction,
            recommendedSize,
            suggestedStake,
            matchupNotes: techCombat.reason,
            dataIntegrity: incompleteReasons.length > 0 ? 'incomplete' : 'complete',
            incompleteReasons: incompleteReasons.length > 0 ? incompleteReasons : undefined
        };
    }

    private scoreTechnicalCombat(f1: FighterStats, f2: FighterStats): PillarScore {
        const f1Diff = f1.slpm - f1.sapm;
        const f2Diff = f2.slpm - f2.sapm;
        const f1Grapple = f1.tdAvg * f1.tdAcc;
        const f2Grapple = f2.tdAvg * f2.tdAcc;

        const diff = f1Diff - f2Diff;
        const grappleDiff = f1Grapple - f2Grapple;
        const combined = diff + (grappleDiff * 0.5);
        const favored: 'away' | 'home' = combined > 0 ? 'away' : 'home';
        const absDiff = Math.abs(combined);

        let reason = `Strike volume differential favors ${favored === 'away' ? f1.name : f2.name} (+${absDiff.toFixed(2)} index).`;

        if (f1.slpm > 5.0 && f2.tdAvg < 1.0) {
            reason += ` MISMATCH: Elite striker (${f1.name}) vs low-threat grappler.`;
        } else if (f2.slpm > 5.0 && f1.tdAvg < 1.0) {
            reason += ` MISMATCH: Elite striker (${f2.name}) vs low-threat grappler.`;
        }

        if (f1.tdAvg > 3.0 && f2.tdDef < 50) {
            reason += ` MISMATCH: Dominant grappler (${f1.name}) vs weak takedown defense.`;
        } else if (f2.tdAvg > 3.0 && f1.tdDef < 50) {
            reason += ` MISMATCH: Dominant grappler (${f2.name}) vs weak takedown defense.`;
        }

        return {
            pillar: "Technical (Performance)",
            score: Math.min(5 + Math.floor(absDiff * 4), 10),
            reason,
            side: favored
        };
    }

    private scoreEnvironment(f1: FighterStats, f2: FighterStats, eventLocation?: string): PillarScore {
        const isHighAltitude = HIGH_ALTITUDE_KEYWORDS.some(city =>
            (eventLocation || '').toLowerCase().includes(city)
        );

        if (!isHighAltitude) {
            return {
                pillar: "Seasonal (Environment)",
                score: 5,
                reason: eventLocation
                    ? `Standard venue: ${eventLocation}. No altitude adjustment applied.`
                    : "[ASSUMED] No event location data. Neutral sea-level baseline."
            };
        }

        const f1CardioRisk = f1.sapm > 4.5 ? -1 : 0;
        const f2CardioRisk = f2.sapm > 4.5 ? -1 : 0;

        if (f1CardioRisk < f2CardioRisk) {
            return {
                pillar: "Seasonal (Environment)",
                score: 4,
                reason: `Altitude warning (${eventLocation}): ${f1.name} absorbs high volume (${f1.sapm}/min). Elevated gassing risk.`
            };
        }

        if (f2CardioRisk < f1CardioRisk) {
            return {
                pillar: "Seasonal (Environment)",
                score: 4,
                reason: `Altitude warning (${eventLocation}): ${f2.name} absorbs high volume (${f2.sapm}/min). Elevated gassing risk.`
            };
        }

        return {
            pillar: "Seasonal (Environment)",
            score: 7,
            reason: `High-altitude venue (${eventLocation}): Both fighters show disciplined cardio profiles.`
        };
    }
}
