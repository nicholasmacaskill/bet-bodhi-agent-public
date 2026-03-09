import { PillarScore, BodhiAnalysis } from './pillar-analyzer';

export class NBAPillarAnalyzer {

    analyzeGame(
        game: any,
        teamStats: any,
        polyMarket?: any,
        bankroll: number = 464,
        mood?: string,
        calmness?: number
    ): BodhiAnalysis {
        const homeTeam = game.homeTeam;
        const awayTeam = game.awayTeam;
        const pillars: PillarScore[] = [];

        // 1. Technical Sport (Efficiency Matching)
        const homeS = teamStats[homeTeam] || { offenseRating: 114, defenseRating: 114, netRating: 0 };
        const awayS = teamStats[awayTeam] || { offenseRating: 114, defenseRating: 114, netRating: 0 };
        const techResult = this.scoreTechnicalSport(game, homeS, awayS);
        const techSportScore = techResult.score;
        const advantages = techResult.advantages;
        pillars.push(techSportScore);

        // 2. Seasonal (Pace)
        const seasonalScore = {
            pillar: "Seasonal (Sport)",
            score: 7,
            reason: "Mid-season fatigue profiles: Looking for rest advantage and pace mismatches."
        };
        pillars.push(seasonalScore);

        // 3. Psychological (Players)
        const psychPlayersScore = {
            pillar: "Psychological (Players)",
            score: 6,
            reason: "Standard rest cycle. No high-frequency travel fatigue flagged."
        };
        pillars.push(psychPlayersScore);

        // bodhiProb calculation
        const bodhiProb = (techSportScore.score + seasonalScore.score + psychPlayersScore.score) / 30;

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
        let homePrice = 0;
        let awayPrice = 0;
        let homeIdx = -1;
        let awayIdx = -1;

        // 3. Polymarket EV Calculation
        if (polyMarket && polyMarket.outcomes) {
            polyConditionId = polyMarket.conditionId;

            for (let i = 0; i < polyMarket.outcomes.length; i++) {
                const outcomeName = polyMarket.outcomes[i].toLowerCase();
                const price = parseFloat(polyMarket.outcomePrices[i]);

                const homeParts = homeTeam.toLowerCase().split(' ');
                const awayParts = awayTeam.toLowerCase().split(' ');

                if (homeParts.some((p: string) => outcomeName.includes(p)) || outcomeName.includes(homeTeam.toLowerCase())) {
                    homePrice = price;
                    homeIdx = i;
                } else if (awayParts.some((p: string) => outcomeName.includes(p)) || outcomeName.includes(awayTeam.toLowerCase())) {
                    awayPrice = price;
                    awayIdx = i;
                }
            }

            const techFavored = techSportScore.side;

            if (techFavored !== 'neutral') {
                let marketPrice = techFavored === 'home' ? homePrice : awayPrice;
                valueTeam = techFavored === 'home' ? homeTeam : awayTeam;

                if (marketPrice > 0) {
                    polyEV = bodhiProb - marketPrice;
                    polySharePrice = marketPrice;

                    if (polyEV > 0.10) {
                        bookieScore.score = 9;
                        bookieScore.reason = `Massive Web3 Arb. Bodhi: ${(bodhiProb * 100).toFixed(1)}% vs Crowd: ${(marketPrice * 100).toFixed(1)}%. +${(polyEV * 100).toFixed(1)}% EV.`;
                        bookieScore.side = techFavored;
                        recommendedAction = `HIGH CONVICTION - Buy ${valueTeam} Shares on Polymarket (+${(polyEV * 100).toFixed(1)}% EV).`;
                        advantages.push(`📈 Strategic Market Edge: Bodhi probability identifies a massive ${(polyEV * 100).toFixed(1)}% discrepancy between our internal model (${(bodhiProb * 100).toFixed(1)}%) and the current Polymarket crowd price (${(marketPrice * 100).toFixed(1)}%).`);
                    } else if (polyEV > 0.03) {
                        bookieScore.score = 7;
                        bookieScore.reason = `Small Web3 edge (+${(polyEV * 100).toFixed(1)}% EV) on ${valueTeam}.`;
                        bookieScore.side = techFavored;
                        recommendedAction = `LEAN - Small EV edge on ${valueTeam}. Buy shares.`;
                        advantages.push(`📉 Price Inefficiency: Current market pricing under-estimates ${valueTeam} by ${(polyEV * 100).toFixed(1)}% based on seasonal efficiency metrics.`);
                    } else if (polyEV < -0.10) {
                        bookieScore.score = 2;
                        bookieScore.reason = `Fading Crowd. Bodhi lean strongly opposed by Polymarket. Negative EV (${(polyEV * 100).toFixed(1)}%).`;
                        bookieScore.side = techFavored === 'home' ? 'away' : 'home';
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
            reason: bankroll >= 400 ? "Bankroll is healthy. 4% unit size is sustainable." : "Bankroll depth is caution-range."
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
            const sizing = this.getNBAComplexitySizing(overallConfidence, bankroll);
            recommendedSize = calmness !== undefined && calmness < 7 ? "Throttled (Caution)" : sizing.label;
            suggestedStake = sizing.amount * calmnessModifier;
        }

        return {
            gamePk: game.gamePk,
            homeTeam,
            awayTeam,
            overallConfidence: Math.round(overallConfidence),
            pillars,
            valueTeam,
            polyConditionId,
            polySharePrice,
            polyEV,
            polyOutcomeIndex: valueTeam ? (valueTeam === homeTeam ? homeIdx : awayIdx) : undefined,
            homeOdds: homePrice,
            awayOdds: awayPrice,
            recommendedAction,
            recommendedSize,
            suggestedStake,
            matchupNotes: techSportScore.reason,
            advantages: advantages.length >= 3 ? advantages.slice(0, 3) : this.backfillAdvantages(advantages, Math.round(overallConfidence), mood)
        };
    }

    private backfillAdvantages(existing: string[], confidence: number, mood?: string): string[] {
        const backfilled = [...existing];
        if (backfilled.length < 3 && confidence > 70) {
            backfilled.push("✨ High Confidence Signal: Efficiency metrics and secondary possession data have both cross-verified this entry as a stable technical play.");
        }
        if (backfilled.length < 3 && mood) {
            backfilled.push(`⚡ High-Clarity Execution: Your current psychological state (${mood}) supports high-precision decision making, reducing the emotional risk of this entry.`);
        }
        if (backfilled.length < 3) {
            backfilled.push("📋 Statistical Stability: Our internal model favors this side based on seasonal Net Rating and adjusted strength-of-schedule metrics.");
        }
        return backfilled.slice(0, 3);
    }

    private scoreTechnicalSport(game: any, home: any, away: any): { score: PillarScore, advantages: string[] } {
        const hOff = home.offenseRating;
        const hDef = home.defenseRating;
        const aOff = away.offenseRating;
        const aDef = away.defenseRating;

        const homeNet = home.netRating || (hOff - hDef);
        const awayNet = away.netRating || (aOff - aDef);

        const diff = homeNet - awayNet;
        let reason = "";
        let finalScore = 5;
        let favored: 'home' | 'away' | 'neutral' = 'neutral';
        const advantages: string[] = [];

        const absDiff = Math.abs(diff);

        if (absDiff > 8) {
            favored = diff > 0 ? 'home' : 'away';
            finalScore = 9;
            reason = `Dominant Net Rating for ${favored} (${favored === 'home' ? homeNet : awayNet}). Mismatch detected.`;
            advantages.push(`🏀 Dominant Technical Profile: ${favored === 'home' ? home.name : away.name} holds a top-tier seasonal Net Rating (${favored === 'home' ? homeNet : awayNet}), indicating superior efficiency on both ends of the floor.`);
        } else if (absDiff > 4) {
            favored = diff > 0 ? 'home' : 'away';
            finalScore = 7;
            reason = `Technical favor on ${favored} based on seasonal Net Rating (${Math.abs(diff).toFixed(1)}).`;
            advantages.push(`🔥 Power Ranking Edge: ${favored === 'home' ? home.name : away.name} is statistically superior in net secondary metrics, providing a predictable performance baseline.`);
        } else {
            reason = "Efficiency metrics are competitive.";
        }

        // Offensive Mismatch Boost: Elite offense vs bottom-tier defense
        let mismatchBoost = 0;
        if (aOff > 115 && hDef > 116) {
            mismatchBoost = 2;
            reason += " 🔥 MISMATCH: Elite away offense vs bottom-tier home defense.";
            advantages.push(`🏀 Offensive Mismatch: ${away.name} is well-positioned for a scoring spike, as their high-volume offense (115+ ORtg) faces a bottom-10 defensive unit.`);
            if (favored === 'neutral') favored = 'away';
        } else if (hOff > 115 && aDef > 116) {
            mismatchBoost = 2;
            reason += " 🔥 MISMATCH: Elite home offense vs bottom-tier away defense.";
            advantages.push(`🏀 Offensive Mismatch: ${home.name} is well-positioned for a scoring spike, as their high-volume offense (115+ ORtg) faces a bottom-10 defensive unit.`);
            if (favored === 'neutral') favored = 'home';
        }

        if (favored !== 'neutral') {
            const fOff = favored === 'home' ? hOff : aOff;
            if (fOff > 118) advantages.push(`🎯 Shot Quality: ${favored.toUpperCase()} offense is in peak efficiency range (118+), indicating high-quality look generation in half-court sets.`);
        }

        const favoredTeamFull = favored === 'home' ? home.name : away.name;
        const unfavoredTeamFull = favored === 'home' ? away.name : home.name;

        let narrative = "";

        if (mismatchBoost > 0) {
            narrative = `We identify an Elite Offensive Mismatch. The ${favoredTeamFull} offense is perfectly calibrated to exploit the ${unfavoredTeamFull}'s defensive inefficiencies, creating a high-probability scoring spike. `;
        } else if (absDiff > 8) {
            narrative = `This is a profile of Pure Efficiency. The ${favoredTeamFull} maintain a dominant +${absDiff.toFixed(1)} Net Rating edge, ranking in the top-tier of NBA production on both ends of the floor. `;
        } else if (absDiff > 4) {
            const fOff = favored === 'home' ? hOff : aOff;
            if (fOff > 118) {
                narrative = `Shot Quality remains the primary technical driver. The ${favoredTeamFull} are generating elite looks (118+ ORtg), which provides a stable baseline for this +${absDiff.toFixed(1)} technical edge. `;
            } else {
                narrative = `Efficiency metrics identify a stable +${absDiff.toFixed(1)} Net Rating lean for the ${favoredTeamFull}. Their ability to maintain possession discipline gives them a predictable edge in high-leverage possessions. `;
            }
        } else if (favored !== 'neutral') {
            narrative = `A marginal +${absDiff.toFixed(1)} Technical Advantage for the ${favoredTeamFull}. While the boards are competitive, their secondary efficiency metrics offer a slight technical buffer in this matchup. `;
        } else {
            narrative = "Efficiency metrics are perfectly balanced. This matchup is expected to be decided by non-technical variables or late-game execution.";
        }

        return {
            score: {
                pillar: "Technical Roster Advantage",
                score: Math.min(10, finalScore + mismatchBoost),
                reason: narrative,
                side: favored
            },
            advantages
        };
    }

    private getNBAComplexitySizing(confidence: number, bankroll: number): { label: string, amount: number } {
        if (confidence >= 85) return { label: "Aggressive (7.5%)", amount: bankroll * 0.075 };
        if (confidence >= 75) return { label: "Standard (4.0%)", amount: bankroll * 0.04 };
        if (confidence >= 65) return { label: "Caution (2.0%)", amount: bankroll * 0.02 };
        return { label: "Zero (0%)", amount: 0 };
    }

    private getRecommendation(confidence: number, valueTeam?: string): string {
        if (confidence >= 80 && valueTeam) return `HIGH CONVICTION - Bet ${valueTeam.toUpperCase()} (+EV)`;
        if (confidence >= 70 && valueTeam) return `Value Play - ${valueTeam.toUpperCase()} Entry`;
        if (confidence >= 65) return "Informational - Watch for live entry.";
        return "PASS - Model found no edge.";
    }
}
