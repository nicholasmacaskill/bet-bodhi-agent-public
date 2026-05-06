
import { MLBApi } from '../../src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-06';
    console.log(`Fetching games for ${today}...`);

    try {
        const games = await mlb.getSchedule(today);
        console.log(`Found ${games.length} games.`);

        // Sort games by date (time)
        const sortedGames = games.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const firstThree = sortedGames.slice(0, 3);

        console.log("\nFirst 3 Games:");
        for (const game of firstThree) {
            console.log(`- ${game.awayTeam} @ ${game.homeTeam} (${game.date})`);
            console.log(`  Probables: Away: ${game.probables?.away || 'TBD'}, Home: ${game.probables?.home || 'TBD'}`);
        }

        // Try 'earnedRuns' or 'losses' or 'baseOnBalls' as indicators of weakness
        const categories = ['earnedRuns', 'losses', 'baseOnBalls', 'earnedRunAverage'];
        for (const cat of categories) {
            const leaders = await mlb.getLeaders(cat, 'pitching');
            if (leaders.length > 0) {
                console.log(`\nStatistical Leaders for ${cat}: ${leaders.join(', ')}`);
            }
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
