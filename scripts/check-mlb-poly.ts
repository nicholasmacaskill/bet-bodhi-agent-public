import { PolymarketApi } from '../src/lib/polymarket-api';
import { MLBApi } from '../src/lib/mlb-api';

async function main() {
    const polySvc = new PolymarketApi();
    const mlbApi = new MLBApi();

    console.log("Fetching Polymarket conditions...");
    const polyMarkets = await polySvc.getActiveSportsMarkets("vs.");

    console.log("Fetching MLB games for 2026-03-08...");
    const mlbGames = await mlbApi.getSchedule('2026-03-08');

    console.log("\nMLB Games:");
    for (const game of mlbGames) {
        console.log(`- ${game.awayTeam} @ ${game.homeTeam}`);
        const homeMascot = game.homeTeam.split(' ').pop()?.toLowerCase() || "";
        const awayMascot = game.awayTeam.split(' ').pop()?.toLowerCase() || "";

        const condition = polyMarkets.find(m =>
            (m.question.toLowerCase().includes(homeMascot) || m.description.toLowerCase().includes(homeMascot)) &&
            (m.question.toLowerCase().includes(awayMascot) || m.description.toLowerCase().includes(awayMascot))
        );

        if (condition) {
            console.log(`  => Found condition: ${condition.question}`);
        } else {
            console.log(`  => No condition found for ${awayMascot} @ ${homeMascot}`);
        }
    }

    // See if ANY polymarket condition mentions "baseball" or "mlb"
    console.log("\nPolymarket Conditions containing 'baseball' or 'mlb':");
    const mlbConditions = polyMarkets.filter(m => m.question.toLowerCase().includes('baseball') || m.question.toLowerCase().includes('mlb'));
    for (const m of mlbConditions) {
        console.log(`- ${m.question}`);
    }

    // Print first 10 polymarket conditions to see format
    console.log("\nSample Polymarket Matchups:");
    polyMarkets.slice(0, 10).forEach(m => console.log(m.question));
}

main().catch(console.error);
