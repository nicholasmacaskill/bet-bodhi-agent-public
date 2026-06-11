import 'dotenv/config';

async function fetchTradesDirect(address: string, role: 'maker' | 'taker') {
    const url = `https://clob.polymarket.com/trades?${role}=${address}&limit=100`;
    console.log(`Fetching ${role} trades from: ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    return data || [];
}

async function main() {
    const proxy = process.env.POLY_PROXY_ADDRESS || "0x98652277eb9f1164d121c207e7a620710072f6af";
    const eoa = "0xb1Aa8Ff8CEeB5506044DB7BcB2B2D243Ff680BB1";

    console.log(`Proxy Address: ${proxy}`);
    console.log(`EOA Address: ${eoa}`);

    try {
        const proxyMaker = await fetchTradesDirect(proxy, 'maker');
        console.log(`Proxy Maker Trades: ${proxyMaker.length}`);

        const proxyTaker = await fetchTradesDirect(proxy, 'taker');
        console.log(`Proxy Taker Trades: ${proxyTaker.length}`);

        const eoaMaker = await fetchTradesDirect(eoa, 'maker');
        console.log(`EOA Maker Trades: ${eoaMaker.length}`);

        const eoaTaker = await fetchTradesDirect(eoa, 'taker');
        console.log(`EOA Taker Trades: ${eoaTaker.length}`);

        const allTrades = [...proxyMaker, ...proxyTaker, ...eoaMaker, ...eoaTaker];
        console.log(`Total raw trades combined: ${allTrades.length}`);
        
        if (allTrades.length > 0) {
            console.log("Sample Trade:", JSON.stringify(allTrades[0], null, 2));
        }
    } catch (err: any) {
        console.error("Error fetching trades:", err.message);
    }
}

main().catch(console.error);
