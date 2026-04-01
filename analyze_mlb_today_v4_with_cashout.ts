
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
    console.log(`🔍 MLB ANALYSIS v4 (WITH CASHOUT ADVISORY) — ${today}`);
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

            const homeLineup = details.lineups?.home || [];
            const awayLineup = details.lineups?.away || [];
            const homePitcher = details.probables?.home;
            const awayPitcher = details.probables?.away;

            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`⚾ ${game.awayTeam} @ ${game.homeTeam}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            
            // Bullpen Risk Check
            const homeBullpenRisk = HIGH_RISK_BULLPENS.includes(game.homeTeam);
            const awayBullpenRisk = HIGH_RISK_BULLPENS.includes(game.awayTeam);
            const homeEliteBatsCount = homeLineup.filter((p: string) => ELITE_BATS.includes(p)).length;
            const awayEliteBatsCount = awayLineup.filter((p: string) => ELITE_BATS.includes(p)).length;

            // CASHOUT ADVISORY LOGIC
            const generateAdvisory = (teamName: string, isRisk: boolean, oppEliteCount: number, oppHotCount: number) => {
                if (isRisk && (oppEliteCount > 0 || oppHotCount > 2)) {
                    return `⚠️ [CASHOUT ADVISORY] High vulnerability in later innings. ${teamName} has a bottom-tier bullpen facing ${oppEliteCount} elite bats. If leading by 2+ after the 7th, CONSIDER EXITING.`;
                }
                return `🟢 [STABILITY] ${teamName} bullpen is statistically average/elite. Leads are generally safe.`;
            };

            console.log(`\n🏠 ${game.homeTeam.toUpperCase()}`);
            console.log(generateAdvisory(game.homeTeam, homeBullpenRisk, awayEliteBatsCount, awayHot.length));
            
            console.log(`\n✈️ ${game.awayTeam.toUpperCase()}`);
            console.log(generateAdvisory(game.awayTeam, awayBullpenRisk, homeEliteBatsCount, homeHot.length));
            
            console.log("");
        }

    } catch (error) {
        console.error("Error running detailed analysis:", error);
    }
}

main();
