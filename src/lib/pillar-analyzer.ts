/**
 * Pillar Analyzer v2.0
 * Scores MLB games for +EV by comparing Bodhi Strength Score to Market Odds.
 */

export interface PillarScore {
    pillar: string;
    score: number;
    reason: string;
    side?: 'home' | 'away' | 'neutral';
}

export interface BodhiAnalysis {
    gamePk: number;
    homeTeam: string;
    awayTeam: string;
    overallConfidence: number;
    pillars: PillarScore[];
    recommendedAction: string;
    recommendedSize: string; // e.g. "Standard (2.5%)"
    suggestedStake: number;  // Actual dollar amount
    valueTeam?: string;
    valueOdds?: number;
}

// Proprietary Elite lists redacted for public repo
const ELITE_PITCHERS: string[] = [];
const ELITE_BATS: string[] = [];

// Decision Weights (Examples - actual weights redacted)
const WEIGHT_ELITE_PITCHER = 1.0;
const WEIGHT_ELITE_BAT = 1.0;
const WEIGHT_HOT_BAT = 0.5;
const WEIGHT_WEAK_PITCHER = -1.0;

export class PillarAnalyzer {

    analyzeGame(game: any, details: any, oddsList: any[], hotBats: string[] = [], weakPitchers: string[] = []): BodhiAnalysis {
        const pillars: PillarScore[] = [];

        // 1. Technical Sport (Logic: Lineup & Pitcher Disparity)
        const techSport = this.scoreTechnicalSport(details, hotBats, weakPitchers);
        pillars.push(techSport);

        // 2. Seasonal Sport (Logic: Ramping and Environment)
        const seasonalSport = this.scoreSeasonalSport(game);
        pillars.push(seasonalSport);

        // Find relevant market odds with loose matching
        const homeTeam = game.homeTeam.trim();
        const awayTeam = game.awayTeam.trim();

        const market = oddsList.find(o =>
            (o.home_team.includes(homeTeam) || homeTeam.includes(o.home_team)) ||
            (this.normalizeTeam(o.home_team) === this.normalizeTeam(homeTeam))
        );

        if (game.homeTeam.includes("Giants")) {
            console.log(`DEBUG GIANTS: side=${techSport.side} market=${market ? 'Found' : 'Not Found'}`);
        }

        let valueTeam: string | undefined;
        let valueOdds: number | undefined;
        let bookiesScore = 5;
        let bookiesReason = "Neutral market framing.";

        if (market && market.bookmakers && market.bookmakers.length > 0) {
            const h2h = market.bookmakers[0].markets.find((m: any) => m.key === 'h2h');
            if (h2h) {
                const hOdds = h2h.outcomes.find((o: any) => o.name === market.home_team)?.price || 1.91;
                const aOdds = h2h.outcomes.find((o: any) => o.name === market.away_team)?.price || 1.91;

                const techFavored = techSport.side;
                const favoredOdds = techFavored === 'home' ? hOdds : aOdds;

                // 1. Favorite Advantage: The technically superior side is undervalued by the bookie
                if (techSport.score >= 8 && favoredOdds >= 1.70) {
                    bookiesScore = 10;
                    bookiesReason = `BODHI-SIGNAL: Technically superior ${techFavored} side is undervalued at ${favoredOdds}.`;
                    valueTeam = techFavored as string;
                    valueOdds = favoredOdds;
                }
                // 2. Underdog Hunter: The technically superior side is actually the underdog
                else if (techFavored !== 'neutral' && favoredOdds >= 2.02) {
                    bookiesScore = 10;
                    bookiesReason = `UNDERDOG-HUNTER: The superior ${techFavored} roster is catching ${favoredOdds}. High +EV.`;
                    valueTeam = techFavored as string;
                    valueOdds = favoredOdds;
                }
                // 3. Balanced dog discovery
                else if (techFavored === 'neutral' && Math.max(hOdds, aOdds) >= 2.10) {
                    bookiesScore = 8;
                    const dogSide = hOdds >= 2.10 ? 'home' : 'away';
                    bookiesReason = `DOG-LEAN: Balanced matchup. Value lean on ${dogSide} at ${Math.max(hOdds, aOdds)}.`;
                    valueTeam = dogSide;
                    valueOdds = Math.max(hOdds, aOdds);
                }
            }
        }

        pillars.push({
            pillar: "Technical (Bookies)",
            score: bookiesScore,
            reason: bookiesReason
        });

        // 4. Psychological (Players)
        pillars.push({
            pillar: "Psychological (Players)",
            score: 6,
            reason: "Early spring motivation is generally neutral unless roster battles are flagged."
        });

        const totalScore = pillars.reduce((sum, p) => sum + p.score, 0);
        const overallConfidence = (totalScore / (pillars.length * 10)) * 100;
        const sizing = this.getSizing(overallConfidence, 1000); // Default $1,000 bankroll

        return {
            gamePk: game.gamePk,
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

    private getSizing(confidence: number, bankroll: number): { label: string, amount: number } {
        if (confidence >= 80) return { label: "Aggressive (5.0%)", amount: bankroll * 0.05 };
        if (confidence >= 70) return { label: "Standard (2.5%)", amount: bankroll * 0.025 };
        if (confidence >= 60) return { label: "Caution (1.0%)", amount: bankroll * 0.01 };
        return { label: "Zero (0%)", amount: 0 };
    }

    private normalizeTeam(team: string): string {
        return team.replace("Los Angeles ", "").replace("Arizona ", "");
    }

    private scoreTechnicalSport(details: any, hotBats: string[] = [], weakPitchers: string[] = []): PillarScore {
        let homeElite = 0;
        let awayElite = 0;
        let homeHotCount = 0;
        let awayHotCount = 0;

        (details.lineups?.home || []).forEach((p: string) => {
            if (ELITE_BATS.includes(p)) homeElite++;
            if (hotBats.includes(p)) homeHotCount++;
        });

        (details.lineups?.away || []).forEach((p: string) => {
            if (ELITE_BATS.includes(p)) awayElite++;
            if (hotBats.includes(p)) awayHotCount++;
        });

        const homePitcher = details.probables.home || "";
        const awayPitcher = details.probables.away || "";

        const homePitcherElite = ELITE_PITCHERS.includes(homePitcher) ? WEIGHT_ELITE_PITCHER : 0;
        const awayPitcherElite = ELITE_PITCHERS.includes(awayPitcher) ? WEIGHT_ELITE_PITCHER : 0;

        const homePitcherWeak = weakPitchers.includes(homePitcher) ? WEIGHT_WEAK_PITCHER : 0;
        const awayPitcherWeak = weakPitchers.includes(awayPitcher) ? WEIGHT_WEAK_PITCHER : 0;

        const homeTotalStrength = (homeElite * WEIGHT_ELITE_BAT) + homePitcherElite + (homeHotCount * WEIGHT_HOT_BAT) + homePitcherWeak;
        const awayTotalStrength = (awayElite * WEIGHT_ELITE_BAT) + awayPitcherElite + (awayHotCount * WEIGHT_HOT_BAT) + awayPitcherWeak;

        const disparity = Math.abs(homeTotalStrength - awayTotalStrength);
        const favored = homeTotalStrength > awayTotalStrength ? "Home" : "Away";

        let reason = disparity > 0 ? `Strong ${favored} advantage (+${disparity.toFixed(1)} strength).` : "Lineups are competitively balanced.";
        if (homeHotCount > 0 || awayHotCount > 0) {
            reason += ` Hot Bats detected: Home(${homeHotCount}) Away(${awayHotCount}).`;
        }
        if (homePitcherWeak || awayPitcherWeak) {
            reason += ` Weak Pitcher warning: ${homePitcherWeak ? 'Home' : 'Away'}.`;
        }

        return {
            pillar: "Technical (Sport)",
            score: Math.min(5 + Math.floor(disparity), 10),
            reason,
            side: disparity === 0 ? 'neutral' : (homeTotalStrength > awayTotalStrength ? 'home' : 'away')
        };
    }

    private scoreSeasonalSport(game: any): PillarScore {
        const isArizona = game.venue.includes("Stadium") || game.venue.includes("Field") || game.venue.includes("Complex");
        return {
            pillar: "Seasonal (Sport)",
            score: 7,
            reason: isArizona ? "Cactus League: Dry air offensive boost. Watch totals." : "Grapefruit League: Neutral environment."
        };
    }

    private getRecommendation(confidence: number, valueTeam?: string): string {
        if (confidence >= 78 && valueTeam) return `HIGH CONVICTION - Bet ${valueTeam.toUpperCase()} (+EV)`;
        if (confidence >= 70 && valueTeam) return `Value Play - ${valueTeam.toUpperCase()} Entry`;
        if (confidence >= 60) return "Informational - Edge lean detected.";
        return "PASS - Odds match probability.";
    }
}
