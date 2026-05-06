
import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';
import { OddsApi } from '../../src/lib/odds-api';
import * as dotenv from 'dotenv';
dotenv.config();

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
        if (game.status.includes('Final') || game.status.includes('Postponed')) continue;
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
        results.push(analysis);
    }

    results.sort((a, b) => b.overallConfidence - a.overallConfidence);

    // Print full breakdown for top 3
    results.slice(0, 3).forEach((r, i) => {
        console.log(`\n=============================================================`);
        console.log(`🎯 FULL ANALYSIS: ${r.awayTeam} @ ${r.homeTeam}`);
        console.log(`=============================================================`);
        console.log(`CONVICTION: ${r.overallConfidence}% | TARGET: ${r.valueTeam?.toUpperCase()}`);
        console.log(`RECOMMENDATION: ${r.recommendedAction}`);
        console.log(`UNIT SIZE: ${r.recommendedSize} ($${r.suggestedStake.toFixed(2)})`);
        
        console.log(`\n🏛️  THE SEVEN PILLARS:`);
        r.pillars.forEach((p: any) => {
            console.log(`- ${p.pillar.padEnd(25)}: ${p.score}/10 | ${p.reason}`);
        });

        console.log(`\n🔥 STRATEGIC ADVANTAGES:`);
        r.advantages.forEach((adv: string) => console.log(`- ${adv}`));

        console.log(`\n⚠️  KILL CRITERIA (ABORT IF):`);
        r.killCriteria.forEach((kill: string) => console.log(`- ${kill}`));
        
        if (r.polyEV) {
            console.log(`\n📈 MARKET METRICS:`);
            console.log(`- Implied Bodhi Prob: ${(r.overallConfidence).toFixed(1)}%`);
            console.log(`- Market Share Price: ${(r.polySharePrice * 100).toFixed(1)}%`);
            console.log(`- Expected Value (EV): +${(r.polyEV * 100).toFixed(1)}%`);
        }
        console.log(`=============================================================`);
    });
}

main();
