
import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';
import { OddsApi } from '../../src/lib/odds-api';
import * as dotenv from 'dotenv';
dotenv.config();

const ELITE_BATS = [
    "Shohei Ohtani", "Aaron Judge", "Ronald Acuna Jr.", "Mookie Betts", "Freddie Freeman",
    "Juan Soto", "Corey Seager", "Yordan Alvarez", "Matt Olson", "Kyle Tucker",
    "Mike Trout", "Bobby Witt Jr.", "Julio Rodriguez", "Bryce Harper", "Adley Rutschman",
    "Gunnar Henderson", "Corbin Carroll", "Francisco Lindor", "Trea Turner", "José Ramírez"
];

async function main() {
    const mlb = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const oddsApi = new OddsApi();
    const today = '2026-04-04';

    console.log(`\n──────────────────────────────────────────────────────────────────────`);
    console.log(`🛡️  BODHI-8 UNIFIED ALPHA SCAN: STRENGTH + VALUE — ${today}`);
    console.log(`──────────────────────────────────────────────────────────────────────\n`);

    try {
        const [games, marketOdds] = await Promise.all([
            mlb.getSchedule(today),
            oddsApi.getMLBOdds()
        ]);

        const results: any[] = [];
        for (const game of games) {
            if (game.status.includes('Final') || game.status.includes('Postponed')) continue;
            
            const hydrated = await mlb.getHydratedAnalysisData(game);
            
            // Match Market Odds
            const polyMatch = marketOdds.find((o: any) => 
                (o.home_team.includes(game.homeTeam) || game.homeTeam.includes(o.home_team)) &&
                (o.away_team.includes(game.awayTeam) || game.awayTeam.includes(o.away_team))
            );

            let polyMarketData = undefined;
            if (polyMatch) {
                const h2h = polyMatch.bookmakers[0]?.markets.find((m: any) => m.key === 'h2h');
                if (h2h) {
                    polyMarketData = {
                        conditionId: polyMatch.id,
                        outcomes: h2h.outcomes.map((oc: any) => oc.name),
                        outcomePrices: h2h.outcomes.map((oc: any) => (1 / oc.price).toFixed(3))
                    };
                }
            }

            // A. Market EV Analysis (The Value Consideration)
            const analysis = analyzer.analyzeGame(
                game,
                hydrated.details,
                polyMarketData,
                [...hydrated.homeHot, ...hydrated.awayHot],
                [],
                hydrated.playerStats,
                464,
                hydrated.rosters
            );

            // B. Mismatch Strength Analysis (The Structural Consideration)
            const getStrength = (pitcher: string, lineup: string[], hotBats: string[]) => {
                if (!pitcher) return 0;
                const eliteCount = lineup.filter(p => ELITE_BATS.some(eb => p.includes(eb))).length;
                const hotCount = hotBats.length;
                return (eliteCount * 4) + (hotCount * 2);
            };

            const awayStr = getStrength(detailsToPitcher(hydrated.details.probables?.home), hydrated.details.lineups?.away, hydrated.awayHot);
            const homeStr = getStrength(detailsToPitcher(hydrated.details.probables?.away), hydrated.details.lineups?.home, hydrated.homeHot);
            
            // "Unified Disparity" - how much better is the favored team at hitting vs pitching
            const techFavored = analysis.valueTeam;
            let structuralMismatch = 0;
            if (techFavored) {
                structuralMismatch = techFavored === game.homeTeam ? homeStr : awayStr;
            }

            // C. Unified Alpha Score Calculation
            // Alpha = (EV * 7.5) + (Confidence * 0.2) + (Mismatch * 0.05)
            // Weighting toward EV (Market Inefficiency) but rewarding high-mismatch structural games
            const evFactor = (analysis.polyEV || 0) * 10;
            const unifiedAlpha = evFactor + (analysis.overallConfidence / 10) + (structuralMismatch / 10);

            results.push({
                ...analysis,
                structuralMismatch,
                unifiedAlpha,
                hotBats: [...hydrated.homeHot, ...hydrated.awayHot]
            });
        }

        results.sort((a, b) => b.unifiedAlpha - a.unifiedAlpha);

        console.log(`\n=============================================================`);
        console.log(`        🎯 THE UNIFIED ALPHA (MISMATCH + VALUE)             `);
        console.log(`=============================================================`);

        results.slice(0, 5).forEach((r, i) => {
            const isGoldenZone = r.polyEV > 0.10 && r.structuralMismatch >= 6;
            const badge = isGoldenZone ? "🌟 [GOLDEN SNIPER]" : (r.unifiedAlpha >= 10 ? "🛡️ [SOVEREIGN ALPHA]" : "📈 [TECHNICAL LEAN]");

            console.log(`\n${i + 1}. ${badge}`);
            console.log(`   MATCHUP: ${r.awayTeam} @ ${r.homeTeam}`);
            console.log(`   TARGET:  ${(r.valueTeam || 'NEUTRAL').toUpperCase()} | Unified Alpha: ${r.unifiedAlpha.toFixed(2)}`);
            console.log(`   MARKET:  EV +${((r.polyEV || 0) * 100).toFixed(1)}% | Crowd: ${((r.polySharePrice || 0.5) * 100).toFixed(1)}%`);
            console.log(`   MISMATCH: Structural Strength Score ${r.structuralMismatch}`);
            console.log(`   ANALYSIS: ${r.recommendedAction}`);
            if (r.advantages && r.advantages.length > 0) {
                console.log(`   STRENGTHS:`);
                r.advantages.slice(0, 2).forEach((adv: string) => console.log(`    - ${adv}`));
            }
        });

        console.log(`\n=============================================================`);
    } catch (e) {
        console.error("FATAL CRASH:", e);
    }
}

function detailsToPitcher(p: any): string {
    if (!p) return "";
    if (typeof p === 'string') return p;
    return p.fullName || p.name || "";
}

main();
