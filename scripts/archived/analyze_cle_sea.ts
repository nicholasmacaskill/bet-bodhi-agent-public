import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';

async function main() {
    const mlb = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const today = '2026-03-29';

    try {
        const games = await mlb.getSchedule(today);
        const game = games.find(g => (g.awayTeam.includes('Guardians') && g.homeTeam.includes('Mariners')));

        if (!game) {
            console.log("No Guardians vs Mariners game found today.");
            return;
        }

        // Output current line score
        const games_url = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-03-29&hydrate=linescore';
        const response = await fetch(games_url);
        const data = await response.json();
        
        let inning = 'Pre-Game';
        let score = '';
        if (data.dates?.[0]?.games) {
            const lsGame = data.dates[0].games.find((g:any) => g.gamePk === game.gamePk);
            if (lsGame && lsGame.linescore) {
                 const ls = lsGame.linescore;
                 score = `${lsGame.teams.away.team.name} ${ls.teams.away.runs || 0} - ${lsGame.teams.home.team.name} ${ls.teams.home.runs || 0}`;
                 inning = `Inning: ${ls.currentInning} (${ls.inningHalf})`;
            } else if (lsGame) {
                 score = `${lsGame.teams.away.team.name} 0 - ${lsGame.teams.home.team.name} 0`;
                 inning = lsGame.status.detailedState;
            }
        }

        console.log(`\n--- LIVE STATUS ---`);
        console.log(`${score} | ${inning}`);
        console.log(`Pitchers: ${game.probables?.away} vs ${game.probables?.home}\n`);

        const hydrated = await mlb.getHydratedAnalysisData(game);
        
        const analysis = analyzer.analyzeGame(
            game,
            hydrated.details,
            undefined, // no polymarket
            [...hydrated.homeHot, ...hydrated.awayHot],
            [],
            undefined,
            464, // bankroll
            "Ready",
            8,
            hydrated.rosters
        );

        console.log(JSON.stringify(analysis, null, 2));

    } catch (e) {
        console.error(e);
    }
}

main();
