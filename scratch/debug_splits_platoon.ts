import { MLBApi } from '../src/lib/mlb-api';

async function main() {
    const response = await fetch('https://statsapi.mlb.com/api/v1/people/592450/stats?stats=platoon&group=hitting&season=2025&gameType=R');
    const data = await response.json();
    console.log('Platoon:', JSON.stringify(data, null, 2));
}

main();
