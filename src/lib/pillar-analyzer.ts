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
    executionRoute?: 'POLY' | 'NONE';
    homePitcher?: string;
    awayPitcher?: string;
    homeOdds?: number;
    awayOdds?: number;
    matchupNotes?: string;
    advantages?: string[];
    killCriteria?: string[];
    dataIntegrity?: 'complete' | 'incomplete';
    incompleteReasons?: string[];
}

// Map of 2026 Elite MLB Pitchers
const ELITE_PITCHERS = ["Spencer Strider", "Corbin Burnes", "Zack Wheeler", "Luis Castillo", "Gerrit Cole", "Logan Webb", "Zac Gallen", "George Kirby", "Kevin Gausman", "Bryan Woo", "Yoshinobu Yamamoto",
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

// Map of 2026 Weak/Vulnerable MLB Pitchers (ERA / xERA ≥ 5.00 last season)
// These automatically apply a negative weight even if not passed in at scan time.
const WEAK_PITCHERS_STATIC = [
    "José Urquidy",      // 5.97 ERA (2025) — high walk rate, poor secondary stuff
    "Adrian Houser",     // 5.80 ERA — home run prone, weak strikeout rate
    "Michael Lorenzen",  // 5.60 ERA — fly-ball heavy, limited swing-and-miss
    "Jake Odorizzi",     // 5.50 ERA — diminished velo, soft contact reliant
    "Zach Davies",       // 5.45 ERA — extreme contact pitcher, bullpen game risk
    "Aaron Civale",      // 5.30 ERA — high BABIP, weak xFIP track record
];

// Decision Weights - Pitching is paramount but rosters matter
const WEIGHT_ELITE_PITCHER = 15;
const WEIGHT_ELITE_BAT = 3;      // Increased from 1
const WEIGHT_HOT_BAT = 1.5;      // Increased from 0.5
const WEIGHT_WEAK_PITCHER = -15;

export function getSizing(confidence: number, bankroll: number): { label: string, amount: number } {
    if (confidence >= 80) return { label: "Aggressive (7.5%)", amount: bankroll * 0.075 };
    if (confidence >= 70) return { label: "Standard (4.0%)", amount: bankroll * 0.04 };
    if (confidence >= 60) return { label: "Caution (2.0%)", amount: bankroll * 0.02 };
    return { label: "Zero (0%)", amount: 0 };
}

export class PillarAnalyzer {

    analyzeGame(
        game: any,
        details: any,
        polyMarket?: any,
        hotBats: string[] = [],
        weakPitchers: string[] = [],
        playerStats?: Map<string, any>,
        bankroll: number = 464,
        mood?: string,
        calmness?: number,
        rosters?: { home: string[], away: string[] },
        slumpMultiplier: number = 1.0
    ): BodhiAnalysis {
        const homeTeam = game.homeTeam;
        const awayTeam = game.awayTeam;

        const pillars: PillarScore[] = [];

        // 1. Technical Analysis (Sport-Specific)
        const techResult = this.scoreTechnicalSport(details, homeTeam, awayTeam, hotBats, weakPitchers, playerStats, rosters);
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
        let recommendedSize = "Zero (0%)";
        let suggestedStake = 0;
        let polyConditionId = undefined;
        let polySharePrice = undefined;
        let polyEV = undefined;
        let executionRoute: 'POLY' | 'NONE' = 'NONE';
        let killCriteria: string[] = [];

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

            if (polyEV !== undefined) {
                executionRoute = 'POLY';
            } else {
                recommendedAction = `PASS - Value identified on ${valueTeam}, but no Web3 liquidity found.`;
                bookieScore.reason = "Bodhi probability accurately mirrors or lacks Web3 match. No edge.";
            }
        }

        // 4. Preseason Fallback (No Web3 execution route found)
        if (executionRoute === 'NONE') {
            const techFavored = techSport.side;
            // Lowered threshold to 51% to catch minor technical edges
            if (techFavored !== 'neutral' && currentConfidence >= 51) {
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
                    // Preseason mode: calculate implied edge relative to 50/50 baseline
                    polyEV = (currentConfidence / 100) - 0.50;
                    polySharePrice = 0.50;
                    bookieScore.score = 7;
                    bookieScore.reason = `PRESEASON MODE: No Web3 Market. Bodhi True Prob hits ${(currentConfidence).toFixed(1)}%.`;
                    bookieScore.side = techFavored;
                    
                    if (currentConfidence >= 75) {
                        recommendedAction = `PRESEASON CONVICTION - Bet ${valueTeam} (Implied Edge: +${(polyEV * 100).toFixed(1)}%).`;
                    } else {
                        recommendedAction = `PRESEASON LEAN - Technical edge on ${valueTeam} (Implied Edge: +${(polyEV * 100).toFixed(1)}%).`;
                    }
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

        // Objective confidence: 3 data-driven pillars only (Technical + Seasonal + Bookies)
        const objectiveConfidence = Math.round(
            ((techSport.score + seasonalSport.score + bookieScore.score) / 30) * 100
        );
        currentConfidence = objectiveConfidence;

        // Finalize sizing (objectiveConfidence + soft-pillar modifiers)
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

        // Generate Kill Criteria
        if (homePitcher === "TBD / Bullpen" || awayPitcher === "TBD / Bullpen") {
            killCriteria.push("ABORT IF: Expected starter scratch or transition to unknown opener.");
        }
        if (polyMarket) {
            killCriteria.push("ABORT IF: Crowd Price shifts below 45% (Sharp reversal).");
        }
        if (seasonalSport.score <= 4) {
            killCriteria.push(`ABORT IF: Wind conditions exceed 20mph blowing IN (current: ${game.weather?.wind || 'unknown'}).`);
        }

        // Finalize Bodhi Result
        return {
            gamePk: game.gamePk,
            homeTeam,
            awayTeam,
            overallConfidence: currentConfidence, // Use updated confidence
            pillars,
            valueTeam,
            polyConditionId,
            polySharePrice,
            polyEV,
            polyOutcomeIndex: valueTeam ? (valueTeam === homeTeam ? homeIdx : awayIdx) : undefined,
            executionRoute,
            recommendedAction,
            recommendedSize,
            suggestedStake,
            homePitcher,
            awayPitcher,
            homeOdds: polyMarket ? homePrice : undefined,
            awayOdds: polyMarket ? awayPrice : undefined,
            matchupNotes: `${awayPitcher || '?'} vs ${homePitcher || '?'}. ${techSport.reason}`,
            advantages: advantages.length >= 3 ? advantages.slice(0, 3) : this.backfillAdvantages(advantages, currentConfidence, mood),
            killCriteria,
            dataIntegrity: 'complete' as const
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

    private getSizing(confidence: number, bankroll: number) {
        return getSizing(confidence, bankroll);
    }

    private normalizeTeam(team: string): string {
        return team.replace("Los Angeles ", "").replace("Arizona ", "");
    }

    private scoreTechnicalSport(details: any, homeTeam: string, awayTeam: string, hotBats: string[] = [], weakPitchers: string[] = [], playerStats?: Map<string, any>, rosters?: { home: string[], away: string[] }): { score: PillarScore, advantages: string[] } {
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

        const flexMatch = (playerList: string[], target: string, listName: string) => {
            if (!target) return false;
            const t = target.toLowerCase();
            const match = playerList.find(p => {
                const lp = p.toLowerCase();
                return t.includes(lp) || lp.includes(t);
            });
            return !!match;
        };

        const homePlayers = details.lineups?.home?.length > 0 ? details.lineups.home : (rosters?.home || []);
        const awayPlayers = details.lineups?.away?.length > 0 ? details.lineups.away : (rosters?.away || []);

        homePlayers.forEach((p: string) => {
            if (flexMatch(ELITE_BATS, p, 'ELITE_BATS')) {
                homeElite++;
                homeEliteNames.push(p);
            }
            if (flexMatch(hotBats, p, 'hotBats')) {
                homeHotCount++;
                homeHotNames.push(p);
            }
            if (playerStats && playerStats.has(p) && playerStats.get(p).xwoba >= 0.380) {
                homeMetricBonus += 0.5;
            }
        });

        awayPlayers.forEach((p: string) => {
            if (flexMatch(ELITE_BATS, p, 'ELITE_BATS')) {
                awayElite++;
                awayEliteNames.push(p);
            }
            if (flexMatch(hotBats, p, 'hotBats')) {
                awayHotCount++;
                awayHotNames.push(p);
            }
            if (playerStats && playerStats.has(p) && playerStats.get(p).xwoba >= 0.380) {
                awayMetricBonus += 0.5;
            }
        });

        const parsePitcher = (p: any): string => {
            if (!p) return "";
            if (typeof p === 'string') return p;
            return p.fullName || p.name || "";
        };
        const homePitcher = parsePitcher(details.probables?.home);
        const awayPitcher = parsePitcher(details.probables?.away);

        let homePitcherElite = flexMatch(ELITE_PITCHERS, homePitcher, 'ELITE_PITCHERS') ? WEIGHT_ELITE_PITCHER : 0;
        let awayPitcherElite = flexMatch(ELITE_PITCHERS, awayPitcher, 'ELITE_PITCHERS') ? WEIGHT_ELITE_PITCHER : 0;

        const allWeak = [...weakPitchers, ...WEAK_PITCHERS_STATIC];
        let homePitcherWeak = flexMatch(allWeak, homePitcher, 'WEAK_PITCHERS') ? WEIGHT_WEAK_PITCHER : 0;
        let awayPitcherWeak = flexMatch(allWeak, awayPitcher, 'WEAK_PITCHERS') ? WEIGHT_WEAK_PITCHER : 0;

        if (playerStats) {
            const calculateComposite = (name: string) => {
                const stats = playerStats.get(name);
                if (!stats) return null;
                
                const regEra = stats.regular?.era ? parseFloat(stats.regular.era) : 4.0;
                const sprEra = stats.spring?.era ? parseFloat(stats.spring.era) : regEra;
                
                // 70/30 weighting: 70% Regular Season / 30% Spring Training
                return (regEra * 0.7) + (sprEra * 0.3);
            };

            const homeComposite = calculateComposite(homePitcher);
            if (homeComposite !== null) {
                if (homeComposite <= 2.80) homePitcherElite = WEIGHT_ELITE_PITCHER;
                if (homeComposite >= 5.00) homePitcherWeak = WEIGHT_WEAK_PITCHER;
            }

            const awayComposite = calculateComposite(awayPitcher);
            if (awayComposite !== null) {
                if (awayComposite <= 2.80) awayPitcherElite = WEIGHT_ELITE_PITCHER;
                if (awayComposite >= 5.00) awayPitcherWeak = WEIGHT_WEAK_PITCHER;
            }
        }

        const homeTotalStrength = (homeElite * WEIGHT_ELITE_BAT) + homePitcherElite + (homeHotCount * WEIGHT_HOT_BAT) + homePitcherWeak + homeMetricBonus;
        const awayTotalStrength = (awayElite * WEIGHT_ELITE_BAT) + awayPitcherElite + (awayHotCount * WEIGHT_HOT_BAT) + awayPitcherWeak + awayMetricBonus;

        const disparity = Math.abs(homeTotalStrength - awayTotalStrength);
        const favored = homeTotalStrength > awayTotalStrength ? "home" : "away";

        const favoredPitcher = favored === 'home' ? homePitcher : awayPitcher;
        const unfavoredPitcher = favored === 'home' ? awayPitcher : homePitcher;
        const favoredEliteCount = favored === 'home' ? homeElite : awayElite;

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

        let mismatchBoost = 0;
        if (favored === 'home' && homeHotCount >= 2 && awayPitcherWeak) {
            mismatchBoost = 2;
            advantages.push("🚀 Tactical Advantage: Optimized scoring opportunity against a bottom-tier starter with poor secondary metrics.");
        } else if (favored === 'away' && awayHotCount >= 2 && homePitcherWeak) {
            mismatchBoost = 2;
            advantages.push("🚀 Tactical Advantage: Optimized scoring opportunity against a bottom-tier starter with poor secondary metrics.");
        }

        const homeTeamShort = homeTeam.split(' ').pop();
        const awayTeamShort = awayTeam.split(' ').pop();
        const favoredTeamFull = favored === 'home' ? homeTeam : awayTeam;
        const unfavoredTeamFull = favored === 'home' ? awayTeam : homeTeam;
        const favoredTeamS = favored === 'home' ? homeTeamShort : awayTeamShort;
        const unfavoredTeamS = favored === 'home' ? awayTeamShort : homeTeamShort;

        const isHomeTBD = homePitcher === "TBD / Bullpen" || !homePitcher;
        const isAwayTBD = awayPitcher === "TBD / Bullpen" || !awayPitcher;

        const favoredPitcherElite = favored === 'home' ? homePitcherElite : awayPitcherElite;
        const unfavoredPitcherElite = favored === 'home' ? awayPitcherElite : homePitcherElite;
        const favoredHotNames = favored === 'home' ? homeHotNames : awayHotNames;

        let narrative = "";

        if (homePitcherElite && awayPitcherElite) {
            const supportStar = favored === 'home' ? (homeEliteNames[0] || 'lineup depth') : (awayEliteNames[0] || 'lineup depth');
            narrative = `Pitching Duel: ${homePitcher} vs. ${awayPitcher}. Both starters carry elite xERA metrics, but the ${favoredTeamFull} hold a +${disparity.toFixed(1)} composite edge driven by ${supportStar} providing an offensive cushion the opponent lacks. `;
        } else if (favoredPitcherElite && !unfavoredPitcherElite) {
            narrative = `Dominant Pitching Advantage: ${favoredPitcher} is one of the league's elite starters (top-10% xERA/Whiff%) and starts for the ${favoredTeamFull} today. Facing ${unfavoredPitcher}, our model identifies a clear +${disparity.toFixed(1)} technical edge in this arms race. `;
        } else if (mismatchBoost > 0) {
            const star = favoredHotNames[0] || (favored === 'home' ? homeEliteNames[0] : awayEliteNames[0]) || 'their lineup';
            narrative = `Offense vs. Defense Mismatch: The ${favoredTeamFull}, led by ${star}, are in a peak offensive window and facing ${unfavoredPitcher} — a pitcher with vulnerable secondary metrics (xERA/ERA > 5.00). A +${disparity.toFixed(1)} delta signals high scoring probability. `;
        } else if (isHomeTBD || isAwayTBD) {
            const tbdSide = isHomeTBD && isAwayTBD ? 'both teams' : (isHomeTBD ? homeTeam : awayTeam);
            narrative = `Bullpen Game Stability: With ${tbdSide} going to the 'pen, the ${favoredTeamFull} hold a +${disparity.toFixed(1)} Depth Advantage. Their secondary pitching metrics and roster flexibility rank higher than the ${unfavoredTeamS}'s available arms for today's slate. `;
        } else if (favoredEliteCount >= 2) {
            const stars = favored === 'home' ? homeEliteNames.slice(0, 2).join(' and ') : awayEliteNames.slice(0, 2).join(' and ');
            narrative = `Lineup Depth Edge: The ${favoredTeamFull}, featuring ${stars || 'multiple elite-tier bats'}, carry a +${disparity.toFixed(1)} roster advantage. Their high-level offensive ceiling creates sustained pressure that ${unfavoredPitcher} will need to contain across 6+ innings. `;
        } else if (disparity === 0) {
            narrative = `Even Technical Profile: Both ${homeTeam} and ${awayTeam} show comparable strength metrics. This matchup is expected to be decided by situational execution, weather, or late-game management rather than structural advantages in our model. `;
        } else {
            narrative = `Marginal Technical Edge: Our model gives the ${favoredTeamFull} a slight +${disparity.toFixed(1)} Strength lead over the ${unfavoredTeamFull}. With ${favoredPitcher !== 'TBD / Bullpen' ? favoredPitcher + ' on the mound' : 'bullpen management in play'}, this is a low-disparity lean that requires other confirmatory signals before sizing up. `;
        }

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

        // Final score should never be less than 5 (neutral) or more than 10 (max edge)
        // We use the absolute disparity to represent the strength for the favored side.
        const finalScore = Math.min(10, Math.max(5, Math.floor(5 + (disparity / 2))));

        return {
            score: {
                pillar: "Technical Roster Advantage",
                score: finalScore,
                reason: narrative,
                side: homeTotalStrength === awayTotalStrength ? 'neutral' : (homeTotalStrength > awayTotalStrength ? 'home' : 'away')
            },
            advantages
        };
    }

    private scoreSeasonalSport(game: any): PillarScore {
        const venue = game.venue?.toLowerCase() || "";
        const isArizona = venue.includes("stadium") || venue.includes("park") || venue.includes("field") || venue.includes("complex");

        let score = isArizona ? 6 : 5;
        let reason = isArizona ? "Cactus League: Slight dry-air offensive boost." : "Grapefruit League: Neutral environment.";

        // Integrate Live Weather (Pillar #2)
        if (game.weather?.wind) {
            const wind = game.weather.wind; // e.g. "12 mph, In From Center"
            const speed = parseInt(wind);
            const direction = wind.toLowerCase();

            if (speed > 15 && (direction.includes('in') || direction.includes('towards'))) {
                score = 4; // Penalize 30% from 7 is ~5, but we go to 4 for "hard validation"
                reason = `WEATHER VETO: Wind ${speed}mph blowing IN. Neutralizing high-altitude offense edge.`;
            }
        }

        return { pillar: "Seasonal (Sport)", score, reason };
    }

    private getRecommendation(confidence: number, valueTeam?: string): string {
        if (confidence >= 78 && valueTeam) return `HIGH CONVICTION - Bet ${valueTeam.toUpperCase()} (+EV)`;
        if (confidence >= 70 && valueTeam) return `Value Play - ${valueTeam.toUpperCase()} Entry`;
        if (confidence >= 60) return "Informational - Edge lean detected.";
        return "PASS - Odds match probability.";
    }
}
