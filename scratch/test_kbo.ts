
import { KBOApi } from '../src/lib/kbo-api';

async function test() {
    const kbo = new KBOApi();
    const games = await kbo.getSchedule('2026-05-17');
    console.log("Games:", games);
}

test();
