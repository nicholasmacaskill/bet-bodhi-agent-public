import { Wallet, ethers } from 'ethers';

export interface PolyMarket {
    conditionId: string;
    question: string;
    description: string;
    outcomes: string[];
    outcomePrices: string[];
    category: string;
    active: boolean;
    volume: number;
    endDate: string;
}

export class PolymarketApi {
    private gammaUrl = 'https://gamma-api.polymarket.com';
    private clobUrl = 'https://clob.polymarket.com';

    private async initClient() {
        const { ClobClient } = await import('@polymarket/clob-client');
        
        const privateKey = process.env.WALLET_PRIVATE_KEY;
        if (!privateKey) throw new Error("Missing WALLET_PRIVATE_KEY");

        const wallet = new Wallet(privateKey);
        
        // Custom adapter to bridge ethers v6 wallet to the ethers v5 interface expected by the SDK
        const signerAdapter: any = {
            getAddress: async () => wallet.address,
            signMessage: async (message: string | Uint8Array) => wallet.signMessage(typeof message === 'string' ? message : ethers.hexlify(message)),
            _signTypedData: async (domain: any, types: any, value: any) => {
                const { EIP712Domain, ...restTypes } = types;
                return await wallet.signTypedData(domain, restTypes, value);
            },
            connect: () => signerAdapter
        };

        const credentials = (process.env.POLY_API_KEY && process.env.POLY_SECRET) ? {
            key: process.env.POLY_API_KEY,
            secret: process.env.POLY_SECRET,
            passphrase: process.env.POLY_PASSPHRASE || ""
        } : undefined;

        const proxyAddress = process.env.POLY_PROXY_ADDRESS;

        return new ClobClient(
            'https://clob.polymarket.com',
            137,
            signerAdapter,
            credentials as any,
            proxyAddress ? (1 as any) : undefined,
            proxyAddress
        );
    }

    async getActiveSportsMarkets(keyword: string = "vs."): Promise<PolyMarket[]> {
        const markets: PolyMarket[] = [];
        let offset = 0;
        const maxPages = 5;

        try {
            for (let i = 0; i < maxPages; i++) {
                const url = `${this.gammaUrl}/events?active=true&closed=false&limit=1000&offset=${offset}`;
                const response = await fetch(url);
                if (!response.ok) break;

                const data = await response.json();
                if (!data || !Array.isArray(data) || data.length === 0) break;

                for (const event of data) {
                    if (event.title && event.title.toLowerCase().includes(keyword.toLowerCase())) {
                        if (event.markets && Array.isArray(event.markets)) {
                            for (const market of event.markets) {
                                if (market.active && !market.closed) {
                                    markets.push({
                                        conditionId: market.conditionId,
                                        question: market.question,
                                        description: market.description || event.description || "",
                                        outcomes: market.outcomes ? (typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes) : [],
                                        outcomePrices: market.outcomePrices ? (typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : market.outcomePrices) : [],
                                        category: event.category,
                                        active: market.active,
                                        volume: parseFloat(market.volume || "0"),
                                        endDate: market.endDate
                                    });
                                }
                            }
                        }
                    }
                }
                offset += 1000;
            }
            return markets.sort((a, b) => b.volume - a.volume);
        } catch (error) {
            return [];
        }
    }

    async getMarketByTeams(homeTeam: string, awayTeam: string): Promise<PolyMarket | null> {
        const homeMascot = homeTeam.split(' ').pop()?.toLowerCase() || "";
        const awayMascot = awayTeam.split(' ').pop()?.toLowerCase() || "";
        
        try {
            const query = `${homeMascot} ${awayMascot}`;
            const url = `${this.gammaUrl}/events?active=true&closed=false&limit=50&query=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            let data = [];
            if (response.ok) data = await response.json();

            const match = (marketList: any[]) => {
                for (const event of marketList) {
                    if (!event.markets) continue;
                    for (const market of event.markets) {
                        const q = market.question.toLowerCase();
                        const d = (market.description || event.description || "").toLowerCase();
                        const t = (event.title || "").toLowerCase();
                        
                        if ((q.includes(homeMascot) || d.includes(homeMascot) || t.includes(homeMascot)) && 
                            (q.includes(awayMascot) || d.includes(awayMascot) || t.includes(awayMascot))) {
                            return {
                                conditionId: market.conditionId,
                                question: market.question,
                                description: market.description || event.description || "",
                                outcomes: market.outcomes ? (typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes) : [],
                                outcomePrices: market.outcomePrices ? (typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : market.outcomePrices) : [],
                                category: event.category,
                                active: market.active,
                                volume: parseFloat(market.volume || "0"),
                                endDate: market.endDate
                            };
                        }
                    }
                }
                return null;
            };

            const directResult = match(data);
            if (directResult) return directResult;

            const allMarkets = await this.getActiveSportsMarkets("vs.");
            for (const m of allMarkets) {
                const q = m.question.toLowerCase();
                const d = m.description.toLowerCase();
                if ((q.includes(homeMascot) || d.includes(homeMascot)) && (q.includes(awayMascot) || d.includes(awayMascot))) {
                    return m;
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async getUSDCBalance(): Promise<number> {
        const privateKey = process.env.WALLET_PRIVATE_KEY;
        if (!privateKey) return 0;
        try {
            const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
            const wallet = new Wallet(privateKey, provider);
            const targetAddress = process.env.POLY_PROXY_ADDRESS || wallet.address;
            const usdcEAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
            const abi = ["function balanceOf(address account) view returns (uint256)", "function decimals() view returns (uint8)"];
            const contract = new ethers.Contract(usdcEAddress, abi, provider);
            const [balance, decimals] = await Promise.all([contract.balanceOf(targetAddress), contract.decimals()]);
            return parseFloat(ethers.formatUnits(balance, decimals));
        } catch (error) {
            return 0;
        }
    }

    async getTrades() {
        const proxy = process.env.POLY_PROXY_ADDRESS;
        const wallet = new Wallet(process.env.WALLET_PRIVATE_KEY || "");
        const eoa = wallet.address;

        console.log(`[poly] Syncing history for Proxy (${proxy}) and EOA (${eoa})`);
        
        const [proxyTrades, eoaTrades] = await Promise.all([
            proxy ? this.getTradesForAddress(proxy) : Promise.resolve([]),
            this.getTradesForAddress(eoa)
        ]);

        const allTrades = [...proxyTrades, ...eoaTrades];
        const uniqueTrades = Array.from(new Map(allTrades.map(t => [t.id, t])).values());
        return uniqueTrades;
    }

    async getTradesForAddress(targetAddress: string) {
        try {
            const client = await this.initClient();
            let allTrades: any[] = [];
            let offset = 0;
            const limit = 100;
            
            while (true) {
                const trades = await (client as any).getTrades({ 
                    maker: targetAddress,
                    limit: limit,
                    offset: offset
                });
                if (!trades || trades.length === 0) break;
                allTrades = allTrades.concat(trades);
                if (trades.length < limit) break;
                offset += limit;
                if (offset > 5000) break; 
            }
            return allTrades;
        } catch (e: any) {
            console.error(`[poly] Error fetching trades for ${targetAddress}:`, e.message);
            return [];
        }
    }

    async getMarketDetails(conditionId: string) {
        try {
            const url = `${this.gammaUrl}/markets?condition_id=${conditionId}`;
            const res = await fetch(url);
            const data = await res.json();
            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            return null;
        }
    }
}
