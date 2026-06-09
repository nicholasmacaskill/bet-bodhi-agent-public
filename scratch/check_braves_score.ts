import { MLBApi } from '../src/lib/mlb-api';

async function checkLiveScore() {
    const mlb = new MLBApi();
    const games = await mlb.getSchedule('2026-06-07');
    const bravesGame = games.find((g: any) => g.homeTeam.includes('Braves') || g.awayTeam.includes('Braves'));
    if (bravesGame) {
        console.log(`Status: ${bravesGame.status}`);
        console.log(`Score: ${bravesGame.awayTeam} ${bravesGame.score.split('-')[0]} - ${bravesGame.homeTeam} ${bravesGame.score.split('-')[1]}`);
    } else {
        console.log('Braves game not found');
    }
}

checkLiveScore().catch(console.error);
