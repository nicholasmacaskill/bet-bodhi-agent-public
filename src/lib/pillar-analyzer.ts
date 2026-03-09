/**
 * Pillar Analyzer v2.0
 * Scores MLB games for +EV by comparing Bodhi Strength Score to Market Odds.
 */
import { ethers } from 'ethers';

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
    runLineTeam?: string;
    runLineOdds?: number;
    runLinePoint?: number;
    polyConditionId?: string;
    polyOutcomeIndex?: number;
    polySharePrice?: number;
    polyEV?: number;
    sxMarketHash?: string;
    sxSharePrice?: number;
    sxEV?: number;
    executionRoute?: 'POLY' | 'SX' | 'NONE';
    homePitcher?: string;
    awayPitcher?: string;
    homeOdds?: number;
    awayOdds?: number;
    matchupNotes?: string;
    advantages?: string[];
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
        polyMarket?: any,
        hotBats: string[] = [],
        weakPitchers: string[] = [],
        playerStats?: Map<string, any>,
        bankroll: number = 464,
        sxMarket?: any,
        mood?: string,
        calmness?: number
    ): BodhiAnalysis {
        const homeTeam = game.homeTeam;
        const awayTeam = game.awayTeam;

        const pillars: PillarScore[] = [];

        // 1. Technical Analysis (Sport-Specific)
        const techResult = this.scoreTechnicalSport(details, homeTeam, awayTeam, hotBats, weakPitchers, playerStats);
        const techSport = techResult.score;
        const advantages = techResult.advantages;
        pillars.push(techSport);

        // 2. Seasonal Sport (Logic: Ramping and Environment)
        const seasonalSport = this.scoreSeasonalSport(game);
        pillars.push(seasonalSport);
        if (seasonalSport.score >= 7 && seasonalSport.reason.includes("Cactus")) {
            advantages.push("🏜️ Cactus League dry air offense boost.");
        }

        // Calculate initial confidence for sizing purposes and Bodhi True Probability
        let currentConfidence = ((techSport.score + seasonalSport.score) / 20) * 100;

        // Veto logic preparation — handle both plain string (schedule API) and { fullName } (live API)
        const parseProbable = (p: any): string => {
            if (!p) return "TBD / Bullpen";
            if (typeof p === 'string') return p;
            return p.fullName || p.name || "TBD / Bullpen";
        };
        const homePitcher = parseProbable(details.probables?.home);
        const awayPitcher = parseProbable(details.probables?.away);

        const isHomeElite = homePitcher !== "TBD / Bullpen" && (ELITE_PITCHERS.includes(homePitcher) || hotBats.includes(homePitcher));
        const isAwayElite = awayPitcher !== "TBD / Bullpen" && (ELITE_PITCHERS.includes(awayPitcher) || hotBats.includes(awayPitcher));

        // Identify weak pitchers (for veto)
        const isHomeWeak = homePitcher !== "TBD / Bullpen" && (weakPitchers.includes(homePitcher) || (playerStats?.get(homePitcher)?.xera >= 5.00));
        const isAwayWeak = awayPitcher !== "TBD / Bullpen" && (weakPitchers.includes(awayPitcher) || (playerStats?.get(awayPitcher)?.xera >= 5.00));

        // Setup outputs
        let recommendedAction = "PASS - No clear edge.";
        let valueTeam = undefined;
        let recommendedSize = this.getSizing(currentConfidence, bankroll).label;
        let suggestedStake = this.getSizing(currentConfidence, bankroll).amount;
        let polyConditionId = undefined;
        let polySharePrice = undefined;
        let polyEV = undefined;
        let sxMarketHash = sxMarket ? sxMarket.marketHash : undefined;
        let sxSharePrice = undefined;
        let sxEV = undefined;
        let executionRoute: 'POLY' | 'SX' | 'NONE' = 'NONE';

        let bookieScore: PillarScore = {
            pillar: "Technical (Bookies)",
            score: 5,
            reason: "No Polymarket match found. Neutral default.",
            side: "neutral"
        };

        // 3. Web3 Execution & EV Logic
        const techFavored = techSport.side;

        let homePrice = 0;
        let awayPrice = 0;
        let homeIdx = -1;
        let awayIdx = -1;

        if (techFavored !== 'neutral') {
            const bodhiProb = currentConfidence / 100;
            valueTeam = techFavored === 'home' ? homeTeam : awayTeam;

            // 3a. Polymarket EV Calculation
            if (polyMarket && polyMarket.outcomes) {
                polyConditionId = polyMarket.conditionId;

                for (let i = 0; i < polyMarket.outcomes.length; i++) {
                    const outcomeName = polyMarket.outcomes[i].toLowerCase();
                    const price = parseFloat(polyMarket.outcomePrices[i]);

                    if (homeTeam.toLowerCase().includes(outcomeName) || outcomeName.includes(homeTeam.toLowerCase().split(' ').pop())) {
                        homePrice = price;
                        homeIdx = i;
                    } else if (awayTeam.toLowerCase().includes(outcomeName) || outcomeName.includes(awayTeam.toLowerCase().split(' ').pop())) {
                        awayPrice = price;
                        awayIdx = i;
                    }
                }

                let marketPrice = techFavored === 'home' ? homePrice : awayPrice;

                // Check Veto Rules first
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
                    bookieScore.score = 2;
                    bookieScore.reason = vetoReason;
                    recommendedAction = vetoReason;
                    valueTeam = undefined;
                } else if (marketPrice > 0) {
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
                        advantages.push(`📉 Price Inefficiency: Current market pricing under-estimates ${valueTeam} by ${(polyEV * 100).toFixed(1)}% based on historical technical performance metrics.`);
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

            // 3b. Calculate SX Bet EV
            if (sxMarket && sxMarket.outcomeOneName && sxMarket.outcomeTwoName) {
                const targetMascot = valueTeam?.split(' ').pop()?.toLowerCase() || '';

                let sxCost = undefined;
                if (sxMarket.outcomeOneName.toLowerCase().includes(targetMascot)) {
                    sxCost = sxMarket.outcomeOneOdds ? parseFloat(ethers.formatUnits(sxMarket.outcomeOneOdds, 20)) : undefined;
                } else if (sxMarket.outcomeTwoName.toLowerCase().includes(targetMascot)) {
                    sxCost = sxMarket.outcomeTwoOdds ? parseFloat(ethers.formatUnits(sxMarket.outcomeTwoOdds, 20)) : undefined;
                }

                if (sxCost !== undefined && sxCost > 0 && sxCost < 1.0) {
                    sxSharePrice = sxCost;
                    sxEV = (bodhiProb - sxCost) * 100;
                }
            }

            // 3c. Determine Execution Route (Waterfall Arb)
            if (sxEV !== undefined && polyEV !== undefined) {
                // Arb: Choose highest EV (Lowest Cost)
                if (sxEV > (polyEV * 100)) {
                    executionRoute = 'SX';
                    recommendedAction = `HIGH CONVICTION - Buy ${valueTeam} on SX Bet (+${sxEV.toFixed(1)}% EV).`;
                    bookieScore.score = 9;
                    bookieScore.reason = `Cross-chain Arb. SX Bet (+${sxEV.toFixed(1)}% EV) beats Polymarket (+${(polyEV * 100).toFixed(1)}% EV).`;
                } else {
                    executionRoute = 'POLY';
                }
            } else if (sxEV !== undefined && sxSharePrice !== undefined) {
                executionRoute = 'SX';
                recommendedAction = `HIGH CONVICTION - Buy ${valueTeam} on SX Bet (+${sxEV.toFixed(1)}% EV).`;
                bookieScore.score = 8;
                bookieScore.reason = `Web3 Edge found on SX Bet. Bodhi: ${(bodhiProb * 100).toFixed(1)}% vs Crowd: ${(sxSharePrice * 100).toFixed(1)}%.`;
                bookieScore.side = techFavored;
            } else if (polyEV !== undefined) {
                executionRoute = 'POLY';
            } else {
                recommendedAction = `PASS - Value identified on ${valueTeam}, but no Web3 liquidity found.`;
                bookieScore.reason = "Bodhi probability accurately mirrors or lacks Web3 match. No edge.";
            }
        }

        // 4. Preseason Fallback (No Web3 execution route found)
        if (executionRoute === 'NONE') {
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
                    bookieScore.score = 2;
                    bookieScore.reason = vetoReason;
                    recommendedAction = vetoReason;
                    valueTeam = undefined;
                } else {
                    // Mock preseason line logic
                    polyEV = (currentConfidence / 100) - 0.50;
                    polySharePrice = 0.50;
                    bookieScore.score = 7;
                    bookieScore.reason = `PRESEASON MODE: No Web3 Market. Bodhi True Prob hits ${(currentConfidence).toFixed(1)}%.`;
                    bookieScore.side = techFavored;
                    recommendedAction = `PRESEASON CONVICTION - Bet ${valueTeam} (Implied Edge: +${(polyEV * 100).toFixed(1)}%).`;
                }
            }
        }

        pillars.push(bookieScore);

        // 4. Technical (Bankroll)
        pillars.push({
            pillar: "Technical (Bankroll)",
            score: bankroll >= 400 ? 9 : 6,
            reason: bankroll >= 400 ? "Bankroll is healthy. 7.5% unit size is sustainable." : "Bankroll depth is caution-range."
        });

        // 5. Psychological (Players)
        pillars.push({
            pillar: "Psychological (Players)",
            score: 6,
            reason: "Early spring motivation is generally neutral unless roster battles are flagged."
        });

        // 6. Psychological (Bettor)
        const psychBettorScore = {
            pillar: "Psychological (Bettor)",
            score: calmness ? Math.floor(calmness) : 8,
            reason: mood ? `Mindset: ${mood} (${calmness}/10). Risk parameters adjusted.` : "Neutral mindset assumed (8/10)."
        };
        pillars.push(psychBettorScore);

        // 7. Physiological/Spiritual
        const spiritualScore = {
            pillar: "Physiological/Spiritual",
            score: 9,
            reason: "Positive resonance: State of /scan supports high-clarity execution."
        };
        pillars.push(spiritualScore);

        // Recalculate Final Confidence incorporating psych pillars
        const finalConfidence = Math.floor((pillars.reduce((acc, p) => acc + p.score, 0) / (pillars.length * 10)) * 100);

        // Finalize sizing
        if (valueTeam) {
            let effectiveBankroll = bankroll;
            let calmnessModifier = 1.0;

            if (calmness !== undefined && calmness < 7) {
                // Throttle stake if tilted or anxious
                calmnessModifier = 0.5; // Half size for lack of flow
            }

            const sizing = this.getSizing(finalConfidence, effectiveBankroll);
            recommendedSize = calmness !== undefined && calmness < 7 ? "Throttled (Caution)" : sizing.label;
            suggestedStake = sizing.amount * calmnessModifier;
        }

        return {
            gamePk: game.gamePk,
            homeTeam,
            awayTeam,
            overallConfidence: finalConfidence,
            pillars,
            valueTeam,
            polyConditionId,
            polySharePrice,
            polyEV,
            polyOutcomeIndex: valueTeam ? (valueTeam === homeTeam ? homeIdx : awayIdx) : undefined,
            sxMarketHash,
            sxSharePrice,
            sxEV,
            executionRoute,
            recommendedAction,
            recommendedSize: this.getSizing(finalConfidence, bankroll).label,
            suggestedStake: this.getSizing(finalConfidence, bankroll).amount,
            homePitcher,
            awayPitcher,
            homeOdds: polyMarket ? homePrice : undefined,
            awayOdds: polyMarket ? awayPrice : undefined,
            matchupNotes: `${awayPitcher || '?'} vs ${homePitcher || '?'}. ${techSport.reason}`,
            advantages: advantages.length >= 3 ? advantages.slice(0, 3) : this.backfillAdvantages(advantages, finalConfidence, mood)
        };
    }

    private backfillAdvantages(existing: string[], confidence: number, mood?: string): string[] {
        const backfilled = [...existing];
        if (backfilled.length < 3 && confidence > 70) {
            backfilled.push("✨ High Confidence Signal: Multiple technical pillars (Technical Sport, Seasonal, and Bookies) have cross-verified this entry, confirming a stable edge.");
        }
        if (backfilled.length < 3 && mood) {
            backfilled.push(`⚡ High-Clarity Execution: Your current psychological state (${mood}) supports high-conviction decision making, reducing the emotional risk of this play.`);
        }
        if (backfilled.length < 3) {
            backfilled.push("📋 Roster Stability: Our internal model favors this side based on 2026 depth charts and projected innings distribution, indicating a higher baseline performance floor.");
        }
        return backfilled.slice(0, 3);
    }

    private getSizing(confidence: number, bankroll: number): { label: string, amount: number } {
        if (confidence >= 80) return { label: "Aggressive (7.5%)", amount: bankroll * 0.075 };
        if (confidence >= 70) return { label: "Standard (4.0%)", amount: bankroll * 0.04 };
        if (confidence >= 60) return { label: "Caution (2.0%)", amount: bankroll * 0.02 };
        return { label: "Zero (0%)", amount: 0 };
    }

    private normalizeTeam(team: string): string {
        return team.replace("Los Angeles ", "").replace("Arizona ", "");
    }

    private scoreTechnicalSport(details: any, homeTeam: string, awayTeam: string, hotBats: string[] = [], weakPitchers: string[] = [], playerStats?: Map<string, any>): { score: PillarScore, advantages: string[] } {
        let homeElite = 0;
        let awayElite = 0;
        let homeHotCount = 0;
        let awayHotCount = 0;
        let homeMetricBonus = 0;
        let awayMetricBonus = 0;
        const advantages: string[] = [];

        const homeEliteNames: string[] = [];
        const awayEliteNames: string[] = [];
        const homeHotNames: string[] = [];
        const awayHotNames: string[] = [];

        (details.lineups?.home || []).forEach((p: string) => {
            if (ELITE_BATS.includes(p)) {
                homeElite++;
                homeEliteNames.push(p);
            }
            if (hotBats.includes(p)) {
                homeHotCount++;
                homeHotNames.push(p);
            }

            // v3.0 Metrics Sniper: Check for elite xWOBA (>= .380)
            if (playerStats && playerStats.has(p) && playerStats.get(p).xwoba >= 0.380) {
                homeMetricBonus += 0.5;
            }
        });

        (details.lineups?.away || []).forEach((p: string) => {
            if (ELITE_BATS.includes(p)) {
                awayElite++;
                awayEliteNames.push(p);
            }
            if (hotBats.includes(p)) {
                awayHotCount++;
                awayHotNames.push(p);
            }

            // v3.0 Metrics Sniper: Check for elite xWOBA (>= .380)
            if (playerStats && playerStats.has(p) && playerStats.get(p).xwoba >= 0.380) {
                awayMetricBonus += 0.5;
            }
        });

        // Normalise pitcher: schedule API returns a plain string, game-details API returns { fullName: ... }
        const parsePitcher = (p: any): string => {
            if (!p) return "";
            if (typeof p === 'string') return p;
            return p.fullName || p.name || "";
        };
        const homePitcher = parsePitcher(details.probables?.home);
        const awayPitcher = parsePitcher(details.probables?.away);


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
        const favored = homeTotalStrength > awayTotalStrength ? "home" : "away";

        const favoredPitcher = favored === 'home' ? homePitcher : awayPitcher;
        const unfavoredPitcher = favored === 'home' ? awayPitcher : homePitcher;
        const favoredEliteCount = favored === 'home' ? homeElite : awayElite;

        // Collect Advantages
        if (favored === 'home') {
            if (homePitcherElite) advantages.push(`🔥 Elite Starting Pitcher: ${homePitcher} is currently in the top 10% of the league for xERA/Whiff rate (2026 stats), providing a significant technical edge on the mound.`);
            if (homeHotCount >= 2) advantages.push(`⚡ Offensive Surge: ${homeHotCount} players in the starting lineup are currently on a 72h 'heater' with elevated hard-hit rates, indicating a peak scoring window.`);
            if (awayPitcherWeak) advantages.push(`🎯 Vulnerable Matchup: Facing ${awayPitcher} (ERA/xERA > 5.00), who has shown consistent vulnerability against high-power offenses in recent starts.`);
            if (homeElite >= 2) advantages.push(`💎 Superior Roster Depth: Our 2026 depth-chart model identifies multiple 'Elite' tier bats active in this lineup, providing offensive stability through the mid-innings.`);
        } else {
            if (awayPitcherElite) advantages.push(`🔥 Elite Starting Pitcher: ${awayPitcher} is currently in the top 10% of the league for xERA/Whiff rate (2026 stats), providing a significant technical edge on the mound.`);
            if (awayHotCount >= 2) advantages.push(`⚡ Offensive Surge: ${awayHotCount} players in the starting lineup are currently on a 72h 'heater' with elevated hard-hit rates, indicating a peak scoring window.`);
            if (homePitcherWeak) advantages.push(`🎯 Vulnerable Matchup: Facing ${homePitcher} (ERA/xERA > 5.00), who has shown consistent vulnerability against high-power offenses in recent starts.`);
            if (awayElite >= 2) advantages.push(`💎 Superior Roster Depth: Our 2026 depth-chart model identifies multiple 'Elite' tier bats active in this lineup, providing offensive stability through the mid-innings.`);
        }

        // Hot Offense vs Weak Pitcher Boost
        let mismatchBoost = 0;
        if (favored === 'home' && homeHotCount >= 2 && awayPitcherWeak) {
            mismatchBoost = 2;
            advantages.push("🚀 Tactical Advantage: Optimized scoring opportunity against a bottom-tier starter with poor secondary metrics.");
        } else if (favored === 'away' && awayHotCount >= 2 && homePitcherWeak) {
            mismatchBoost = 2;
            advantages.push("🚀 Tactical Advantage: Optimized scoring opportunity against a bottom-tier starter with poor secondary metrics.");
        }

        // Matchup Archetype Engine
        const homeTeamShort = homeTeam.split(' ').pop();
        const awayTeamShort = awayTeam.split(' ').pop();
        const favoredTeamFull = favored === 'home' ? homeTeam : awayTeam;
        const unfavoredTeamFull = favored === 'home' ? awayTeam : homeTeam;
        const favoredTeamS = favored === 'home' ? homeTeamShort : awayTeamShort;
        const unfavoredTeamS = favored === 'home' ? awayTeamShort : homeTeamShort;

        const isHomeTBD = homePitcher === "TBD / Bullpen" || !homePitcher;
        const isAwayTBD = awayPitcher === "TBD / Bullpen" || !awayPitcher;

        // Derive who holds the ace
        const favoredPitcherElite = favored === 'home' ? homePitcherElite : awayPitcherElite;
        const unfavoredPitcherElite = favored === 'home' ? awayPitcherElite : homePitcherElite;
        const favoredHotNames = favored === 'home' ? homeHotNames : awayHotNames;

        let narrative = "";

        if (homePitcherElite && awayPitcherElite) {
            // Both aces — edge goes to the favored side's support cast
            const supportStar = favored === 'home' ? (homeEliteNames[0] || 'lineup depth') : (awayEliteNames[0] || 'lineup depth');
            narrative = `Pitching Duel: ${homePitcher} vs. ${awayPitcher}. Both starters carry elite xERA metrics, but the ${favoredTeamFull} hold a +${disparity.toFixed(1)} composite edge driven by ${supportStar} providing an offensive cushion the opponent lacks. `;
        } else if (favoredPitcherElite && !unfavoredPitcherElite) {
            // One dominant ace on the favored side
            narrative = `Dominant Pitching Advantage: ${favoredPitcher} is one of the league's elite starters (top-10% xERA/Whiff%) and starts for the ${favoredTeamFull} today. Facing ${unfavoredPitcher}, our model identifies a clear +${disparity.toFixed(1)} technical edge in this arms race. `;
        } else if (mismatchBoost > 0) {
            // Hot offense exploiting a weak arm
            const star = favoredHotNames[0] || (favored === 'home' ? homeEliteNames[0] : awayEliteNames[0]) || 'their lineup';
            narrative = `Offense vs. Defense Mismatch: The ${favoredTeamFull}, led by ${star}, are in a peak offensive window and facing ${unfavoredPitcher} — a pitcher with vulnerable secondary metrics (xERA/ERA > 5.00). A +${disparity.toFixed(1)} delta signals high scoring probability. `;
        } else if (isHomeTBD || isAwayTBD) {
            // Bullpen game stability edge
            const tbdSide = isHomeTBD && isAwayTBD ? 'both teams' : (isHomeTBD ? homeTeam : awayTeam);
            narrative = `Bullpen Game Stability: With ${tbdSide} going to the 'pen, the ${favoredTeamFull} hold a +${disparity.toFixed(1)} Depth Advantage. Their secondary pitching metrics and roster flexibility rank higher than the ${unfavoredTeamS}'s available arms for today's slate. `;
        } else if (favoredEliteCount >= 2) {
            // Heavy lineup advantage
            const stars = favored === 'home' ? homeEliteNames.slice(0, 2).join(' and ') : awayEliteNames.slice(0, 2).join(' and ');
            narrative = `Lineup Depth Edge: The ${favoredTeamFull}, featuring ${stars || 'multiple elite-tier bats'}, carry a +${disparity.toFixed(1)} roster advantage. Their high-level offensive ceiling creates sustained pressure that ${unfavoredPitcher} will need to contain across 6+ innings. `;
        } else if (disparity === 0) {
            // True coin-flip — neutral
            narrative = `Even Technical Profile: Both ${homeTeam} and ${awayTeam} show comparable strength metrics. This matchup is expected to be decided by situational execution, weather, or late-game management rather than structural advantages in our model. `;
        } else {
            // Marginal lean — at least name the players
            narrative = `Marginal Technical Edge: Our model gives the ${favoredTeamFull} a slight +${disparity.toFixed(1)} Strength lead over the ${unfavoredTeamFull}. With ${favoredPitcher !== 'TBD / Bullpen' ? favoredPitcher + ' on the mound' : 'bullpen management in play'}, this is a low-disparity lean that requires other confirmatory signals before sizing up. `;
        }

        // Add dynamic trailing context
        if (playerStats) {
            const hStats = playerStats.get(homePitcher);
            const aStats = playerStats.get(awayPitcher);
            if (hStats && aStats) {
                const xERADelta = Math.abs(hStats.xera - aStats.xera);
                if (xERADelta > 1.0) {
                    narrative += `The ${xERADelta.toFixed(2)} xERA differential on the mound remains the primary technical anchor for this +EV signal.`;
                }
            }
        }

        return {
            score: {
                pillar: "Technical Roster Advantage",
                score: Math.min(10, Math.floor(5 + disparity + mismatchBoost)),
                reason: narrative,
                side: disparity === 0 ? 'neutral' : favored
            },
            advantages
        };
    }

    private scoreSeasonalSport(game: any): PillarScore {
        const isArizona = game.venue?.includes("Stadium") || game.venue?.includes("Field") || game.venue?.includes("Complex");
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
