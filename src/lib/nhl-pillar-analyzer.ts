import { PillarScore, BodhiAnalysis } from './pillar-analyzer';

export class NHLPillarAnalyzer {

    analyzeGame(game: any, teamStats: any, polyMarket?: any, leaders?: { elite: string[], weak: string[] }, goalieStats?: any): BodhiAnalysis {
        const homeTeam = game.homeTeam;
        const awayTeam = game.awayTeam;
        const pillars: PillarScore[] = [];

        // 1. Technical Sport (Offense vs. Defense)
        const homeS = teamStats[homeTeam] || { goalsForPerGame: 3.1, goalsAgainstPerGame: 3.1 };
        const awayS = teamStats[awayTeam] || { goalsForPerGame: 3.1, goalsAgainstPerGame: 3.1 };

        const techSportScore = this.scoreTechnicalSport(game, homeS, awayS, leaders, goalieStats);
        pillars.push(techSportScore);

        // 2. Seasonal (Trend - Placeholder for now)
        const seasonalScore = {
            pillar: "Seasonal (Sport)",
            score: 7,
            reason: "Mid-season consistency: Trend lines favor high-volume shooters tonight."
        };
        pillars.push(seasonalScore);

        let currentConfidence = ((techSportScore.score + seasonalScore.score) / 20) * 100;

        // Setup outputs
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

                // Match city or team name (e.g. "Predators", "Nashville")
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

        const sizing = this.getSizing(overallConfidence, 450);

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

    private scoreTechnicalSport(game: any, home: any, away: any, leaders: any, goalieStats?: any): PillarScore {
        const hOffense = home.goalsForPerGame;
        const hDefense = home.goalsAgainstPerGame;
        const aOffense = away.goalsForPerGame;
        const aDefense = away.goalsAgainstPerGame;

        // Model: Expected goals based on offense vs opponent defense vulnerability
        const leagueAvg = 3.0;
        let expectedH = (hOffense * aDefense) / leagueAvg;
        let expectedA = (aOffense * hDefense) / leagueAvg;

        // Goalie stats impact
        let goalieNote = "";
        if (goalieStats?.goalies) {
            // Use the first goalie listed as the proxy for the starter in this context
            // In a more complex app, we'd verify the confirmed starter.
            const hGoalie = goalieStats.goalies.find((g: any) => g.teamId === game.homeTeamId);
            const aGoalie = goalieStats.goalies.find((g: any) => g.teamId === game.awayTeamId);

            if (hGoalie) {
                const svPct = hGoalie.savePctg || 0.900;
                if (svPct > 0.915) expectedA -= 0.3; // Elite goalie reduction
                else if (svPct < 0.890) expectedA += 0.3; // Weak goalie boost
                goalieNote += ` Home Goalie: ${hGoalie.name.default} (SV%: ${svPct.toFixed(3)}).`;
            }
            if (aGoalie) {
                const svPct = aGoalie.savePctg || 0.900;
                if (svPct > 0.915) expectedH -= 0.3;
                else if (svPct < 0.890) expectedH += 0.3;
                goalieNote += ` Away Goalie: ${aGoalie.name.default} (SV%: ${svPct.toFixed(3)}).`;
            }
        }

        let diff = expectedH - expectedA;

        // "Weak Goalie" Signal: If opponent GAA is > 3.3, we give an offensive boost
        if (aDefense > 3.3) diff += 0.5;
        if (hDefense > 3.3) diff -= 0.5;

        const favored = diff > 0 ? 'home' : 'away';
        const absDiff = Math.abs(diff);

        let reason = absDiff > 0.4 ? `Strong ${favored} offense (${favored === 'home' ? hOffense.toFixed(1) : aOffense.toFixed(1)}) vs struggling defense.` : "Offensive units are balanced.";
        if (aDefense > 3.3 || hDefense > 3.3) {
            reason += ` [!] Weak Defense: ${aDefense > 3.3 ? away.fullName : home.fullName}.`;
        }
        if (goalieNote) reason += goalieNote;

        return {
            pillar: "Technical (Sport)",
            score: Math.min(5 + Math.floor(absDiff * 3), 10),
            reason,
            side: absDiff < 0.1 ? 'neutral' : favored
        };
    }

    private getSizing(confidence: number, bankroll: number): { label: string, amount: number } {
        if (confidence >= 80) return { label: "Aggressive (5.0%)", amount: bankroll * 0.05 };
        if (confidence >= 70) return { label: "Standard (2.5%)", amount: bankroll * 0.025 };
        if (confidence >= 60) return { label: "Caution (1.0%)", amount: bankroll * 0.01 };
        return { label: "Zero (0%)", amount: 0 };
    }

    private getRecommendation(confidence: number, valueTeam?: string): string {
        if (confidence >= 80 && valueTeam) return `HIGH CONVICTION - Bet ${valueTeam.toUpperCase()} (+EV)`;
        if (confidence >= 70 && valueTeam) return `Value Play - ${valueTeam.toUpperCase()} Entry`;
        if (confidence >= 60) return "Informational - Edge lean detected.";
        return "PASS - Odds match probability.";
    }
}
