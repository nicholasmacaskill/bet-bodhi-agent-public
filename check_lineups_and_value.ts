
import { MLBApi } from './src/lib/mlb-api';

const ELITE_BATS = [
    "Shohei Ohtani", "Aaron Judge", "Ronald Acuna Jr.", "Mookie Betts", "Freddie Freeman",
    "Juan Soto", "Corey Seager", "Yordan Alvarez", "Matt Olson", "Kyle Tucker",
    "Mike Trout", "Bobby Witt Jr.", "Julio Rodriguez", "Bryce Harper", "Adley Rutschman",
    "Gunnar Henderson", "Corbin Carroll", "Francisco Lindor", "Trea Turner", "Jose Ramirez"
];

async function main() {
    const api = new MLBApi();
    const gamePk = 824704;

    try {
        const details = await api.getGameDetails(gamePk);
        const homeLineup = details?.lineups?.home || [];
        const awayLineup = details?.lineups?.away || [];
        
        console.log(`--- LATEST LINEUPS FOR GAME ${gamePk} ---`);
        console.log(`\nAway (Nationals) Lineup (${awayLineup.length} players):`);
        awayLineup.forEach((p: string, i: number) => console.log(`  ${i+1}. ${p}${ELITE_BATS.includes(p) ? ' (ELITE)' : ''}`));
        
        console.log(`\nHome (Cubs) Lineup (${homeLineup.length} players):`);
        homeLineup.forEach((p: string, i: number) => console.log(`  ${i+1}. ${p}${ELITE_BATS.includes(p) ? ' (ELITE)' : ''}`));

        console.log(`\nProbables: Away: ${details?.probables?.away}, Home: ${details?.probables?.home}`);
        
        const eliteInAway = awayLineup.filter((p: string) => ELITE_BATS.includes(p));
        const eliteInHome = homeLineup.filter((p: string) => ELITE_BATS.includes(p));
        
        console.log(`\nElite Bats Profile: Nationals ${eliteInAway.length} | Cubs ${eliteInHome.length}`);

    } catch (e: any) {
        console.error("Failed to check lineups:", e.message);
    }
}

main();
