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
    runLineOdds?: number;
    runLinePoint?: number;
    polyConditionId?: string;
    polySharePrice?: number;
    polyEV?: number;
    homePitcher?: string;
    awayPitcher?: string;
    homeOdds?: number;
    awayOdds?: number;
}

// Map of 2026 Elite MLB Pitchers
const ELITE_PITCHERS = [
    "Gerrit Cole", "Zack Wheeler", "Corbin Burnes", "Logan Webb", "Tyler Glasnow",
    "Luis Castillo", "Kevin Gausman", "Spencer Strider", "Yoshinobu Yamamoto",
    "Framber Valdez", "Justin Steele", "Pablo Lopez", "Aaron Nola", "Tarik Skubal", "Paul Skenes",
    "Shota Imanaga", "Michael Soroka", "Andrew Painter", "Andrew Abbott", "Logan Gilbert", "Drew Rasmussen", "Reid Detmers"
];

// Map of 2026 Elite MLB Bats
const ELITE_BATS = [
    "Shohei Ohtani", "Aaron Judge", "Ronald Acuna Jr.", "Mookie Betts", "Freddie Freeman",
    "Juan Soto", "Corey Seager", "Yordan Alvarez", "Matt Olson", "Kyle Tucker",
    "Mike Trout", "Bobby Witt Jr.", "Julio Rodriguez", "Bryce Harper", "Adley Rutschman",
    "Jung Hoo Lee", "Jorge Soler", "LaMonte Wade Jr.", "Eloy Jimenez", "Connor Griffin",
    "Jackson Chourio", "Logan O'Hoppe", "James Wood", "Dylan Crews", "CJ Abrams"
];

// Decision Weights - Pitching is paramount
const WEIGHT_ELITE_PITCHER = 15;
const WEIGHT_ELITE_BAT = 1;
const WEIGHT_HOT_BAT = 0.5;
const WEIGHT_WEAK_PITCHER = -15;

export class PillarAnalyzer {

    analyzeGame(
        game: any,
        details: any,
        polyMarket?: any, // Replaces traditional odds array with single condition
        hotBats: string[] = [],
        weakPitchers: string[] = [],
        playerStats?: Map<string, any>
    ): BodhiAnalysis {
        const homeTeam = game.homeTeam;
        const awayTeam = game.awayTeam;

        const pillars: PillarScore[] = [];

        // 1. Technical Analysis (Sport-Specific)
        const techSport = this.scoreTechnicalSport(details, hotBats, weakPitchers, playerStats);
        pillars.push(techSport);

        // 2. Seasonal Sport (Logic: Ramping and Environment)
        const seasonalSport = this.scoreSeasonalSport(game);
        pillars.push(seasonalSport);

        // Calculate initial confidence for sizing purposes and Bodhi True Probability
        let currentConfidence = ((techSport.score + seasonalSport.score) / 20) * 100;

        // Veto logic preparation
        const homePitcher = details.homePitcher?.fullName;
        const awayPitcher = details.awayPitcher?.fullName;
        const isHomeElite = homePitcher && (ELITE_PITCHERS.includes(homePitcher) || hotBats.includes(homePitcher));
        const isAwayElite = awayPitcher && (ELITE_PITCHERS.includes(awayPitcher) || hotBats.includes(awayPitcher));

        // Identify weak pitchers (for veto)
        const isHomeWeak = homePitcher && (weakPitchers.includes(homePitcher) || (playerStats?.get(homePitcher)?.xera >= 5.00));
        const isAwayWeak = awayPitcher && (weakPitchers.includes(awayPitcher) || (playerStats?.get(awayPitcher)?.xera >= 5.00));

        // Setup outputs
        let recommendedAction = "PASS - No clear edge.";
        let valueTeam = undefined;
        let recommendedSize = this.getSizing(currentConfidence, 1000).label;
        let suggestedStake = this.getSizing(currentConfidence, 1000).amount;
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
        let homePrice = 0;
        let awayPrice = 0;

        if (polyMarket && polyMarket.outcomes) {
            polyConditionId = polyMarket.conditionId;

            for (let i = 0; i < polyMarket.outcomes.length; i++) {
                const outcomeName = polyMarket.outcomes[i].toLowerCase();
                const price = parseFloat(polyMarket.outcomePrices[i]);

                if (homeTeam.toLowerCase().includes(outcomeName) || outcomeName.includes(homeTeam.toLowerCase().split(' ').pop())) {
                    homePrice = price;
                } else if (awayTeam.toLowerCase().includes(outcomeName) || outcomeName.includes(awayTeam.toLowerCase().split(' ').pop())) {
                    awayPrice = price;
                }
            }

            const techFavored = techSport.side;

            if (techFavored !== 'neutral') {
                const bodhiProb = currentConfidence / 100;
                let marketPrice = techFavored === 'home' ? homePrice : awayPrice;
                valueTeam = techFavored === 'home' ? homeTeam : awayTeam;

                // Check Veto Rules first before assigning value
                let isVetoed = false;
                let vetoReason = "";

                if (valueTeam === homeTeam && isAwayElite) {
                    isVetoed = true; vetoReason = `VETO: +EV on Home, but Away has elite pitcher (${awayPitcher}).`;
                } else if (valueTeam === awayTeam && isHomeElite) {
                    isVetoed = true; vetoReason = `VETO: +EV on Away, but Home has elite pitcher (${homePitcher}).`;
                } else if (valueTeam === homeTeam && isHomeWeak) {
                    isVetoed = true; vetoReason = `VETO: +EV on Home, but Home pitcher (${homePitcher}) is weak.`;
                } else if (valueTeam === awayTeam && isAwayWeak) {
                    isVetoed = true; vetoReason = `VETO: +EV on Away, but Away pitcher (${awayPitcher}) is weak.`;
                }

                if (isVetoed) {
                    marketScore.score = 2;
                    marketScore.reason = vetoReason;
                    recommendedAction = vetoReason;
                    valueTeam = undefined;
                } else if (marketPrice > 0) {
                    // +EV Calculation
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
        } else {
            // No Web3 market found. Fallback to Bodhi Native Preseason Model.
            const techFavored = techSport.side;
            if (techFavored !== 'neutral' && currentConfidence >= 55) {
                valueTeam = techFavored === 'home' ? homeTeam : awayTeam;

                // Veto Checks
                let isVetoed = false;
                let vetoReason = "";

                if (valueTeam === homeTeam && isAwayElite) {
                    isVetoed = true; vetoReason = `VETO: +EV on Home, but Away has elite pitcher (${awayPitcher}).`;
                } else if (valueTeam === awayTeam && isHomeElite) {
                    isVetoed = true; vetoReason = `VETO: +EV on Away, but Home has elite pitcher (${homePitcher}).`;
                } else if (valueTeam === homeTeam && isHomeWeak) {
                    isVetoed = true; vetoReason = `VETO: +EV on Home, but Home pitcher (${homePitcher}) is weak.`;
                } else if (valueTeam === awayTeam && isAwayWeak) {
                    isVetoed = true; vetoReason = `VETO: +EV on Away, but Away pitcher (${awayPitcher}) is weak.`;
                }

                if (isVetoed) {
                    marketScore.score = 2;
                    marketScore.reason = vetoReason;
                    recommendedAction = vetoReason;
                    valueTeam = undefined;
                } else {
                    polyEV = (currentConfidence / 100) - 0.50; // Mock 50/50 line
                    polySharePrice = 0.50;                     // Mock 50/50 line
                    marketScore.score = 7;
                    marketScore.reason = `PRESEASON MODE: No Web3 Market. Bodhi True Prob hits ${(currentConfidence).toFixed(1)}%.`;
                    marketScore.side = techFavored;
                    recommendedAction = `PRESEASON CONVICTION - Bet ${valueTeam} (Implied Edge: +${(polyEV * 100).toFixed(1)}%).`;
                }
            }
        }

        pillars.push(marketScore);

        // 4. Psychological (Players)
        pillars.push({
            pillar: "Psychological (Players)",
            score: 6,
            reason: "Early spring motivation is generally neutral unless roster battles are flagged."
        });

        // Recalculate Final Confidence
        const totalScore = pillars.reduce((sum, p) => sum + p.score, 0);
        currentConfidence = (totalScore / 40) * 100; // 40 points total

        // Finalize sizing
        if (valueTeam) {
            const sizing = this.getSizing(currentConfidence, 1000); // Baseline $1k
            recommendedSize = sizing.label;
            suggestedStake = sizing.amount;
        }

        return {
            gamePk: game.gamePk,
            homeTeam,
            awayTeam,
            overallConfidence: Math.round(currentConfidence),
            pillars,
            valueTeam,
            polyConditionId,
            polySharePrice,
            polyEV,
            recommendedAction,
            recommendedSize,
            suggestedStake,
            homePitcher,
            awayPitcher,
            homeOdds: polyMarket ? homePrice : undefined,
            awayOdds: polyMarket ? awayPrice : undefined
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

    private scoreTechnicalSport(details: any, hotBats: string[] = [], weakPitchers: string[] = [], playerStats?: Map<string, any>): PillarScore {
        let homeElite = 0;
        let awayElite = 0;
        let homeHotCount = 0;
        let awayHotCount = 0;

        let homeMetricBonus = 0;
        let awayMetricBonus = 0;

        (details.lineups?.home || []).forEach((p: string) => {
            if (ELITE_BATS.includes(p)) homeElite++;
            if (hotBats.includes(p)) homeHotCount++;

            // v3.0 Metrics Sniper: Check for elite xWOBA (>= .380)
            if (playerStats && playerStats.has(p) && playerStats.get(p).xwoba >= 0.380) {
                homeMetricBonus += 0.5;
            }
        });

        (details.lineups?.away || []).forEach((p: string) => {
            if (ELITE_BATS.includes(p)) awayElite++;
            if (hotBats.includes(p)) awayHotCount++;

            // v3.0 Metrics Sniper: Check for elite xWOBA (>= .380)
            if (playerStats && playerStats.has(p) && playerStats.get(p).xwoba >= 0.380) {
                awayMetricBonus += 0.5;
            }
        });

        const homePitcher = details.probables.home || "";
        const awayPitcher = details.probables.away || "";

        let homePitcherElite = ELITE_PITCHERS.includes(homePitcher) ? WEIGHT_ELITE_PITCHER : 0;
        let awayPitcherElite = ELITE_PITCHERS.includes(awayPitcher) ? WEIGHT_ELITE_PITCHER : 0;

        let homePitcherWeak = weakPitchers.includes(homePitcher) ? WEIGHT_WEAK_PITCHER : 0;
        let awayPitcherWeak = weakPitchers.includes(awayPitcher) ? WEIGHT_WEAK_PITCHER : 0;

        // v3.0 Metrics Sniper: Expected ERA overriding legacy lists
        if (playerStats) {
            if (playerStats.has(homePitcher)) {
                const xERA = playerStats.get(homePitcher).xera;
                if (xERA <= 2.80) homePitcherElite = WEIGHT_ELITE_PITCHER; // Positive Regression Lock
                if (xERA >= 5.00) homePitcherWeak = WEIGHT_WEAK_PITCHER;
            }
            if (playerStats.has(awayPitcher)) {
                const xERA = playerStats.get(awayPitcher).xera;
                if (xERA <= 2.80) awayPitcherElite = WEIGHT_ELITE_PITCHER; // Positive Regression Lock
                if (xERA >= 5.00) awayPitcherWeak = WEIGHT_WEAK_PITCHER;
            }
        }

        const homeTotalStrength = (homeElite * WEIGHT_ELITE_BAT) + homePitcherElite + (homeHotCount * WEIGHT_HOT_BAT) + homePitcherWeak + homeMetricBonus;
        const awayTotalStrength = (awayElite * WEIGHT_ELITE_BAT) + awayPitcherElite + (awayHotCount * WEIGHT_HOT_BAT) + awayPitcherWeak + awayMetricBonus;

        const disparity = Math.abs(homeTotalStrength - awayTotalStrength);
        const favored = homeTotalStrength > awayTotalStrength ? "Home" : "Away";

        // Brand Momentum Adjustment (Handling cases like 10-3 Yankees)
        let brandAdjustment = 0;
        if (details.homeTeam?.includes("Yankees") || details.awayTeam?.includes("Yankees")) {
            // Yankees specifically get a "Corporate Titan" momentum boost in the 'reason' but we stay data-led
            brandAdjustment = 0.5;
        }

        let reason = disparity > 0 ? `Strong ${favored} advantage (+${disparity.toFixed(1)} strength).` : "Lineups are competitively balanced.";
        if (homeMetricBonus > 0 || awayMetricBonus > 0) {
            reason += ` Adv. Metrics Boost: Home(+${homeMetricBonus}) Away(+${awayMetricBonus}).`;
        }
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
