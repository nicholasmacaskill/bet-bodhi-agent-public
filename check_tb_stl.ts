import { MLBApi } from './src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-28';

    try {
        const games = await mlb.getSchedule(today);
        const game = games.find(g => (g.awayTeam.includes('Rays') || g.homeTeam.includes('Rays')) && (g.awayTeam.includes('Cardinals') || g.homeTeam.includes('Cardinals')));
        
        if (game) {
            console.log(`\nMATCHUP: ${game.awayTeam} @ ${game.homeTeam}`);
            console.log(`DATE: ${game.date}`);
            console.log(`STATUS: ${game.status}`);
            console.log(`PITCHERS: ${game.probables?.away || 'TBD'} vs ${game.probables?.home || 'TBD'}`);
            
            if (game.probables?.away && game.probables?.home) {
                 // Potentially call Bodhi logic to analyze 
            }
        } else {
            console.log(`No TB vs STL game found for ${today}. Checking ALL games...`);
            games.forEach((g, i) => {
                console.log(`${i+1}. ${g.awayTeam} @ ${g.homeTeam} (${g.status})`);
            });
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
