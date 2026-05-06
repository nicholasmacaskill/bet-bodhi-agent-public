
import { MLBApi } from '../../src/lib/mlb-api';

const HIGH_RISK_BULLPENS = [
    "Colorado Rockies", "Miami Marlins", "Chicago White Sox", "Arizona Diamondbacks",
    "Oakland Athletics", "Texas Rangers", "Washington Nationals", "Toronto Blue Jays"
];

async function main() {
    const mlb = new MLBApi();
    const dates = [];
    const today = new Date('2026-04-02');
    
    for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }

    console.log('--- 🛡️ BODHI-8 HISTORICAL AUDIT: BEST PICKS ONLY ---');
    console.log('Targeting: High-Risk Bullpen (Opponent) + Elite Bats (Pick)');
    console.log('----------------------------------------------------------');

    let totalWins = 0;
    let totalPicks = 0;

    for (const date of dates) {
        const schedule = await mlb.getSchedule(date);
        if (schedule.length === 0) continue;

        let bestPick: any = null;
        let maxAlpha = -1;

        for (const game of schedule) {
            const data = await mlb.getHydratedAnalysisData(game);
            
            // Heuristic for Alpha Score
            // (Home Bullpen Risk ? 1 : 0) * Away Hot Bats + (Away Bullpen Risk ? 1 : 0) * Home Hot Bats
            const homeRisk = HIGH_RISK_BULLPENS.includes(game.homeTeam);
            const awayRisk = HIGH_RISK_BULLPENS.includes(game.awayTeam);
            
            const awayAlpha = homeRisk ? data.awayHot.length : 0;
            const homeAlpha = awayRisk ? data.homeHot.length : 0;

            if (awayAlpha > maxAlpha) {
                maxAlpha = awayAlpha;
                bestPick = { team: game.awayTeam, opp: game.homeTeam, alpha: awayAlpha, date };
            }
            if (homeAlpha > maxAlpha) {
                maxAlpha = homeAlpha;
                bestPick = { team: game.homeTeam, opp: game.awayTeam, alpha: homeAlpha, date };
            }
        }

        if (bestPick && maxAlpha > 0) {
            // Check if they won (from schedule result)
            const gameResult = schedule.find(g => (g.homeTeam === bestPick.team || g.awayTeam === bestPick.team) && (g.homeTeam === bestPick.opp || g.awayTeam === bestPick.opp));
            
            let won = false;
            if (gameResult && gameResult.score) {
                const parts = gameResult.score.split('-');
                if (parts.length === 2) {
                    const awayRuns = parseInt(parts[0]);
                    const homeRuns = parseInt(parts[1]);
                    if (gameResult.awayTeam === bestPick.team && awayRuns > homeRuns) won = true;
                    if (gameResult.homeTeam === bestPick.team && homeRuns > awayRuns) won = true;
                }
            }

            totalPicks++;
            if (won) totalWins++;
            
            console.log(`${date} | Best Pick: ${bestPick.team.padEnd(20)} | Alpha: ${maxAlpha} | Result: ${won ? '✅ WIN' : '❌ LOSS'}`);
        }
    }

    console.log('----------------------------------------------------------');
    console.log(`FINAL STATS (Best Picks Only): ${totalWins}/${totalPicks} (${((totalWins/totalPicks)*100).toFixed(1)}%)`);
    console.log('----------------------------------------------------------');
}

main();
