import { PillarScore, BodhiAnalysis } from './pillar-analyzer';
import { FighterStats } from './mma-api';

export class MMAPillarAnalyzer {

    analyzeFight(fight: any, fighterStats: Record<string, FighterStats>, polyMarket?: any): BodhiAnalysis {
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

        let currentConfidence = ((techCombat.score + envScore.score) / 20) * 100;

        let recommendedAction = "PASS - No clear edge.";
        let valueTeam = undefined;
        let polyConditionId = undefined;
        let polySharePrice = undefined;
        let polyEV = undefined;

        let marketScore: PillarScore = {
            pillar: "Market Sentiment (Web3)",
            score: 5,
            reason: "No Polymarket match found. Neutral default.",
            side: "neutral"
        };

        // 3. Polymarket EV Calculation
        if (polyMarket && polyMarket.outcomes) {
            polyConditionId = polyMarket.conditionId;
            let f1Price = 0;
            let f2Price = 0;

            for (let i = 0; i < polyMarket.outcomes.length; i++) {
                const outcomeName = polyMarket.outcomes[i].toLowerCase();
                const price = parseFloat(polyMarket.outcomePrices[i]);

                const f1Parts = f1.name.toLowerCase().split(' ');
                const f2Parts = f2.name.toLowerCase().split(' ');

                if (f1Parts.some((p: string) => outcomeName.includes(p)) || outcomeName.includes(f1.name.toLowerCase())) {
                    f1Price = price;
                } else if (f2Parts.some((p: string) => outcomeName.includes(p)) || outcomeName.includes(f2.name.toLowerCase())) {
                    f2Price = price;
                }
            }

            const techFavored = techCombat.side; // 'away' or 'home'

            if (techFavored !== 'neutral') {
                const bodhiProb = currentConfidence / 100;
                let marketPrice = techFavored === 'away' ? f1Price : f2Price;
                valueTeam = techFavored === 'away' ? f1.name : f2.name;

                if (marketPrice > 0) {
                    polyEV = bodhiProb - marketPrice;
                    polySharePrice = marketPrice;

                    if (polyEV > 0.10) {
                        marketScore.score = 9;
                        marketScore.reason = `Massive Web3 Arb. Bodhi: ${(bodhiProb * 100).toFixed(1)}% vs Crowd: ${(marketPrice * 100).toFixed(1)}%. +${(polyEV * 100).toFixed(1)}% EV.`;
                        marketScore.side = techFavored;
                        recommendedAction = `HIGH CONVICTION - Buy ${valueTeam} Shares on Polymarket (+${(polyEV * 100).toFixed(1)}% EV).`;
                    } else if (polyEV > 0.03) {
                        marketScore.score = 7;
                        marketScore.reason = `Small Web3 edge (+${(polyEV * 100).toFixed(1)}% EV) on ${valueTeam}.`;
                        marketScore.side = techFavored;
                        recommendedAction = `LEAN - Small EV edge on ${valueTeam}. Buy shares.`;
                    } else if (polyEV < -0.10) {
                        marketScore.score = 2;
                        marketScore.reason = `Fading Crowd. Bodhi lean strongly opposed by Polymarket. Negative EV (${(polyEV * 100).toFixed(1)}%).`;
                        marketScore.side = techFavored === 'away' ? 'home' : 'away';
                        recommendedAction = `PASS - Negative EV (${(polyEV * 100).toFixed(1)}%). Crowd hates this bet.`;
                        valueTeam = undefined;
                    } else {
                        marketScore.score = 5;
                        marketScore.reason = "Bodhi probability accurately mirrors Polymarket share price. No edge.";
                        recommendedAction = "PASS - Efficient Market. No EV edge.";
                        valueTeam = undefined;
                    }
                }
            }
        }

        pillars.push(marketScore);

        const totalScore = pillars.reduce((sum, p) => sum + p.score, 0);
        const overallConfidence = (totalScore / 30) * 100; // 30 points max

        const sizing = this.getMMAComplexitySizing(overallConfidence);

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
            recommendedAction,
            recommendedSize: sizing.label,
            suggestedStake: sizing.amount
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

        return {
            pillar: "Technical (Performance)",
            score: Math.min(5 + Math.floor(absDiff * 4), 10),
            reason: `Strike volume differential favors ${favored === 'away' ? f1.name : f2.name} (+${absDiff.toFixed(2)} index).`,
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

    private getMMAComplexitySizing(confidence: number): { label: string, amount: number } {
        const bankroll = 450;
        if (confidence >= 80) return { label: "Standard (2.5%)", amount: bankroll * 0.025 };
        if (confidence >= 70) return { label: "Caution (1.0%)", amount: bankroll * 0.01 };
        return { label: "Zero (0%)", amount: 0 };
    }

    private getMMARecommendation(confidence: number, valueTeam?: string): string {
        if (confidence >= 80 && valueTeam) return `BODHI LOCK - Bet ${valueTeam.toUpperCase()}`;
        if (confidence >= 70 && valueTeam) return `Underdog Lean - ${valueTeam.toUpperCase()}`;
        return "PASS - High variance combat market.";
    }
}
