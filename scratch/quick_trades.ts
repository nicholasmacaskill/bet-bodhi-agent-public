import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';
import { Wallet, ethers } from 'ethers';

async function quickTrades() {
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
    console.log(`Fetching 50 recent trades for ${targetAddress}`);

    const makerTrades = await client.getTrades({ maker: targetAddress, limit: 50, offset: 0 });
    const takerTrades = await client.getTrades({ taker: targetAddress, limit: 50, offset: 0 });

    const allTrades = [...(makerTrades || []), ...(takerTrades || [])];
    const uniqueTrades = Array.from(new Map(allTrades.map(t => [t.id || t.transaction_hash, t])).values());

    const sortedTrades = uniqueTrades.sort((a: any, b: any) => {
        const ta = new Date(a.match_time || 0).getTime();
        const tb = new Date(b.match_time || 0).getTime();
        return tb - ta;
    });

    for (const t of sortedTrades.slice(0, 20)) {
        try {
            const res = await fetch(`https://gamma-api.polymarket.com/markets?clob_token_ids=${t.asset_id}`);
            const data = await res.json();
            const details = data && data.length > 0 ? data[0] : null;
            const question = details?.question || t.asset_id;
            const prices = details?.outcomePrices ? JSON.parse(details.outcomePrices) : [];
            const tokenIds = details?.clobTokenIds ? JSON.parse(details.clobTokenIds) : [];
            const idx = tokenIds.indexOf(t.asset_id);
            const currentPrice = idx >= 0 ? prices[idx] : 'N/A';
            const isClosed = details?.closed || details?.active === false;
            
            console.log(`[${new Date(Number(t.match_time) * 1000).toLocaleString()}] ${t.side} ${t.size} @ ${t.price} | ${question} | Outcome: ${t.outcome} | Current Price: ${currentPrice} | Closed: ${isClosed}`);
        } catch (e) {
            console.log(`[${new Date(Number(t.match_time) * 1000).toLocaleString()}] ${t.side} ${t.size} @ ${t.price} | Asset: ${t.asset_id} | Outcome: ${t.outcome}`);
        }
    }
}

quickTrades().catch(console.error);
