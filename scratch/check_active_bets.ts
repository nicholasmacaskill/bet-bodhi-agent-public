import 'dotenv/config';
import { Wallet, ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const { ClobClient } = await import('@polymarket/clob-client');
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) throw new Error("Missing WALLET_PRIVATE_KEY");

    const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
    const wallet = new Wallet(privateKey, provider);

    const signerAdapter: any = {
        getAddress: async () => wallet.address,
        signMessage: async (message: string | Uint8Array) => wallet.signMessage(typeof message === 'string' ? message : ethers.hexlify(message)),
        _signTypedData: async (domain: any, types: any, value: any) => {
            const { EIP712Domain, ...restTypes } = types;
            return await wallet.signTypedData(domain, restTypes, value);
        },
        connect: () => signerAdapter
    };

    const proxyAddress = process.env.POLY_PROXY_ADDRESS;

    const credentials = (process.env.POLY_API_KEY && process.env.POLY_SECRET) ? {
        key: process.env.POLY_API_KEY,
        secret: process.env.POLY_SECRET,
        passphrase: process.env.POLY_PASSPHRASE || ""
    } : undefined;

    const client = new ClobClient(
        'https://clob.polymarket.com',
        137,
        signerAdapter,
        credentials as any,
        proxyAddress ? (1 as any) : undefined,
        proxyAddress
    );

    const targetAddress = proxyAddress || wallet.address;
    let output = "====================================================\n";
    output += `Checking active positions for Polymarket Address: ${targetAddress}\n`;
    output += "====================================================\n";

    // Fetch 100 maker/taker trades
    output += "Fetching recent trades from CLOB...\n";
    const makerTrades = await client.getTrades({ maker: targetAddress, limit: 100, offset: 0 });
    const takerTrades = await client.getTrades({ taker: targetAddress, limit: 100, offset: 0 });

    const allTrades = [...(makerTrades || []), ...(takerTrades || [])];
    output += `Fetched ${allTrades.length} trades.\n`;

    // Sort by match_time ascending to reconstruct positions chronologically
    const sortedTrades = allTrades.sort((a: any, b: any) => {
        const ta = parseFloat(a.match_time || "0");
        const tb = parseFloat(b.match_time || "0");
        return ta - tb;
    });

    const positions = new Map<string, {
        assetId: string,
        outcome: string,
        netShares: number,
        totalCost: number,
        buyTradesCount: number
    }>();

    for (const t of sortedTrades) {
        const assetId = t.asset_id;
        if (!assetId) continue;

        const size = parseFloat(t.size || "0");
        const price = parseFloat(t.price || "0");
        const outcome = t.outcome;
        const side = t.side; // BUY or SELL

        if (!positions.has(assetId)) {
            positions.set(assetId, {
                assetId,
                outcome,
                netShares: 0,
                totalCost: 0,
                buyTradesCount: 0
            });
        }

        const pos = positions.get(assetId)!;
        if (pos.outcome !== outcome) {
            // Update outcome if it changes (e.g. bought different side in same asset is not possible, but just in case)
            pos.outcome = outcome;
        }
        if (side === 'BUY') {
            pos.netShares += size;
            pos.totalCost += size * price;
            pos.buyTradesCount++;
        } else {
            pos.netShares -= size;
            pos.totalCost -= size * price;
        }
    }

    output += "\nResolving market details for active positions...\n";
    let activePositionsCount = 0;

    // We sort positions by assetId so we can analyze them consistently
    const sortedPosEntries = Array.from(positions.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    for (const [assetId, pos] of sortedPosEntries) {
        if (pos.netShares < 0.1) continue; // Skip near-zero positions

        activePositionsCount++;

        // Fetch market details from Gamma API using token ID
        let question = "Unknown Market";
        let isClosed = false;
        let currentPrice = 0;
        let outcomes: string[] = [];
        let outcomePrices: string[] = [];
        
        try {
            const res = await fetch(`https://gamma-api.polymarket.com/markets?clob_token_ids=${assetId}`);
            if (res.ok) {
                const data = await res.json();
                const market = data && data.length > 0 ? data[0] : null;
                if (market) {
                    question = market.question || market.title || "Unknown Market";
                    isClosed = market.closed || market.active === false;
                    outcomes = market.outcomes ? (typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes) : [];
                    outcomePrices = market.outcomePrices ? (typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : market.outcomePrices) : [];
                    
                    const tokenIds = market.clobTokenIds ? (typeof market.clobTokenIds === 'string' ? JSON.parse(market.clobTokenIds) : market.clobTokenIds) : [];
                    const outcomeIdx = tokenIds.indexOf(assetId);
                    if (outcomeIdx >= 0 && outcomePrices[outcomeIdx]) {
                        currentPrice = parseFloat(outcomePrices[outcomeIdx]);
                    }
                }
            }
        } catch (e: any) {
            output += `Failed to resolve details for asset ${assetId}: ${e.message}\n`;
        }

        const avgPricePaid = pos.netShares > 0 ? (pos.totalCost / pos.netShares) : 0;
        const currentValue = pos.netShares * currentPrice;
        const floatingPnL = currentValue - pos.totalCost;
        const pnlPct = pos.totalCost > 0 ? (floatingPnL / pos.totalCost) * 100 : 0;

        output += `\n📌 Market: "${question}"\n`;
        output += `   Asset ID:  ${assetId}\n`;
        output += `   Outcome:   [${pos.outcome}]\n`;
        output += `   Status:    ${isClosed ? 'CLOSED' : 'OPEN'}\n`;
        output += `   Shares:    ${pos.netShares.toFixed(2)}\n`;
        output += `   Avg Cost:  $${avgPricePaid.toFixed(4)} (Total Cost: $${pos.totalCost.toFixed(2)})\n`;
        output += `   Current:   $${currentPrice.toFixed(4)} (Current Value: $${currentValue.toFixed(2)})\n`;
        output += `   PnL:       $${floatingPnL.toFixed(2)} (${floatingPnL >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)\n`;
    }

    if (activePositionsCount === 0) {
        output += "No active open positions found.\n";
    }
    output += "\n====================================================\n";

    const reportPath = path.join(__dirname, 'active_bets_report.txt');
    fs.writeFileSync(reportPath, output);
    console.log(`Saved report to ${reportPath}`);
}

main().catch(console.error);
