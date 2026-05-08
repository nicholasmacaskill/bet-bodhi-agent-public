import { MLBApi } from '../src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const id = await mlb.searchPerson('Nathan Eovaldi');
    const url = `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=statSplits&group=pitching&season=2025&gameType=R&sitCodes=vl,vr`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(Object.keys(data.stats[0].splits[0].stat));
    
    // Pick a date that definitely had games
    const games = await mlb.getSchedule("2026-04-10");
    if (games.length > 0) {
        const gamePk = games[0].gamePk;
        const feedUrl = `https://statsapi.mlb.com/api/v1/game/${gamePk}/feed/live`;
        const feedRes = await fetch(feedUrl);
        const feedData = await feedRes.json();
        const homePitchers = feedData.liveData?.boxscore?.teams?.home?.pitchers || [];
        console.log('Pitchers count:', homePitchers.length);
        if (homePitchers.length > 1) {
            let total = 0;
            for (const pId of homePitchers.slice(1)) {
                total += feedData.liveData.boxscore.teams.home.players[`ID${pId}`]?.stats?.pitching?.numberOfPitches || 0;
            }
            console.log('Relief pitches:', total);
        }
    }
}
main();
