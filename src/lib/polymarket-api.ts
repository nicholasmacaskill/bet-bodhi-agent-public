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

    /**
     * Fetches active markets by category (e.g., 'Sports', 'Baseball', 'Hockey').
     */
    async getActiveSportsMarkets(keyword: string = "vs."): Promise<PolyMarket[]> {
        const markets: PolyMarket[] = [];
        let offset = 0;
        const maxPages = 5;

        try {
            for (let i = 0; i < maxPages; i++) {
                const url = `${this.gammaUrl}/events?active=true&closed=false&limit=1000&offset=${offset}`;
                const response = await fetch(url);

                if (!response.ok) {
                    console.error(`Polymarket API Error: ${response.status} ${response.statusText}`);
                    break;
                }

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
                                        outcomes: market.outcomes ? JSON.parse(market.outcomes) : [],
                                        outcomePrices: market.outcomePrices ? JSON.parse(market.outcomePrices) : [],
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
            console.error("Failed to fetch from Polymarket:", error);
            return [];
        }
    }

    /**
     * Searches for a specific matchup market based on team names.
     */
    async getMarketByTeams(homeTeam: string, awayTeam: string): Promise<PolyMarket | null> {
        const homeMascot = homeTeam.split(' ').pop()?.toLowerCase() || "";
        const awayMascot = awayTeam.split(' ').pop()?.toLowerCase() || "";
        
        try {
            // 1. Targeted Search (Fast)
            const query = `${homeMascot} ${awayMascot}`;
            const url = `${this.gammaUrl}/events?active=true&closed=false&limit=50&query=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            let data = [];
            if (response.ok) {
                data = await response.json();
            }

            // Fallback 1: Just home mascot
            if (!data || data.length === 0) {
                const fallbackUrl = `${this.gammaUrl}/events?active=true&closed=false&limit=100&query=${encodeURIComponent(homeMascot)}`;
                const fallbackResp = await fetch(fallbackUrl);
                if (fallbackResp.ok) {
                    const fallbackData = await fallbackResp.json();
                    if (Array.isArray(fallbackData)) data.push(...fallbackData);
                }
            }

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

            // 2. Scanner-Style Fallback (Comprehensive)
            // If targeted search failed, fetch all sports markets vs. and search manually
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

    /**
     * Fetches the USDC balance for the configured wallet on Polygon.
     */
    async getUSDCBalance(): Promise<number> {
        const privateKey = process.env.WALLET_PRIVATE_KEY;
        if (!privateKey || privateKey === 'your_private_key_here') return 0;

        try {
            // Using a more reliable public RPC for balance checks
            const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
            const wallet = new Wallet(privateKey, provider);

            // Check proxy address if configured, otherwise use EOA
            const targetAddress = process.env.POLY_PROXY_ADDRESS || wallet.address;

            // USDC.e on Polygon (Bridged) - This is what Polymarket CLOB uses primarily
            const usdcEAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
            const abi = ["function balanceOf(address account) view returns (uint256)", "function decimals() view returns (uint8)"];

            const contract = new ethers.Contract(usdcEAddress, abi, provider);
            const [balance, decimals] = await Promise.all([
                contract.balanceOf(targetAddress),
                contract.decimals()
            ]);

            return parseFloat(ethers.formatUnits(balance, decimals));
        } catch (error) {
            // Silence RPC detection spam in scanner logs
            return 0;
        }
    }

    /**
     * Fetches open orders for the configured wallet from Polymarket CLOB.
     */
    async getOpenOrders() {
        const privateKey = process.env.WALLET_PRIVATE_KEY;
        if (!privateKey || privateKey === 'your_private_key_here') return [];

        try {
            const wallet = new Wallet(privateKey);
            const address = wallet.address;

            const url = `${this.clobUrl}/orders?maker=${address}&status=open`;
            const response = await fetch(url);

            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error("Failed to fetch Polymarket open orders:", error);
            return [];
        }
    }

    /**
     * Places a bounded limit order on Polymarket (acts like a market order with slippage).
     * @param slippage The max price variance allowed (e.g. 0.05 for 5 cents). Default: 0.05.
     * Requires WALLET_PRIVATE_KEY in .env
     */
    async placeOrder(conditionId: string, outcomeIndex: number, amount: number, price: number, slippage: number = 0.05) {
        const privateKey = process.env.WALLET_PRIVATE_KEY;
        const isDryRun = process.env.DRY_RUN === 'true';

        // Terminal Colors for CLI output
        const RESET = "\x1b[0m";
        const BOLD = "\x1b[1m";
        const YELLOW = "\x1b[33m";
        const RED = "\x1b[31m";

        if (!privateKey || privateKey === 'your_private_key_here') {
            throw new Error("Missing WALLET_PRIVATE_KEY in .env");
        }

        // Safety check for safety limit
        const maxStake = parseFloat(process.env.MAX_TEST_STAKE || "35.00");
        if (amount > maxStake) {
            throw new Error(`Bet size $${amount} exceeds safety limit of $${maxStake}`);
        }

        console.log(`${isDryRun ? '[DRY RUN] ' : ''}Initialising Polymarket CLOB Client...`);

        try {
            const { ClobClient } = await import('@polymarket/clob-client');
            const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
            const wallet = new Wallet(privateKey, provider);

            // Version Bridge: Adapter for ethers v6 wallet to match ethers v5 signer interface expected by SDK
            const signerAdapter: any = {
                getAddress: async () => wallet.address,
                signMessage: async (message: string | Uint8Array) => wallet.signMessage(typeof message === 'string' ? message : ethers.hexlify(message)),
                _signTypedData: async (domain: any, types: any, value: any) => {
                    const { EIP712Domain, ...restTypes } = types;
                    return await wallet.signTypedData(domain, restTypes, value);
                },
                connect: () => signerAdapter
            };

            // Check for existing API credentials in env to avoid re-derivation
            const credentials = (process.env.POLY_API_KEY && process.env.POLY_SECRET) ? {
                key: process.env.POLY_API_KEY,
                secret: process.env.POLY_SECRET,
                passphrase: process.env.POLY_PASSPHRASE || ""
            } : undefined;

            const proxyAddress = process.env.POLY_PROXY_ADDRESS;

            let client = new ClobClient(
                'https://clob.polymarket.com',
                137,
                signerAdapter,
                credentials,
                proxyAddress ? (1 as any) : undefined, // SignatureType.POLY_PROXY = 1
                proxyAddress
            );

            // If no credentials, derive them
            if (!credentials) {
                console.log("  No API credentials found. Deriving from wallet...");
                const newCreds = await client.createOrDeriveApiKey();
                console.log(`\n  ${BOLD}${YELLOW}⚠️  NEW API CREDENTIALS DERIVED${RESET}`);
                console.log(`  Add these to your .env to speed up future orders:`);
                console.log(`  POLY_API_KEY=${newCreds.key}`);
                console.log(`  POLY_SECRET=${newCreds.secret}`);
                console.log(`  POLY_PASSPHRASE=${newCreds.passphrase}\n`);
                client = new ClobClient(
                    'https://clob.polymarket.com',
                    137,
                    signerAdapter,
                    newCreds,
                    proxyAddress ? (1 as any) : undefined,
                    proxyAddress
                );
            }

            const executionPrice = Math.min(price + slippage, 0.99);
            console.log(`  Target: ${conditionId} | Outcome: ${outcomeIndex} | Amount: $${amount} | Base Price: $${price} | Exec Price (Max): $${executionPrice}`);

            // 2. Resolve TokenID
            // Searching via /events (matching the scanner's multi-page path)
            let market: any = undefined;
            for (let offset = 0; offset < 5000; offset += 1000) {
                const eventsUrl = `${this.gammaUrl}/events?active=true&closed=false&limit=1000&offset=${offset}`;
                const eventsResp = await fetch(eventsUrl);
                const events = await eventsResp.json();

                if (Array.isArray(events)) {
                    for (const event of events) {
                        if (event.markets && Array.isArray(event.markets)) {
                            market = event.markets.find((m: any) => m.conditionId?.toLowerCase() === conditionId.toLowerCase());
                            if (market) break;
                        }
                    }
                }
                if (market) break;
            }

            if (!market || !market.clobTokenIds) {
                // Fallback to direct market query (bypassing active/closed filters)
                const directUrl = `${this.gammaUrl}/markets?condition_id=${conditionId}`;
                const directResp = await fetch(directUrl);
                const directMarkets = await directResp.json();
                market = directMarkets.find((m: any) => m.conditionId?.toLowerCase() === conditionId.toLowerCase());
            }

            if (!market || !market.clobTokenIds) {
                throw new Error(`Could not resolve TokenID for Condition ${conditionId}. Market may be closed or unindexed.`);
            }

            const tokenIds = typeof market.clobTokenIds === 'string' ? JSON.parse(market.clobTokenIds) : market.clobTokenIds;
            const tokenId = tokenIds[outcomeIndex];

            if (!tokenId) {
                throw new Error(`TokenID not found for outcome ${outcomeIndex} in market ${conditionId}`);
            }

            console.log(`  Resolved TokenID: ${tokenId}`);

            return this.executeAndPost(client, tokenId, amount, executionPrice, isDryRun);
        } catch (error: any) {
            console.error(`  Polymarket Order Failed: ${error.message}`);
            if (error.message.includes("allowance")) {
                console.log(`  ${RED}TIP: You likely need to approve USDC.e spending on Polymarket for this wallet.${RESET}`);
            }
            throw error;
        }
    }

    private async executeAndPost(client: any, tokenId: string, amount: number, price: number, isDryRun: boolean) {
        if (isDryRun) {
            return { success: true, message: "Dry run completed successfully." };
        }

        // 3. Place Order
        const size = Math.floor(amount / price);
        console.log(`  Placing BUY order for ${size} shares...`);

        const orderResp = await client.createAndPostOrder({
            tokenID: tokenId,
            price: price,
            size: size,
            side: "BUY" as any
        });

        console.log(`  Order Posted! ID: ${orderResp.orderID}`);

        return {
            success: true,
            orderId: orderResp.orderID,
            message: "Order placed successfully on Polymarket CLOB."
        };
    }

    /**
     * Fetches trade history for the configured wallet.
     */
    async getTrades() {
        const privateKey = process.env.WALLET_PRIVATE_KEY;
        if (!privateKey || privateKey === 'your_private_key_here') return [];

        try {
            const { ClobClient } = await import('@polymarket/clob-client');
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

            const credentials = (process.env.POLY_API_KEY && process.env.POLY_SECRET) ? {
                key: process.env.POLY_API_KEY,
                secret: process.env.POLY_SECRET,
                passphrase: process.env.POLY_PASSPHRASE || ""
            } : undefined;

            const client = new ClobClient(
                'https://clob.polymarket.com',
                137,
                signerAdapter,
                credentials,
                process.env.POLY_PROXY_ADDRESS ? (1 as any) : undefined,
                process.env.POLY_PROXY_ADDRESS
            );

            // Fetch filled orders or trades
            const trades = await (client as any).getTrades({ maker: process.env.POLY_PROXY_ADDRESS || wallet.address });
            return trades;
        } catch (error) {
            console.error("Failed to fetch Polymarket trades:", error);
            return [];
        }
    }

    /**
     * Resolves market details for a specific conditionId.
     */
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
