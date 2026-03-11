import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';
import { logBet, MotivationTag } from '../src/lib/bet-logger';
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query: string): Promise<string> => new Promise((resolve) => rl.question(query, resolve));

/**
 * CLI Tool to place bets from the terminal.
 * Usage: npx tsx scripts/place-bet.ts --market poly --id <conditionId> --outcome <0/1> --amount <USD> --price <price>
 */
async function main() {
    const args = process.argv.slice(2);
    const params: any = {};

    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        params[key] = args[i + 1];
    }

    const { market, id, outcome, amount, price, slippage, team, sport, startTime } = params;

    if (!market || !id || !outcome || !amount || !price) {
        console.log("\n❌ Missing parameters!");
        console.log("Usage: npx tsx scripts/place-bet.ts --market poly --id <id> --outcome <index> --amount <usd> --price <price> [--slippage <cents>] [--team <name>] [--sport <sport>] [--startTime <iso>]\n");
        rl.close();
        return;
    }

    const slippageVal = slippage ? parseFloat(slippage) : 0.05;

    console.log(`\n🏹 BODHI TERMINAL EXECUTION`);
    console.log(`------------------------------`);
    console.log(`Market:   ${market.toUpperCase()}`);
    console.log(`ID:       ${id}`);
    console.log(`Side:     Outcome ${outcome}`);
    console.log(`Stake:    $${amount}`);
    console.log(`Price:    ${price}`);
    console.log(`Slippage: ${slippageVal}\n`);

    // Psychometric Collection
    console.log("🧠 BODHI PSYCHOMETRIC CAPTURE");
    const motivation = await question("   Motivation (bodhi_signal/analysis/gut_feel/chase_win/fade_public/line_value) [gut_feel]: ") || "gut_feel";
    const emotional = await question("   Emotional Pulse (1-10: How 'pumped' are you?) [5]: ") || "5";
    const physiological = await question("   Physiological Score (1-10: How sharp/rested?) [5]: ") || "5";
    const research = await question("   Quick Research Note (Optional): ");

    rl.close();

    try {
        let success = false;
        if (market === 'poly') {
            const api = new PolymarketApi();
            const result = await api.placeOrder(id, parseInt(outcome), parseFloat(amount), parseFloat(price), slippageVal);
            success = result.success;
        } else {
            console.error("❌ Unknown market type.");
        }

        if (success) {
            console.log("\n📝 LOGGING TO SUPABASE...");
            await logBet({
                team: team || "Unknown Team",
                sport: sport || "Unknown Sport",
                odds: 1 / parseFloat(price),
                amount: parseFloat(amount),
                gameStartTime: startTime ? new Date(startTime) : new Date(Date.now() + 3600000), // Default to 1hr from now if missing
                motivationTag: motivation as MotivationTag,
                emotionalPulse: parseInt(emotional),
                physiologicalScore: parseInt(physiological),
                researchLog: research,
                pillarFocus: 'cli_execution'
            });
        }

    } catch (error: any) {
        console.error(`\n❌ Execution Error: ${error.message}`);
    }
}

main().catch(console.error);
