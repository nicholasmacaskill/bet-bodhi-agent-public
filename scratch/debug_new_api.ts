import { MLBApi } from '../src/lib/mlb-api';

async function main() {
    // 1. Test Handedness Splits
    const mlb = new MLBApi();
    const id = await mlb.searchPerson('Nathan Eovaldi');
    if (id) {
        console.log('Testing Splits for Eovaldi:', id);
        // Using sitCodes=vl,vr
        const url = `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=statSplits&group=pitching&season=2025&gameType=R&sitCodes=vl,vr`;
        const res = await fetch(url);
        const data = await res.json();
        console.log('Splits sitCodes length:', data.stats?.[0]?.splits?.length);
        if (data.stats?.[0]?.splits?.length > 0) {
            console.log('Sample split:', data.stats[0].splits[0].split, data.stats[0].splits[0].stat.era);
        }
    }

    // 2. Test Yesterday's Schedule / Boxscore
    console.log('Testing Yesterday Schedule');
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const games = await mlb.getSchedule(yesterday);
    if (games.length > 0) {
        const gamePk = games[0].gamePk;
        console.log('Found game:', gamePk, games[0].awayTeam, '@', games[0].homeTeam);
        const feedUrl = `https://statsapi.mlb.com/api/v1/game/${gamePk}/feed/live`;
        const feedRes = await fetch(feedUrl);
        const feedData = await feedRes.json();
        const homePitchers = feedData.liveData?.boxscore?.teams?.home?.pitchers || [];
        console.log('Home pitchers count:', homePitchers.length);
        if (homePitchers.length > 1) {
            // first is usually starter
            const relievers = homePitchers.slice(1);
            let totalReliefPitches = 0;
            for (const pId of relievers) {
                const playerStats = feedData.liveData.boxscore.teams.home.players[`ID${pId}`]?.stats?.pitching;
                if (playerStats) {
                    totalReliefPitches += playerStats.numberOfPitches || 0;
                }
            }
            console.log('Total relief pitches:', totalReliefPitches);
        }
    }
}
main();
