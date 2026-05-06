
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

    const [games, marketOdds] = await Promise.all([
        mlb.getSchedule(today),
        oddsApi.getMLBOdds()
    ]);

    const results: any[] = [];
    for (const game of games) {
        const hydrated = await mlb.getHydratedAnalysisData(game);
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

        const analysis = analyzer.analyzeGame(game, hydrated.details, polyMarketData, [...hydrated.homeHot, ...hydrated.awayHot], [], hydrated.playerStats, 464, hydrated.rosters);
        
        const getStrength = (pitcher: string, lineup: string[], hotBats: string[]) => {
            if (!pitcher) return 0;
            const eliteCount = lineup.filter(p => ELITE_BATS.some(eb => p.includes(eb))).length;
            const hotCount = hotBats.length;
            return (eliteCount * 4) + (hotCount * 2);
        };
        const techFavored = analysis.valueTeam;
        let structuralMismatch = 0;
        if (techFavored) structuralMismatch = techFavored === game.homeTeam ? getStrength(detailsToPitcher(hydrated.details.probables?.away), hydrated.details.lineups?.home, hydrated.homeHot) : getStrength(detailsToPitcher(hydrated.details.probables?.home), hydrated.details.lineups?.away, hydrated.awayHot);

        const unifiedAlpha = ((analysis.polyEV || 0) * 10) + (analysis.overallConfidence / 10) + (structuralMismatch / 10);
        
        results.push({
            time: game.date,
            matchup: `${game.awayTeam} @ ${game.homeTeam}`,
            alpha: unifiedAlpha,
            target: analysis.valueTeam || 'NEUTRAL',
            ev: analysis.polyEV || 0
        });
    }

    results.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    console.log(`\nTIME (UTC)          | MATCHUP                              | ALPHA | TARGET`);
    console.log(`--------------------------------------------------------------------------------`);
    results.forEach(r => {
        const time = new Date(r.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        console.log(`${time.padEnd(19)} | ${r.matchup.padEnd(36)} | ${r.alpha.toFixed(2).padEnd(5)} | ${r.target}`);
    });
}

function detailsToPitcher(p: any): string {
    if (!p) return "";
    if (typeof p === 'string') return p;
    return p.fullName || p.name || "";
}

main();
