
import { MLBApi } from '../../src/lib/mlb-api';

const ELITE_BATS = [
    "Shohei Ohtani", "Aaron Judge", "Ronald Acuña Jr.", "Mookie Betts", "Freddie Freeman",
    "Juan Soto", "Corey Seager", "Yordan Alvarez", "Matt Olson", "Kyle Tucker",
    "Mike Trout", "Bobby Witt Jr.", "Julio Rodríguez", "Bryce Harper", "Adley Rutschman",
    "Gunnar Henderson", "Corbin Carroll", "Francisco Lindor", "Trea Turner", "José Ramírez",
    "Vladimir Guerrero Jr.", "Rafael Devers", "Austin Riley", "Ketel Marte"
];

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-31';
    console.log(`\n──────────────────────────────────────────────────────────────────────`);
    console.log(`🔍 MLB DAILY ANALYSIS — ${today}`);
    console.log(`──────────────────────────────────────────────────────────────────────\n`);

    try {
        const games = await mlb.getSchedule(today);
        if (games.length === 0) {
            console.log("No MLB games found for today.");
            return;
        }

        console.log(`Analyzing ${games.length} games...\n`);

        for (const game of games) {
            const data = await mlb.getHydratedAnalysisData(game);
            const { details, rosters, homeHot, awayHot } = data;

            const homeLineup = details.lineups?.home || [];
            const awayLineup = details.lineups?.away || [];
            const homePitcher = details.probables?.home;
            const awayPitcher = details.probables?.away;

            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`⚾ ${game.awayTeam} @ ${game.homeTeam}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`Matchup: ${awayPitcher || 'TBD'} vs ${homePitcher || 'TBD'} | Venue: ${game.venue}`);
            
            // ANALYSIS: HOME TEAM (STRENGTHS & VULNERABILITIES)
            console.log(`\n🏠 ${game.homeTeam.toUpperCase()}`);
            const homeStrengths = [];
            const homeVulnerabilities = [];

            // Home Pitching
            if (homePitcher) {
                const id = await mlb.searchPerson(homePitcher);
                if (id) {
                    const stats = await mlb.getPlayerStats(id, 'pitching', '2024'); // Using 2024 for more reliable data
                    if (stats) {
                        const era = parseFloat(stats.era);
                        const whip = parseFloat(stats.whip);
                        if (era < 3.5 || whip < 1.2) homeStrengths.push(`Dominant Starter: ${homePitcher} (ERA: ${stats.era}, WHIP: ${stats.whip})`);
                        else if (era > 4.5 || whip > 1.4) homeVulnerabilities.push(`Starter Volatility: ${homePitcher} (ERA: ${stats.era}, WHIP: ${stats.whip})`);
                    }
                }
            } else {
                homeVulnerabilities.push("TBD Starting Pitcher");
            }

            // Home Offense
            const homeElite = homeLineup.filter((p: string) => ELITE_BATS.includes(p));
            if (homeElite.length > 0) homeStrengths.push(`Elite Presence: ${homeElite.join(', ')}`);
            if (homeHot.length > 0) homeStrengths.push(`Hot Bats: ${homeHot.join(', ')}`);
            if (homeLineup.length < 9) homeVulnerabilities.push("Incomplete Lineup / Depth concerns");

            console.log(`   ✅ STRENGTHS:`);
            if (homeStrengths.length > 0) homeStrengths.forEach(s => console.log(`      ├─ ${s}`));
            else console.log(`      ├─ No major technical strengths identified.`);
            
            console.log(`   🚨 VULNERABILITIES:`);
            if (homeVulnerabilities.length > 0) homeVulnerabilities.forEach(v => console.log(`      ├─ ${v}`));
            else console.log(`      ├─ No critical vulnerabilities flagged.`);

            // ANALYSIS: AWAY TEAM (STRENGTHS & VULNERABILITIES)
            console.log(`\n✈️ ${game.awayTeam.toUpperCase()}`);
            const awayStrengths = [];
            const awayVulnerabilities = [];

            // Away Pitching
            if (awayPitcher) {
                const id = await mlb.searchPerson(awayPitcher);
                if (id) {
                    const stats = await mlb.getPlayerStats(id, 'pitching', '2024');
                    if (stats) {
                        const era = parseFloat(stats.era);
                        const whip = parseFloat(stats.whip);
                        if (era < 3.5 || whip < 1.2) awayStrengths.push(`Dominant Starter: ${awayPitcher} (ERA: ${stats.era}, WHIP: ${stats.whip})`);
                        else if (era > 4.5 || whip > 1.4) awayVulnerabilities.push(`Starter Volatility: ${awayPitcher} (ERA: ${stats.era}, WHIP: ${stats.whip})`);
                    }
                }
            } else {
                awayVulnerabilities.push("TBD Starting Pitcher");
            }

            // Away Offense
            const awayElite = awayLineup.filter((p: string) => ELITE_BATS.includes(p));
            if (awayElite.length > 0) awayStrengths.push(`Elite Presence: ${awayElite.join(', ')}`);
            if (awayHot.length > 0) awayStrengths.push(`Hot Bats: ${awayHot.join(', ')}`);
            if (awayLineup.length < 9) awayVulnerabilities.push("Incomplete Lineup / Depth concerns");

            console.log(`   ✅ STRENGTHS:`);
            if (awayStrengths.length > 0) awayStrengths.forEach(s => console.log(`      ├─ ${s}`));
            else console.log(`      ├─ No major technical strengths identified.`);

            console.log(`   🚨 VULNERABILITIES:`);
            if (awayVulnerabilities.length > 0) awayVulnerabilities.forEach(v => console.log(`      ├─ ${v}`));
            else console.log(`      ├─ No critical vulnerabilities flagged.`);
            
            console.log("");
        }

    } catch (error) {
        console.error("Error running detailed analysis:", error);
    }
}

main();
