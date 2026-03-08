/**
 * Polymarket API Wrapper (Gamma API)
 * Used to fetch active sports markets and share prices (implied probabilities).
 */

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

    /**
     * Fetches active markets by category (e.g., 'Sports', 'Baseball', 'Hockey').
     * The Gamma API returns a massive list, so we filter down to active sports events.
     */
    async getActiveSportsMarkets(keyword: string = "vs."): Promise<PolyMarket[]> {
        // Daily sports games on Polymarket are titled "Team vs. Team" and buried deep in the pagination.
        // We must fetch multiple pages to find them.
        const markets: PolyMarket[] = [];
        let offset = 0;
        const maxPages = 5; // Fetch up to 5000 events to find hidden sports markets

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
                    // Look for our keyword (usually "vs." or a specific team name)
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
}
