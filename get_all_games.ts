
import { MLBApi } from './src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-06';

    try {
        const games = await mlb.getSchedule(today);
        // Sort games by date (time)
        const sortedGames = games.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        console.log(`Total games on ${today}: ${sortedGames.length}`);
        sortedGames.forEach((game, i) => {
            console.log(`${i + 1}. ${game.awayTeam} @ ${game.homeTeam} (${game.date}) - Probables: ${game.probables?.away || 'TBD'} vs ${game.probables?.home || 'TBD'}`);
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
