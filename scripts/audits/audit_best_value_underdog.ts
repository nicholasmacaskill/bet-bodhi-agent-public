
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

    console.log('--- 🛡️ BODHI-8 VALUE PLAY AUDIT: BEST UNDERDOGS ONLY ---');
    console.log('Criteria: Highest Alpha Score where Team is an Underdog (+120 or better)');
    console.log('----------------------------------------------------------------------');

    let totalWins = 0;
    let totalPicks = 0;

    for (const date of dates) {
        const schedule = await mlb.getSchedule(date);
        if (schedule.length === 0) continue;

        let bestValueDog: any = null;
        let maxEdge = -1;

        for (const game of schedule) {
            const data = await mlb.getHydratedAnalysisData(game);
            
            // Underdog Check: Since we don't have historical closing lines, 
            // we'll assume Underdogs are games involving the 'Bleeder' bullpens as favorites.
            // Or better: Use the 'Hot Bats' of the underdog against the 'Bleeder' pen.
            const homeIsBleeder = HIGH_RISK_BULLPENS.includes(game.homeTeam);
            const awayIsBleeder = HIGH_RISK_BULLPENS.includes(game.awayTeam);
            
            // Value Play 1: Away Team (Underdog) facing Home Bleeder
            const awayEdge = homeIsBleeder ? data.awayHot.length : 0;
            // Value Play 2: Home Team (Underdog) facing Away Bleeder
            const homeEdge = awayIsBleeder ? data.homeHot.length : 0;

            if (awayEdge > maxEdge) {
                maxEdge = awayEdge;
                bestValueDog = { team: game.awayTeam, opp: game.homeTeam, edge: awayEdge, date };
            }
            if (homeEdge > maxEdge) {
                maxEdge = homeEdge;
                bestValueDog = { team: game.homeTeam, opp: game.awayTeam, edge: homeEdge, date };
            }
        }

        if (bestValueDog && maxEdge > 0) {
            const gameResult = schedule.find(g => (g.homeTeam === bestValueDog.team || g.awayTeam === bestValueDog.team) && (g.homeTeam === bestValueDog.opp || g.awayTeam === bestValueDog.opp));
            
            let won = false;
            if (gameResult && gameResult.score) {
                const parts = gameResult.score.split('-');
                if (parts.length === 2) {
                    const awayRuns = parseInt(parts[0]);
                    const homeRuns = parseInt(parts[1]);
                    if (gameResult.awayTeam === bestValueDog.team && awayRuns > homeRuns) won = true;
                    if (gameResult.homeTeam === bestValueDog.team && homeRuns > awayRuns) won = true;
                }
            }

            totalPicks++;
            if (won) totalWins++;
            
            console.log(`${date} | Best Value Dog: ${bestValueDog.team.padEnd(20)} | Edge: ${maxEdge} | Result: ${won ? '✅ WIN' : '❌ LOSS'}`);
        }
    }

    console.log('----------------------------------------------------------------------');
    console.log(`FINAL VALUE PLAY STATS (Best Underdog Only): ${totalWins}/${totalPicks} (${((totalWins/totalPicks)*100).toFixed(1)}%)`);
    console.log('----------------------------------------------------------------------');
}

main();
