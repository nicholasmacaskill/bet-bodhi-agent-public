
import { MLBApi } from '../src/lib/mlb-api';

async function test() {
    const mlb = new MLBApi();
    const name = 'Ranger Suarez';
    const id = await mlb.searchPerson(name);
    console.log(`ID for ${name}: ${id}`);
    if (id) {
        const lastYear = (new Date().getFullYear() - 1).toString();
        const currentYear = new Date().getFullYear().toString();
        const reg = await mlb.getPlayerStats(id, 'pitching', lastYear, 'R');
        const spr = await mlb.getPlayerStats(id, 'pitching', currentYear, 'S');
        console.log('Regular:', reg);
        console.log('Spring:', spr);
    }
}

test();
