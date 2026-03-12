/**
 * NBA API Wrapper
 * Primarily using ESPN's unofficial endpoints for scoreboards and stats.
 */

export interface NBAGame {
    id: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string;
    venue?: string;
}

export interface NBATeamStats {
    fullName: string;
    abbreviation: string;
    offenseRating: number; // Points per 100 possessions
    defenseRating: number;
    netRating: number;
    pace: number;
}

export class NBAApi {
    private scoreboardUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';

    async getSchedule(date?: string): Promise<NBAGame[]> {
        // date format YYYYMMDD
        const url = date ? `${this.scoreboardUrl}?dates=${date}` : this.scoreboardUrl;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!data.events) return [];

            return data.events.map((event: any) => ({
                id: event.id,
                homeTeam: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.displayName,
                awayTeam: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.displayName,
                startTime: event.date,
                venue: event.competitions[0].venue?.fullName
            }));
        } catch (e) {
            console.error("NBA Schedule fetch failed:", e);
            return [];
        }
    }

    /**
     * NBA Technical Sport Analysis relies on Advanced Stats.
     * Since official NBA stats are hard to fetch via simple fetch, we'll use a 
     * curated list of 2025-26 season profiles as a baseline.
     */
    async getTeamAdvancedStats(): Promise<Record<string, NBATeamStats>> {
        // In a full production app, we'd scrape or use a paid provider.
        // For Bodhi, we'll return a data structure that the analyzer can use.
        // These are based on 2025-26 projected/seasonal averages for demonstration.
        return {
            "Utah Jazz": {
                fullName: "Utah Jazz",
                abbreviation: "UTAH",
                offenseRating: 110.5,
                defenseRating: 119.2,
                netRating: -8.7,
                pace: 99.5
            },
            "New Orleans Pelicans": {
                fullName: "New Orleans Pelicans",
                abbreviation: "NO",
                offenseRating: 116.2,
                defenseRating: 112.5,
                netRating: 3.7,
                pace: 98.2
            },
            "Boston Celtics": {
                fullName: "Boston Celtics",
                abbreviation: "BOS",
                offenseRating: 122.4,
                defenseRating: 110.2,
                netRating: 12.2,
                pace: 97.5
            },
            "Detroit Pistons": {
                fullName: "Detroit Pistons",
                abbreviation: "DET",
                offenseRating: 108.2,
                defenseRating: 118.5,
                netRating: -10.3,
                pace: 100.2
            },
            "Oklahoma City Thunder": {
                fullName: "Oklahoma City Thunder",
                abbreviation: "OKC",
                offenseRating: 118.5,
                defenseRating: 107.2,
                netRating: 11.3,
                pace: 101.5
            },
            "Los Angeles Lakers": {
                fullName: "Los Angeles Lakers", abbreviation: "LAL",
                offenseRating: 114.5, defenseRating: 116.2, netRating: -1.7, pace: 101.2
            },
            "Golden State Warriors": {
                fullName: "Golden State Warriors", abbreviation: "GSW",
                offenseRating: 118.2, defenseRating: 114.5, netRating: 3.7, pace: 100.5
            },
            "Houston Rockets": {
                fullName: "Houston Rockets", abbreviation: "HOU",
                offenseRating: 113.8, defenseRating: 110.5, netRating: 3.3, pace: 99.2
            },
            "Miami Heat": {
                fullName: "Miami Heat", abbreviation: "MIA",
                offenseRating: 112.5, defenseRating: 113.2, netRating: -0.7, pace: 96.5
            },
            "Phoenix Suns": {
                fullName: "Phoenix Suns", abbreviation: "PHX",
                offenseRating: 117.5, defenseRating: 115.8, netRating: 1.7, pace: 98.8
            }
        };
    }

    /**
     * CENTRALIZED HYDRATION: Fetch all data needed for a Pillar Analysis in one call.
     */
    async getHydratedAnalysisData(): Promise<{
        nbaStats: Record<string, NBATeamStats>;
    }> {
        const nbaStats = await this.getTeamAdvancedStats();
        return { nbaStats };
    }
}
