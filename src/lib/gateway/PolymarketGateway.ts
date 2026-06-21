/**
 * PolymarketGateway - Standalone Decoupled Data Resolution Middleware
 * 
 * This module isolates the complexity of interacting with the Polymarket Gamma API, 
 * resolving discrepancies between CLOB trade records (which log literal baseball team outcomes)
 * and binary contract outcomes (which represent resolved YES/NO status).
 */

export interface GatewayConfig {
    delayMs?: number;
    gammaUrl?: string;
}

export interface RawClobTrade {
    id: string;
    market: string;      // Condition ID
    asset_id: string;    // Token ID
    side: string;        // BUY or SELL
    size: string;
    price: string;
    outcome: string;     // Literal target outcome name (e.g. "Washington Nationals")
    trader_side: string; // TAKER or MAKER
}

export interface MarketPnLDetails {
    question: string;
    isBaseball: boolean;
    closed: boolean;
    winner: string;
    positions: { [outcome: string]: number };
    totalCost: number;
    realizedPnL: number;
}

export interface PolymarketPnLReport {
    kboProfit: number;
    mlbProfit: number;
    otherProfit: number;
    totalRealizedProfit: number;
    totalOpenValue: number;
    markets: { [tokenId: string]: MarketPnLDetails };
}

export class PolymarketGateway {
    private delayMs: number;
    private gammaUrl: string;
    private detailsCache: Map<string, any> = new Map();

    constructor(config: GatewayConfig = {}) {
        this.delayMs = config.delayMs ?? 120;
        this.gammaUrl = config.gammaUrl ?? "https://gamma-api.polymarket.com";
    }

    /**
     * Helper to perform rate-limited sleeps between API requests.
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Resolves the market metadata for a specific condition ID.
     * Uses `condition_ids` (plural) parameter to prevent Gamma from silently ignoring the filter.
     * Tries active markets first, then queries with closed=true filter fallback.
     */
    public async getMarketMetadata(conditionId: string): Promise<any | null> {
        // Return cached payload if available (includes null payloads for negative caching)
        if (this.detailsCache.has(conditionId)) {
            return this.detailsCache.get(conditionId);
        }

        try {
            await this.sleep(this.delayMs);
            
            // 1. Try querying the active markets first
            let url = `${this.gammaUrl}/markets?condition_ids=${conditionId}`;
            let res = await fetch(url);
            let data = await res.json();

            if (data && data.length > 0) {
                const details = data[0];
                this.detailsCache.set(conditionId, details);
                return details;
            }

            // 2. Fallback to inactive/closed markets if active lookup returned empty
            await this.sleep(this.delayMs);
            url = `${this.gammaUrl}/markets?condition_ids=${conditionId}&closed=true`;
            res = await fetch(url);
            data = await res.json();

            if (data && data.length > 0) {
                const details = data[0];
                this.detailsCache.set(conditionId, details);
                return details;
            }

            // Store negative cache to prevent infinite retries on unresolvable markets
            this.detailsCache.set(conditionId, null);
            return null;
        } catch (error) {
            console.error(`[PolymarketGateway] Failed to retrieve metadata for condition ${conditionId}:`, error);
            return null;
        }
    }

    /**
     * Parses trade history, resolves market parameters, compares semantic team strings, and computes PnL.
     */
    public async calculatePnL(trades: RawClobTrade[]): Promise<PolymarketPnLReport> {
        const marketMap: { [tokenId: string]: MarketPnLDetails } = {};

        const baseballKeywords = [
            'kbo', 'mlb', 'baseball', 'korea',
            'dodgers', 'yankees', 'red sox', 'cubs', 'braves', 'phillies', 'astros', 'orioles', 'padres', 
            'nationals', 'rockies', 'rays', 'giants', 'royals', 'twins', 'cardinals', 'mets', 'white sox', 
            'marlins', 'guardians', 'rangers', 'brewers', 'blue jays', 'angels', 'diamondbacks', 'mariners', 
            'tigers', 'athletics', 'pirates', 'reds',
            'lg twins', 'kt wiz', 'ssg landers', 'nc dinos', 'doosan bears', 'kia tigers', 'lotte giants', 
            'samsung lions', 'hanwha eagles', 'kiwoom heroes', 'samsung', 'hanwha', 'kiwoom', 'doosan', 'lotte'
        ];

        for (const t of trades) {
            const conditionId = t.market;
            const tokenId = t.asset_id;
            if (!tokenId || !conditionId) continue;

            if (!marketMap[tokenId]) {
                const details = await this.getMarketMetadata(conditionId);
                
                if (!details) {
                    // Set safe fallback placeholders to prevent crashing and skip further API queries
                    marketMap[tokenId] = {
                        question: "Unknown Market",
                        isBaseball: false,
                        closed: false,
                        winner: "",
                        positions: {},
                        totalCost: 0,
                        realizedPnL: 0
                    };
                    continue;
                }

                const question = details.question || details.title || "Unknown Market";
                const lowerQuestion = question.toLowerCase();
                const isBaseball = baseballKeywords.some(kw => lowerQuestion.includes(kw));

                const isPastEnd = details.endDate ? (Date.now() > new Date(details.endDate).getTime()) : false;
                const closed = details.closed || isPastEnd || false;

                // Parse outcomes safely
                let outcomes: string[] = [];
                if (details.outcomes) {
                    outcomes = typeof details.outcomes === 'string' ? JSON.parse(details.outcomes) : details.outcomes;
                }

                // Resolve winning outcome string by winning index or outcomePrices fallback
                let winnerIndex = details.winningOutcomeIndex;
                if (winnerIndex === undefined || winnerIndex === null || winnerIndex === "") {
                    const prices = typeof details.outcomePrices === 'string' ? JSON.parse(details.outcomePrices) : details.outcomePrices || [];
                    const idx = prices.indexOf("1") !== -1 ? prices.indexOf("1") : prices.indexOf("1.0");
                    if (idx !== -1) {
                        winnerIndex = idx;
                    }
                }

                const winner = (winnerIndex !== undefined && winnerIndex !== null && winnerIndex !== "" && outcomes[parseInt(winnerIndex)])
                    ? outcomes[parseInt(winnerIndex)]
                    : "";

                marketMap[tokenId] = {
                    question,
                    isBaseball,
                    closed,
                    winner,
                    positions: {},
                    totalCost: 0,
                    realizedPnL: 0
                };
            }

            const m = marketMap[tokenId];
            const outcome = t.outcome;
            const size = parseFloat(t.size);
            const price = parseFloat(t.price);
            
            if (!m.positions[outcome]) {
                m.positions[outcome] = 0;
            }

            let userAction = t.side;
            if (t.trader_side === 'MAKER') {
                userAction = t.side === 'BUY' ? 'SELL' : 'BUY';
            }

            if (userAction === 'BUY') {
                m.positions[outcome] += size;
                m.totalCost += size * price;
            } else {
                m.positions[outcome] -= size;
                m.totalCost -= size * price;
            }
        }

        let kboProfit = 0;
        let mlbProfit = 0;
        let otherProfit = 0;
        let totalOpenValue = 0;

        for (const [tokenId, m] of Object.entries(marketMap)) {
            // Ignore placeholders
            if (m.question === "Unknown Market") continue;

            let pnl = 0;

            if (m.closed) {
                let payout = 0;
                for (const [outcome, size] of Object.entries(m.positions)) {
                    // Match outcome team string directly against the resolved team winner string
                    if (size > 0.01 && outcome.trim().toLowerCase() === m.winner.trim().toLowerCase()) {
                        payout += size * 1.0;
                    }
                }
                pnl = payout - m.totalCost;
                m.realizedPnL = pnl;
            } else {
                let remainingShares = 0;
                for (const size of Object.values(m.positions)) {
                    remainingShares += size;
                }

                if (remainingShares < 0.01) {
                    pnl = -m.totalCost;
                    m.realizedPnL = pnl;
                } else {
                    totalOpenValue += m.totalCost;
                    continue; // Position is active, skip realized profit accumulator
                }
            }

            if (m.isBaseball) {
                if (m.question.toUpperCase().includes('KBO')) {
                    kboProfit += pnl;
                } else {
                    mlbProfit += pnl;
                }
            } else {
                otherProfit += pnl;
            }
        }

        return {
            kboProfit,
            mlbProfit,
            otherProfit,
            totalRealizedProfit: kboProfit + mlbProfit + otherProfit,
            totalOpenValue,
            markets: marketMap
        };
    }
}
