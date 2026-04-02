
import { MLBApi } from './src/lib/mlb-api';
import * as fs from 'fs';

async function fetch2025PlayerStats() {
    const mlb = new MLBApi();
    const season = '2025';
    
    console.log(`Fetching 2025 Player Stats (${season})...`);
    
    // Fetch all pitchers
    const pitcherUrl = `https://statsapi.mlb.com/api/v1/stats?stats=season&group=pitching&season=${season}&sportId=1&limit=2000`;
    const pRes = await fetch(pitcherUrl);
    const pData = await pRes.json();
    const pitchers = (pData.stats[0]?.splits || []).map((s: any) => ({
        id: s.player.id,
        name: s.player.fullName,
        teamId: s.team.id,
        era: parseFloat(s.stat.era),
        whip: parseFloat(s.stat.whip),
        k9: parseFloat(s.stat.strikeOuts) / (parseFloat(s.stat.inningsPitched) / 9)
    }));
    
    // Fetch all hitters
    const hitterUrl = `https://statsapi.mlb.com/api/v1/stats?stats=season&group=hitting&season=${season}&sportId=1&limit=2000`;
    const hRes = await fetch(hitterUrl);
    const hData = await hRes.json();
    const hitters = (hData.stats?.[0]?.splits || []).map((s: any) => ({
        id: s.player.id,
        name: s.player.fullName,
        teamId: s.team.id,
        ops: parseFloat(s.stat.ops),
        hr: parseInt(s.stat.homeRuns)
    }));

    // Fetch team pitching (Bullpen)
    const teamUrl = `https://statsapi.mlb.com/api/v1/teams/stats?group=pitching&stats=season&season=${season}&sportId=1`;
    const tRes = await fetch(teamUrl);
    const tData = await tRes.json();
    const teams = (tData.stats[0]?.splits || []).map((s: any) => ({
        id: s.team.id,
        name: s.team.name,
        era: parseFloat(s.stat.era),
        whip: parseFloat(s.stat.whip)
    }));

    if (!fs.existsSync('data')) fs.mkdirSync('data');
    fs.writeFileSync('data/2025_pitchers.json', JSON.stringify(pitchers, null, 2));
    fs.writeFileSync('data/2025_hitters.json', JSON.stringify(hitters, null, 2));
    fs.writeFileSync('data/2025_teams.json', JSON.stringify(teams, null, 2));
    
    console.log(`Saved stats for ${pitchers.length} pitchers, ${hitters.length} hitters, and ${teams.length} teams.`);
}

fetch2025PlayerStats();
