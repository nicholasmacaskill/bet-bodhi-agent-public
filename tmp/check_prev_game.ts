import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    // Game 2 of 3 is tonight (Apr 4), so Game 1 was Apr 3
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-04-03&hydrate=team,linescore`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.dates || data.dates.length === 0) {
        console.log('No games found.');
        return;
    }

    const games = data.dates[0].games;
    const targets = ['Seattle', 'Angels'];
    
    for (const game of games) {
        const home = game.teams.home.team.name;
        const away = game.teams.away.team.name;
        const isTarget = targets.some(t => home.includes(t) || away.includes(t));
        if (!isTarget) continue;

        const status = game.status.detailedState;
        const awayScore = game.teams.away.score ?? '?';
        const homeScore = game.teams.home.score ?? '?';

        console.log(`\n${away} @ ${home}`);
        console.log(`  Status: ${status}`);
        console.log(`  Final Score: ${away} ${awayScore} - ${home} ${homeScore}`);
        
        const awayWon = awayScore > homeScore;
        const winner = awayWon ? away : home;
        console.log(`  Winner: ${winner}`);
    }
}

main();
