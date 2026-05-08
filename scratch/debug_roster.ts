import { MLBApi } from '../src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const games = await mlb.getSchedule(new Date().toISOString().split('T')[0]);
    if (games.length > 0) {
        const gamePk = games[0].gamePk;
        const feedUrl = `https://statsapi.mlb.com/api/v1/game/${gamePk}/feed/live`;
        const res = await fetch(feedUrl);
        const data = await res.json();
        const awayLineup = data.liveData?.boxscore?.teams?.away?.batters || [];
        const awayPlayers = data.liveData?.boxscore?.teams?.away?.players || {};
        let lefties = 0;
        let righties = 0;
        for (const id of awayLineup) {
            const player = awayPlayers[`ID${id}`];
            if (player) {
                const batSide = player.person?.batSide?.code;
                console.log(player.person.fullName, batSide);
                if (batSide === 'L') lefties++;
                if (batSide === 'R') righties++;
                if (batSide === 'S') { lefties++; righties++; } // switch hitters count for both
            }
        }
        console.log(`Lefties: ${lefties}, Righties: ${righties}`);
    }
}
main();
