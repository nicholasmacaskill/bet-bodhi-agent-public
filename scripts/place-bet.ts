import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';
import { SxBetApi } from '../src/lib/sx-bet-api';

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

    const { market, id, outcome, amount, price, slippage } = params;

    if (!market || !id || !outcome || !amount || !price) {
        console.log("\n❌ Missing parameters!");
        console.log("Usage: npx tsx scripts/place-bet.ts --market <poly/sx> --id <id> --outcome <index> --amount <usd> --price <price> [--slippage <cents>]\n");
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

    try {
        if (market === 'poly') {
            const api = new PolymarketApi();
            await api.placeOrder(id, parseInt(outcome), parseFloat(amount), parseFloat(price), slippageVal);
        } else if (market === 'sx') {
            const api = new SxBetApi();
            await api.placeOrder(id, outcome, parseFloat(amount), parseFloat(price));
        } else {
            console.error("❌ Unknown market type.");
        }
    } catch (error: any) {
        console.error(`\n❌ Execution Error: ${error.message}`);
    }
}

main().catch(console.error);
