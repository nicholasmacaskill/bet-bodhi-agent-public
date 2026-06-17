import { KBOApi } from '../src/lib/kbo-api';

async function main() {
    const api = new KBOApi();
    const games = await api.getSchedule('2026-06-05');
    console.log(`Found ${games.length} games on 2026-06-05:`);
    console.log(games);
    
    // Can we fetch box score data? KBOApi doesn't have a getBoxScore method.
    // The internal url was `https://www.koreabaseball.com/ws/GameCenter.asmx/GetGameCenterPreview`
    // What if we try `GetGameCenterBoxScore` or `GetGameCenterReview`?
}

main().catch(console.error);
