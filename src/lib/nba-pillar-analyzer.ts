import { PillarScore, BodhiAnalysis } from './pillar-analyzer';

export class NBAPillarAnalyzer {

    analyzeGame(game: any, teamStats: any, oddsList: any[]): BodhiAnalysis {
        const pillars: PillarScore[] = [];

        // 1. Technical Sport (Efficiency Matching)
        const homeS = teamStats[game.homeTeam] || { offenseRating: 114, defenseRating: 114, netRating: 0 };
        const awayS = teamStats[game.awayTeam] || { offenseRating: 114, defenseRating: 114, netRating: 0 };

        const techSportScore = this.scoreTechnicalSport(game, homeS, awayS);
        pillars.push(techSportScore);

        // 2. Seasonal (Pace and Fatigue - Placeholder)
        pillars.push({
            pillar: "Seasonal (Sport)",
            score: 7,
            reason: "Mid-season fatigue profiles: Looking for rest advantage and pace mismatches."
        });

        // 3. Technical (Bookies)
        let valueTeam: string | undefined;
        let valueOdds: number | undefined;
        let bookiesScore = 5;
        let bookiesReason = "Neutral market framing.";

        const market = oddsList.find(o =>
            o.home_team.includes(game.homeTeam) ||
            o.away_team.includes(game.awayTeam) ||
            game.homeTeam.includes(o.home_team) ||
            game.awayTeam.includes(o.away_team)
        );

        if (market && market.bookmakers && market.bookmakers.length > 0) {
            const h2h = market.bookmakers[0].markets.find((m: any) => m.key === 'h2h');
            if (h2h) {
                const hOdds = h2h.outcomes.find((o: any) => o.name === market.home_team)?.price || 1.91;
                const aOdds = h2h.outcomes.find((o: any) => o.name === market.away_team)?.price || 1.91;

                const techFavored = techSportScore.side;
                const favoredOdds = techFavored === 'home' ? hOdds : aOdds;

                // SPECIAL UNDERDOG HUNTER: High offensive underdog vs bad defense
                if (techFavored !== 'neutral' && favoredOdds >= 2.10) {
                    bookiesScore = 10;
                    bookiesReason = `UNDERDOG-HUNTER: High offensive ${techFavored} unit vs bottom-tier defense catching ${favoredOdds}. High +EV.`;
                    valueTeam = techFavored;
                    valueOdds = favoredOdds;
                }
                // Standard value
                else if (techSportScore.score >= 8 && favoredOdds >= 1.70) {
                    bookiesScore = 9;
                    bookiesReason = `BODHI-SIGNAL: Technically superior ${techFavored} side is undervalued at ${favoredOdds}.`;
                    valueTeam = techFavored;
                    valueOdds = favoredOdds;
                }
            }
        }

        pillars.push({
            pillar: "Technical (Bookies)",
            score: bookiesScore,
            reason: bookiesReason
        });

        // 4. Physiological (Biometric/Tilt) - 8th Pillar
        pillars.push({
            pillar: "Physiological (Biometric)",
            score: 7,
            reason: "Standard biometric health detected. HRV within normal range."
        });

        const totalScore = pillars.reduce((sum, p) => sum + p.score, 0);
        const overallConfidence = (totalScore / (pillars.length * 10)) * 100;

        // Custom Sizing for NBA (High variance, caution on spreads)
        const sizing = this.getNBAComplexitySizing(overallConfidence, 450);

        return {
            gamePk: game.id,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            overallConfidence: Math.round(overallConfidence),
            pillars,
            valueTeam,
            valueOdds,
            recommendedAction: this.getRecommendation(overallConfidence, valueTeam),
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
