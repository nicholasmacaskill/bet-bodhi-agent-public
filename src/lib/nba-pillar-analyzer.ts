import { PillarScore, BodhiAnalysis } from './pillar-analyzer';

export class NBAPillarAnalyzer {

    analyzeGame(game: any, teamStats: any, polyMarket?: any): BodhiAnalysis {
        const homeTeam = game.homeTeam;
        const awayTeam = game.awayTeam;
        const pillars: PillarScore[] = [];

        // 1. Technical Sport (Efficiency Matching)
        const homeS = teamStats[homeTeam] || { offenseRating: 114, defenseRating: 114, netRating: 0 };
        const awayS = teamStats[awayTeam] || { offenseRating: 114, defenseRating: 114, netRating: 0 };

        const techSportScore = this.scoreTechnicalSport(game, homeS, awayS);
        pillars.push(techSportScore);

        // 2. Seasonal (Pace and Fatigue - Placeholder)
        const seasonalScore = {
            pillar: "Seasonal (Sport)",
            score: 7,
            reason: "Mid-season fatigue profiles: Looking for rest advantage and pace mismatches."
        };
        pillars.push(seasonalScore);

        let currentConfidence = ((techSportScore.score + seasonalScore.score) / 20) * 100;

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
            let homePrice = 0;
            let awayPrice = 0;

            for (let i = 0; i < polyMarket.outcomes.length; i++) {
                const outcomeName = polyMarket.outcomes[i].toLowerCase();
                const price = parseFloat(polyMarket.outcomePrices[i]);

                const homeParts = homeTeam.toLowerCase().split(' ');
                const awayParts = awayTeam.toLowerCase().split(' ');

                if (homeParts.some((p: string) => outcomeName.includes(p)) || outcomeName.includes(homeTeam.toLowerCase())) {
                    homePrice = price;
                } else if (awayParts.some((p: string) => outcomeName.includes(p)) || outcomeName.includes(awayTeam.toLowerCase())) {
                    awayPrice = price;
                }
            }

            const techFavored = techSportScore.side;

            if (techFavored !== 'neutral') {
                const bodhiProb = currentConfidence / 100;
                let marketPrice = techFavored === 'home' ? homePrice : awayPrice;
                valueTeam = techFavored === 'home' ? homeTeam : awayTeam;

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
                        marketScore.side = techFavored === 'home' ? 'away' : 'home';
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

        const sizing = this.getNBAComplexitySizing(overallConfidence, 450);

        return {
            gamePk: game.id,
            homeTeam,
            awayTeam,
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

    private scoreTechnicalSport(game: any, home: any, away: any): PillarScore {
        const hOff = home.offenseRating;
        const hDef = home.defenseRating;
        const aOff = away.offenseRating;
        const aDef = away.defenseRating;

        // Advantage calculation: Offensive Rating minus Opponent Defensive Rating
        // We want a high offensive rating vs a high defensive rating (bad defense).
        // For NBA: Offense - Defense = expected points per 100 possessions relative to average
        // But for a simple score, we look at Net Rating first, then the offensive mismatch.

        const homeNet = home.netRating || (hOff - hDef);
        const awayNet = away.netRating || (aOff - aDef);

        // Offensive Mismatch Boost: Is away offense vs home defense better than vice versa?
        const awayEdge = (aOff - hDef); // A more positive number means away offense destroys home defense
        const homeEdge = (hOff - aDef);

        const diff = homeNet - awayNet;
        let reason = "";
        let finalScore = 5;
        let favored: 'home' | 'away' | 'neutral' = 'neutral';

        const absDiff = Math.abs(diff);

        if (absDiff > 8) {
            favored = diff > 0 ? 'home' : 'away';
            finalScore = 9;
            reason = `Dominant Net Rating for ${favored} (${favored === 'home' ? homeNet : awayNet}). Mismatch detected.`;
        } else if (absDiff > 4) {
            favored = diff > 0 ? 'home' : 'away';
            finalScore = 7;
            reason = `Technical favor on ${favored} based on seasonal Net Rating (${Math.abs(diff).toFixed(1)}).`;
        } else {
            reason = "Efficiency metrics are competitive.";
        }

        // Underdog Hunter Check: If favored is neutral but one team has an ELITE offense vs bad defense
        if (aOff > 115 && hDef > 116) {
            finalScore = Math.max(finalScore, 8);
            reason += " [!] OFFENSIVE BURST: Elite away offense vs bottom-tier home defense.";
            if (favored === 'neutral') favored = 'away';
        }

        return {
            pillar: "Technical (Sport)",
            score: finalScore,
            reason,
            side: favored
        };
    }

    private getNBAComplexitySizing(confidence: number, bankroll: number): { label: string, amount: number } {
        if (confidence >= 85) return { label: "Aggressive (5.0%)", amount: bankroll * 0.05 };
        if (confidence >= 75) return { label: "Standard (2.5%)", amount: bankroll * 0.025 };
        if (confidence >= 65) return { label: "Caution (1.0%)", amount: bankroll * 0.01 };
        return { label: "Zero (0%)", amount: 0 };
    }

    private getRecommendation(confidence: number, valueTeam?: string): string {
        if (confidence >= 80 && valueTeam) return `HIGH CONVICTION - Bet ${valueTeam.toUpperCase()} (+EV)`;
        if (confidence >= 70 && valueTeam) return `Value Play - ${valueTeam.toUpperCase()} Entry`;
        if (confidence >= 65) return "Informational - Watch for live entry.";
        return "PASS - Model found no edge.";
    }
}
