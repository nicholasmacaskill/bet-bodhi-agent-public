/**
 * Odds API Wrapper
 * Fetches Moneyline (H2H) and Totals for game evaluation.
 * Includes 'Simulator' mode for local development.
 */

import { EspnOddsApi } from './espn-odds-api';

export interface OddsData {
    id: string;
    sport_key: string;
    commence_time: string;
    home_team: string;
    away_team: string;
    bookmakers: {
        key: string;
        title: string;
        last_update: string;
        markets: {
            key: string;
            outcomes: {
                name: string;
                price: number;
                point?: number;
            }[];
        }[];
    }[];
}

export class OddsApi {
    private apiKey: string | undefined = process.env.SPORTSBOOK_API_KEY;
    private baseUrl = 'https://api.the-odds-api.com/v4/sports';
    private espn = new EspnOddsApi();

    /**
     * Fetch H2H (Moneyline) odds for MLB.
     */
    async getMLBOdds(): Promise<OddsData[]> {
        return this.getOdds('baseball_mlb');
    }

    /**
     * Fetch H2H (Moneyline) odds for NHL.
     */
    async getNHLOdds(): Promise<OddsData[]> {
        return this.getOdds('icehockey_nhl');
    }

    /**
     * Fetch H2H (Moneyline) odds for NBA.
     */
    async getNBAOdds(): Promise<OddsData[]> {
        return this.getOdds('basketball_nba');
    }

    /**
     * Fetch H2H (Moneyline) odds for MMA (UFC).
     */
    async getMMAOdds(): Promise<OddsData[]> {
        return this.getOdds('mma_mixed_martial_arts');
    }

    public async getOdds(sportKey: string): Promise<OddsData[]> {
        // Try live API if key is present and not the placeholder
        if (this.apiKey && this.apiKey !== 'your_sportsbook_api_key' && !this.apiKey.startsWith('LOCAL_')) {
            const cleanSportKey = sportKey.replace('_preseason', '');
            const url = `${this.baseUrl}/${cleanSportKey}/odds/?apiKey=${this.apiKey}&regions=us&markets=h2h&oddsFormat=decimal`;
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.length > 0) {
                        // Check if any games are for "today" (roughly defined as within the next 24h)
                        const now = new Date();
                        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                        const hasTodayGames = data.some((g: any) => {
                            const startTime = new Date(g.commence_time);
                            return startTime >= now && startTime <= tomorrow;
                        });

                        if (hasTodayGames || data.length > 10) return data;
                        console.log(`Live API has ${data.length} future games but none for today. Trying ESPN fallback...`);
                    }
                }
            } catch (e) {
                console.warn(`Live API call failed for ${sportKey}, trying fallbacks...`);
            }
        }

        // ── Fallback 1: ESPN (Keyless) ──────────────────────────────────────
        const espnSport = this.mapToEspnSport(sportKey);
        if (espnSport) {
            try {
                const espnOdds = await this.espn.getOdds(espnSport);
                if (espnOdds && espnOdds.length > 0) {
                    const mapped = espnOdds
                        .map(o => {
                            const markets: any[] = [];

                            if (o.moneyline.home !== undefined && o.moneyline.away !== undefined) {
                                markets.push({
                                    key: "h2h",
                                    outcomes: [
                                        { name: o.homeTeam, price: this.americanToDecimal(o.moneyline.home!) },
                                        { name: o.awayTeam, price: this.americanToDecimal(o.moneyline.away!) }
                                    ]
                                });
                            }

                            if (o.spread.home && o.spread.away) {
                                markets.push({
                                    key: "spreads",
                                    outcomes: [
                                        { name: o.homeTeam, price: this.americanToDecimal(o.spread.home.odds), point: o.spread.home.line },
                                        { name: o.awayTeam, price: this.americanToDecimal(o.spread.away.odds), point: o.spread.away.line }
                                    ]
                                });
                            }

                            return {
                                id: `espn_${o.homeTeam}_${Date.now()}`,
                                sport_key: sportKey,
                                commence_time: new Date().toISOString(),
                                home_team: o.homeTeam,
                                away_team: o.awayTeam,
                                bookmakers: [{
                                    key: "espn_bet",
                                    title: "ESPN Bet",
                                    last_update: new Date().toISOString(),
                                    markets
                                }]
                            };
                        })
                        .filter(o => o.bookmakers[0].markets.length > 0);
                    if (mapped.length > 0) return mapped;
                }
            } catch (e) {
                console.warn(`ESPN Fallback failed for ${sportKey}`);
            }
        }

        // ── Fallback 2: Mock Data ───────────────────────────────────────────
        console.warn(`Using Mock ${sportKey} Odds (No API key and Fallback failed)`);
        return this.getMockOdds(sportKey);
    }

    private mapToEspnSport(sportKey: string): 'basketball/nba' | 'hockey/nhl' | 'baseball/mlb' | null {
        switch (sportKey) {
            case 'basketball_nba': return 'basketball/nba';
            case 'icehockey_nhl': return 'hockey/nhl';
            case 'baseball_mlb':
            case 'baseball_mlb_preseason':
                return 'baseball/mlb';
            default: return null;
        }
    }

    private americanToDecimal(american: number | string | undefined): number {
        if (american === undefined || american === null) return 1.91; // Standard vig fallback
        const num = typeof american === 'string' ? parseFloat(american) : american;
        if (isNaN(num)) return 1.91;
        if (num > 0) return (num / 100) + 1;
        return (100 / Math.abs(num)) + 1;
    }

    private getMockOdds(sportKey: string): OddsData[] {
        if (sportKey === 'icehockey_nhl') return this.getMockNHLOdds();
        if (sportKey === 'basketball_nba') return this.getMockNBAOdds();
        if (sportKey === 'mma_mixed_martial_arts') return this.getMockMMAOdds();
        return this.getMockSpringTrainingOdds();
    }

    /**
     * Simulator: Generates standard -115 +/- 10 ML odds for spring training match-ups.
     */
    private getMockSpringTrainingOdds(): OddsData[] {
        return [
            {
                id: "mock_march8_1",
                sport_key: "baseball_mlb_preseason",
                commence_time: "2026-03-08T18:05:00Z",
                home_team: "Toronto Blue Jays",
                away_team: "Detroit Tigers",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [
                        {
                            key: "h2h", outcomes: [
                                { name: "Toronto Blue Jays", price: 1.65 }, { name: "Detroit Tigers", price: 2.25 }
                            ]
                        },
                        {
                            key: "spreads", outcomes: [
                                { name: "Toronto Blue Jays", price: 1.91, point: -1.5 }, { name: "Detroit Tigers", price: 1.91, point: 1.5 }
                            ]
                        }
                    ]
                }]
            },
            {
                id: "mock_march1_1",
                sport_key: "baseball_mlb",
                commence_time: "2026-03-01T18:05:00Z",
                home_team: "Los Angeles Dodgers",
                away_team: "Los Angeles Angels",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Los Angeles Dodgers", price: 1.65 }, { name: "Los Angeles Angels", price: 2.25 }
                        ]
                    }]
                }]
            },
            {
                id: "mock_march1_2",
                sport_key: "baseball_mlb",
                commence_time: "2026-03-01T18:05:00Z",
                home_team: "San Francisco Giants",
                away_team: "San Diego Padres",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "San Francisco Giants", price: 1.88 }, { name: "San Diego Padres", price: 1.95 }
                        ]
                    }]
                }]
            },
            {
                id: "mock_march1_3",
                sport_key: "baseball_mlb",
                commence_time: "2026-03-01T18:05:00Z",
                home_team: "New York Yankees",
                away_team: "Toronto Blue Jays",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "New York Yankees", price: 1.70 }, { name: "Toronto Blue Jays", price: 2.20 }
                        ]
                    }]
                }]
            },
            {
                id: "mock_march1_4",
                sport_key: "baseball_mlb",
                commence_time: "2026-03-01T18:05:00Z",
                home_team: "Detroit Tigers",
                away_team: "Toronto Blue Jays",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Detroit Tigers", price: 1.72 }, { name: "Toronto Blue Jays", price: 2.18 }
                        ]
                    }]
                }]
            },
            {
                id: "mock_march1_5",
                sport_key: "baseball_mlb",
                commence_time: "2026-03-01T20:05:00Z",
                home_team: "Chicago Cubs",
                away_team: "Chicago White Sox",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Chicago Cubs", price: 1.62 }, { name: "Chicago White Sox", price: 2.35 }
                        ]
                    }]
                }]
            },
            {
                id: "mock_march1_6",
                sport_key: "baseball_mlb",
                commence_time: "2026-03-01T20:10:00Z",
                home_team: "Arizona Diamondbacks",
                away_team: "Cleveland Guardians",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Arizona Diamondbacks", price: 1.75 }, { name: "Cleveland Guardians", price: 2.12 }
                        ]
                    }]
                }]
            },
            {
                id: "mock_march1_7",
                sport_key: "baseball_mlb",
                commence_time: "2026-03-01T20:05:00Z",
                home_team: "Athletics",
                away_team: "Cincinnati Reds",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Athletics", price: 2.15 }, { name: "Cincinnati Reds", price: 1.74 }
                        ]
                    }]
                }]
            },
            {
                id: "mock_march1_8",
                sport_key: "baseball_mlb",
                commence_time: "2026-03-01T18:05:00Z",
                home_team: "St. Louis Cardinals",
                away_team: "Pittsburgh Pirates",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "St. Louis Cardinals", price: 1.82 }, { name: "Pittsburgh Pirates", price: 2.05 }
                        ]
                    }]
                }]
            },
            {
                id: "mock_march1_9",
                sport_key: "baseball_mlb",
                commence_time: "2026-03-01T18:05:00Z",
                home_team: "Atlanta Braves",
                away_team: "Tampa Bay Rays",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Atlanta Braves", price: 1.68 }, { name: "Tampa Bay Rays", price: 2.22 }
                        ]
                    }]
                }]
            },
            {
                id: "mock_march1_11",
                sport_key: "baseball_mlb",
                commence_time: "2026-03-01T21:10:00Z",
                home_team: "Seattle Mariners",
                away_team: "Texas Rangers",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Seattle Mariners", price: 1.62 }, { name: "Texas Rangers", price: 2.35 }
                        ]
                    }]
                }]
            },
            {
                id: "mock_march1_12",
                sport_key: "baseball_mlb",
                commence_time: "2026-03-01T21:05:00Z",
                home_team: "Kansas City Royals",
                away_team: "Milwaukee Brewers",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Kansas City Royals", price: 1.74 }, { name: "Milwaukee Brewers", price: 2.15 }
                        ]
                    }]
                }]
            },
            {
                id: "mock_march7_1",
                sport_key: "baseball_mlb",
                commence_time: "2026-03-07T23:05:00Z",
                home_team: "Washington Nationals",
                away_team: "New York Yankees",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [
                        {
                            key: "h2h", outcomes: [
                                { name: "Washington Nationals", price: 1.65 }, { name: "New York Yankees", price: 2.25 }
                            ]
                        },
                        {
                            key: "spreads", outcomes: [
                                { name: "Washington Nationals", price: 2.15, point: -1.5 }, { name: "New York Yankees", price: 1.70, point: 1.5 }
                            ]
                        }
                    ]
                }]
            }
        ];
    }

    private getMockNHLOdds(): OddsData[] {
        return [
            {
                id: "nhl_sia_m3_1",
                sport_key: "icehockey_nhl",
                commence_time: "2026-03-03T23:00:00Z",
                home_team: "Boston Bruins",
                away_team: "Pittsburgh Penguins",
                bookmakers: [{
                    key: "draftkings", title: "SportsInteraction", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Boston Bruins", price: 1.85 }, { name: "Pittsburgh Penguins", price: 1.98 }
                        ]
                    }]
                }]
            },
            {
                id: "nhl_sia_m3_2",
                sport_key: "icehockey_nhl",
                commence_time: "2026-03-03T23:00:00Z",
                home_team: "Buffalo Sabres",
                away_team: "Vegas Golden Knights",
                bookmakers: [{
                    key: "draftkings", title: "SportsInteraction", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Buffalo Sabres", price: 1.72 }, { name: "Vegas Golden Knights", price: 2.18 }
                        ]
                    }]
                }]
            },
            {
                id: "nhl_sia_m3_3",
                sport_key: "icehockey_nhl",
                commence_time: "2026-03-03T23:00:00Z",
                home_team: "Columbus Blue Jackets",
                away_team: "Nashville Predators",
                bookmakers: [{
                    key: "draftkings", title: "SportsInteraction", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Columbus Blue Jackets", price: 1.72 }, { name: "Nashville Predators", price: 2.18 }
                        ]
                    }]
                }]
            },
            {
                id: "nhl_sia_m3_4",
                sport_key: "icehockey_nhl",
                commence_time: "2026-03-03T23:00:00Z",
                home_team: "New Jersey Devils",
                away_team: "Florida Panthers",
                bookmakers: [{
                    key: "draftkings", title: "SportsInteraction", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "New Jersey Devils", price: 1.95 }, { name: "Florida Panthers", price: 1.87 }
                        ]
                    }]
                }]
            },
            {
                id: "nhl_sia_m3_5",
                sport_key: "icehockey_nhl",
                commence_time: "2026-03-03T23:30:00Z",
                home_team: "Anaheim Ducks",
                away_team: "Colorado Avalanche",
                bookmakers: [{
                    key: "draftkings", title: "SportsInteraction", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Anaheim Ducks", price: 2.65 }, { name: "Colorado Avalanche", price: 1.55 }
                        ]
                    }]
                }]
            }
        ];
    }

    private getMockNBAOdds(): OddsData[] {
        return [
            {
                id: "nba_mock_1",
                sport_key: "basketball_nba",
                commence_time: "2026-02-28T21:30:00Z",
                home_team: "Utah Jazz",
                away_team: "New Orleans Pelicans",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Utah Jazz", price: 1.65 }, { name: "New Orleans Pelicans", price: 2.20 }
                        ]
                    }]
                }]
            },
            {
                id: "nba_mock_2",
                sport_key: "basketball_nba",
                commence_time: "2026-02-28T20:30:00Z",
                home_team: "Boston Celtics",
                away_team: "Oklahoma City Thunder",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Boston Celtics", price: 1.62 }, { name: "Oklahoma City Thunder", price: 2.35 }
                        ]
                    }]
                }]
            },
            {
                id: "nba_mock_3",
                sport_key: "basketball_nba",
                commence_time: "2026-02-28T22:00:00Z",
                home_team: "Golden State Warriors",
                away_team: "Los Angeles Lakers",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Golden State Warriors", price: 1.85 }, { name: "Los Angeles Lakers", price: 2.02 }
                        ]
                    }]
                }]
            },
            {
                id: "nba_mock_4",
                sport_key: "basketball_nba",
                commence_time: "2026-02-28T20:00:00Z",
                home_team: "Miami Heat",
                away_team: "Houston Rockets",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Miami Heat", price: 1.74 }, { name: "Houston Rockets", price: 2.15 }
                        ]
                    }]
                }]
            }
        ];
    }
    private getMockMMAOdds(): OddsData[] {
        return [
            {
                id: "mma_mock_1",
                sport_key: "mma_mixed_martial_arts",
                commence_time: "2026-03-01T03:00:00Z",
                home_team: "Brandon Moreno",
                away_team: "Lone'er Kavanagh",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Brandon Moreno", price: 1.57 }, { name: "Lone'er Kavanagh", price: 2.50 }
                        ]
                    }]
                }]
            },
            {
                id: "mma_mock_2",
                sport_key: "mma_mixed_martial_arts",
                commence_time: "2026-03-01T02:30:00Z",
                home_team: "Marlon Vera",
                away_team: "David Martinez",
                bookmakers: [{
                    key: "draftkings", title: "DraftKings", last_update: "now",
                    markets: [{
                        key: "h2h", outcomes: [
                            { name: "Marlon Vera", price: 2.70 }, { name: "David Martinez", price: 1.50 }
                        ]
                    }]
                }]
            }
        ];
    }
}
