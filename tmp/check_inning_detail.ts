import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-04-04&hydrate=team,linescore,seriesStatus`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.dates || data.dates.length === 0) {
        console.log('No games found.');
        return;
    }

    const games = data.dates[0].games;

    // Filter for games we care about
    const targets = ['Cincinnati', 'Seattle', 'Angels', 'Rangers'];
    
    for (const game of games) {
        const home = game.teams.home.team.name;
        const away = game.teams.away.team.name;
        const isTarget = targets.some(t => home.includes(t) || away.includes(t));
        if (!isTarget) continue;

        const status = game.status.detailedState;
        const inning = game.linescore?.currentInning;
        const inningHalf = game.linescore?.inningHalf;
        const awayScore = game.teams.away.score ?? '?';
        const homeScore = game.teams.home.score ?? '?';
        const seriesDesc = game.seriesDescription;
        const seriesGameNumber = game.seriesGameNumber;
        const gamesInSeries = game.gamesInSeries;

        console.log(`\n${away} @ ${home}`);
        console.log(`  Status: ${status}`);
        console.log(`  Score: ${away} ${awayScore} - ${home} ${homeScore}`);
        if (inning) console.log(`  Inning: ${inningHalf} of the ${inning}`);
        if (seriesDesc) console.log(`  Series: ${seriesDesc} — Game ${seriesGameNumber} of ${gamesInSeries}`);
    }
}

main();
