import { MLBApi } from '../../src/lib/mlb-api';

async function checkPitchers() {
    const mlb = new MLBApi();
    const date = '2026-03-27';
    
    console.log(`Checking stats for Colorado vs Miami on ${date}...`);
    
    const hId = await mlb.searchPerson("Sandy Alcantara");
    const aId = await mlb.searchPerson("Kyle Freeland");
    
    if (hId) {
        const stats = await mlb.getPlayerStats(hId, 'pitching', '2026');
        console.log(`Sandy Alcantara (MIA) 2026 Stats:`, stats);
    } else {
        console.log("Could not find ID for Sandy Alcantara");
    }
    
    if (aId) {
        const stats = await mlb.getPlayerStats(aId, 'pitching', '2026');
        console.log(`Kyle Freeland (COL) 2026 Stats:`, stats);
    } else {
        console.log("Could not find ID for Kyle Freeland");
    }
}

checkPitchers();
