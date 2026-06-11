import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function fetchMarketByConditionId(conditionId: string) {
    try {
        const url = `https://gamma-api.polymarket.com/markets?condition_id=${conditionId}`;
        const res = await fetch(url);
        const data = await res.json();
        return data && data.length > 0 ? data[0] : null;
    } catch (e) {
        return null;
    }
}

async function calculateLivePnL() {
    console.log("====================================================");
    console.log("   BODHI ON-CHAIN POLYMARKET PNL CALCULATOR         ");
    console.log("====================================================");

    const poly = new PolymarketApi();
    
    const usdcBalance = await poly.getUSDCBalance();
    console.log(`Live USDC Balance: $${usdcBalance.toFixed(2)}`);
    console.log("Fetching live on-chain history (this may take a minute)...");
    
    const trades = await poly.getTrades();
    console.log(`Found ${trades.length} historical trades.`);

    const marketMap = new Map<string, {
        question: string,
        isBaseball: boolean,
        closed: boolean,
        winner: string,
        positions: Map<string, number>,
        totalCost: number
    }>();

    const baseballKeywords = [
        'KBO', 'MLB', 'Baseball',
        'Dodgers', 'Yankees', 'Red Sox', 'Cubs', 'Braves', 'Phillies', 'Astros', 'Orioles', 'Padres', 
        'Nationals', 'Rockies', 'Rays', 'Giants', 'Royals', 'Twins', 'Cardinals', 'Mets', 'White Sox', 
        'Marlins', 'Guardians', 'Rangers', 'Brewers', 'Blue Jays', 'Angels', 'Diamondbacks', 'Mariners', 
        'Tigers', 'Athletics', 'Pirates', 'Reds',
        'LG Twins', 'KT Wiz', 'SSG Landers', 'NC Dinos', 'Doosan Bears', 'KIA Tigers', 'Lotte Giants', 
        'Samsung Lions', 'Hanwha Eagles', 'Kiwoom Heroes', 'Samsung', 'Hanwha', 'Kiwoom', 'Doosan', 'Lotte'
    ];

    // Map token IDs to their respective markets to track cost-basis and payouts
    for (const t of trades) {
        const conditionId = t.market;
        const tokenId = t.asset_id;
        if (!tokenId || !conditionId) continue;

        if (!marketMap.has(tokenId)) {
            const details = await fetchMarketByConditionId(conditionId);
            if (!details) continue;

            const question = details.question || details.title || "Unknown Market";
            const isBaseball = baseballKeywords.some(kw => question.includes(kw));
            
            marketMap.set(tokenId, {
                question,
                isBaseball,
                closed: details.closed || false,
                winner: details.winningOutcomeIndex !== undefined ? details.outcomes[parseInt(details.winningOutcomeIndex)] : "",
                positions: new Map<string, number>(),
                totalCost: 0
            });
        }

        const m = marketMap.get(tokenId)!;
        const outcome = t.outcome;
        const size = parseFloat(t.size);
        const price = parseFloat(t.price);
        const currentSize = m.positions.get(outcome) || 0;

        let userAction = t.side;
        if (t.trader_side === 'MAKER') {
            userAction = t.side === 'BUY' ? 'SELL' : 'BUY';
        }

        if (userAction === 'BUY') {
            m.positions.set(outcome, currentSize + size);
            m.totalCost += size * price; 
        } else {
            m.positions.set(outcome, currentSize - size);
            m.totalCost -= size * price; 
        }
    }

    let kboProfit = 0;
    let mlbProfit = 0;
    let otherProfit = 0;
    let openValue = 0;

    for (const [tid, m] of marketMap.entries()) {
        let pnl = 0;

        if (m.closed) {
            let payout = 0;
            for (const [outcome, size] of m.positions.entries()) {
                if (size > 0.01 && outcome === m.winner) {
                    payout += size * 1.0;
                }
            }
            pnl = payout - m.totalCost;
        } else {
            let remainingShares = 0;
            for (const size of m.positions.values()) remainingShares += size;
            
            if (remainingShares < 0.01) {
                // Fully closed position in an open market
                pnl = -m.totalCost; 
            } else {
                openValue += m.totalCost;
                continue; // Skip open positions for REALIZED profit
            }
        }

        if (m.isBaseball) {
            if (m.question.includes('KBO:')) {
                kboProfit += pnl;
            } else {
                mlbProfit += pnl;
            }
        } else {
            otherProfit += pnl;
        }
    }

    const totalRealized = kboProfit + mlbProfit + otherProfit;

    console.log(`\n📊 ON-CHAIN REALIZED PNL SUMMARY`);
    console.log(`   Realized KBO Profit:     $${kboProfit.toFixed(2)}`);
    console.log(`   Realized MLB Profit:     $${mlbProfit.toFixed(2)}`);
    console.log(`   Other Markets Profit:    $${otherProfit.toFixed(2)}`);
    console.log(`   ------------------------------------`);
    console.log(`   TOTAL REALIZED PROFIT:   $${totalRealized.toFixed(2)}`);
    console.log(`\nNote: You currently have ~$${openValue.toFixed(2)} in open positions.`);
    console.log("====================================================");
}

calculateLivePnL().catch(console.error);
