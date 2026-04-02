
import { MLBApi } from './src/lib/mlb-api';

const ELITE_BATS = [
    "Shohei Ohtani", "Aaron Judge", "Ronald Acuña Jr.", "Mookie Betts", "Freddie Freeman",
    "Juan Soto", "Corey Seager", "Yordan Alvarez", "Matt Olson", "Kyle Tucker",
    "Mike Trout", "Bobby Witt Jr.", "Julio Rodríguez", "Bryce Harper", "Adley Rutschman",
    "Gunnar Henderson", "Corbin Carroll", "Francisco Lindor", "Trea Turner", "José Ramírez",
    "Vladimir Guerrero Jr.", "Rafael Devers", "Austin Riley", "Ketel Marte"
];

const HIGH_RISK_BULLPENS = [
    "Colorado Rockies", "Miami Marlins", "Chicago White Sox", "Arizona Diamondbacks",
    "Oakland Athletics", "Texas Rangers", "Washington Nationals", "Toronto Blue Jays", 
    "Minnesota Twins", "Pittsburgh Pirates"
];

const ELITE_BULLPENS = [
    "Seattle Mariners", "Atlanta Braves", "Detroit Tigers", "Cleveland Guardians",
    "Milwaukee Brewers", "New York Yankees", "Houston Astros"
];

async function main() {
    const mlb = new MLBApi();
    const today = '2026-04-01'; 
    console.log(`\n──────────────────────────────────────────────────────────────────────`);
    console.log(`🔍 MLB ANALYSIS v5 (BODHI-8 HOLD LOGIC) — ${today}`);
    console.log(`──────────────────────────────────────────────────────────────────────\n`);

    try {
        const schedule = await mlb.getSchedule(today);
        if (schedule.length === 0) {
            console.log("No MLB games found for today.");
            return;
        }

        for (const game of schedule) {
            const data = await mlb.getHydratedAnalysisData(game);
            const { details, homeHot, awayHot } = data;

            // Log raw score for audit
            const scoreDisplay = game.score || "No score yet";

            const homeLineup = details.lineups?.home || [];
            const awayLineup = details.lineups?.away || [];
            
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`⚾ ${game.awayTeam} @ ${game.homeTeam} | STATUS: ${game.status}`);
            console.log(`📊 CURRENT SCORE: ${scoreDisplay}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            
            // Bullpen Risk Check
            const homeBullpenRisk = HIGH_RISK_BULLPENS.includes(game.homeTeam);
            const awayBullpenRisk = HIGH_RISK_BULLPENS.includes(game.awayTeam);
            const homeEliteBatsCount = homeLineup.filter((p: string) => ELITE_BATS.includes(p)).length;
            const awayEliteBatsCount = awayLineup.filter((p: string) => ELITE_BATS.includes(p)).length;

            // Parsing Score for Logic
            let awayRuns = 0;
            let homeRuns = 0;
            if (game.score && game.score.includes('-')) {
                const parts = game.score.split('-');
                awayRuns = parseInt(parts[0]);
                homeRuns = parseInt(parts[1]);
            } else if (game.score && game.score.includes('final')) {
                // Handle manual override strings like "4-0 (Final)"
                const match = game.score.match(/(\d+)-(\d+)/);
                if (match) {
                    awayRuns = parseInt(match[1]);
                    homeRuns = parseInt(match[2]);
                }
            }

            // HOLD vs CASHOUT LOGIC
            const generateAdvisory = (teamName: string, isRisk: boolean, oppEliteCount: number, oppHotCount: number, teamRuns: number, oppRuns: number) => {
                const isLeading = teamRuns > oppRuns;
                const scoreDiff = teamRuns - oppRuns;
                
                if (isLeading && scoreDiff >= 3) {
                     return `💎 [HOLD ADVISORY] ${teamName} has a 3+ run lead. This is statistically the "Safety Zone." Even with a weak bullpen, the probability of a 3-run blowout in 3 innings is < 8%. HOLD YOUR POSITION.`;
                }
                
                if (isRisk && (oppEliteCount > 0 || oppHotCount > 2)) {
                    return `⚠️ [CASHOUT ADVISORY] High vulnerability in later innings. ${teamName} has a bottom-tier bullpen facing ${oppEliteCount} elite bats. If leading by 2+ after the 7th, CONSIDER EXITING.`;
                }
                
                return `🟢 [STABILITY] ${teamName} bullpen is statistically average/elite or lead is narrow. Standard protocols apply.`;
            };

            console.log(`\n🏠 ${game.homeTeam.toUpperCase()}`);
            console.log(generateAdvisory(game.homeTeam, homeBullpenRisk, awayEliteBatsCount, awayHot.length, homeRuns, awayRuns));
            
            console.log(`\n✈️ ${game.awayTeam.toUpperCase()}`);
            console.log(generateAdvisory(game.awayTeam, awayBullpenRisk, homeEliteBatsCount, homeHot.length, awayRuns, homeRuns));
            
            console.log("");
        }

    } catch (error) {
        console.error("Error running detailed analysis:", error);
    }
}

main();
