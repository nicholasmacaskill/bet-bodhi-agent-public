
import { MLBApi } from './src/lib/mlb-api';

async function main() {
    const api = new MLBApi();
    const date = '2026-03-18';
    console.log(`Fetching MLB schedule for ${date}...`);
    const games = await api.getSchedule(date);
    
    const kcTexasGame = games.find(g => 
        (g.homeTeam.includes('Royals') || g.awayTeam.includes('Royals')) &&
        (g.homeTeam.includes('Rangers') || g.awayTeam.includes('Rangers'))
    );

    if (kcTexasGame) {
        console.log("Matchup Found!");
        console.log("GamePk:", kcTexasGame.gamePk);
        console.log("Away Team:", kcTexasGame.awayTeam);
        console.log("Home Team:", kcTexasGame.homeTeam);
        console.log("Status:", kcTexasGame.status);
        console.log("Date:", kcTexasGame.date);
        console.log("Probable Pitchers:", kcTexasGame.probables);
        
        // Fetch detailed data
        const analysisData = await api.getHydratedAnalysisData(kcTexasGame);
        console.log("--- DETAILS ---");
        console.log("Weather:", analysisData.details?.weather);
        console.log("Lineups:", JSON.stringify(analysisData.details?.lineups, null, 2));
        console.log("Home Hot Bats:", analysisData.homeHot);
        console.log("Away Hot Bats:", analysisData.awayHot);
    } else {
        console.log("No KC vs Texas game found for this date.");
        console.log("Available games:");
        games.forEach(g => console.log(`${g.awayTeam} @ ${g.homeTeam}`));
    }
}

main();
