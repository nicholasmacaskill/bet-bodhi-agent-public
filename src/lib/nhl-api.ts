/**
 * NHL API Wrapper (v1)
 * Using the modern nhle.com endpoints.
 */

export interface NHLGame {
    id: number;
    homeTeam: string;
    awayTeam: string;
    startTime: string;
    venue?: string;
}

export interface TeamStats {
    fullName: string;
    goalsForPerGame: number;
    goalsAgainstPerGame: number;
}

export class NHLApi {
    private baseUrl = 'https://api-web.nhle.com/v1';

    async getSchedule(date: string): Promise<NHLGame[]> {
        // First build team lookup from standings
        const teams = await this.getStandingsData();
        const lookup: Record<string, string> = {};
        teams.forEach((t: any) => {
            lookup[t.teamAbbrev.default] = t.teamName.default;
        });

        // console.log("DEBUG: LOOKUP", JSON.stringify(lookup));

        const url = `${this.baseUrl}/score/${date}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!data.games) return [];

            return data.games.map((g: any) => ({
                id: g.id,
                homeTeam: lookup[g.homeTeam.abbrev] || g.homeTeam.name.default,
                awayTeam: lookup[g.awayTeam.abbrev] || g.awayTeam.name.default,
                startTime: g.startTimeUTC,
                venue: g.venue?.default
            }));
        } catch (e) {
            console.error("NHL Schedule fetch failed:", e);
            return [];
        }
    }

    async getTeamStats(): Promise<Record<string, TeamStats>> {
        const standings = await this.getStandingsData();
        const stats: Record<string, TeamStats> = {};

        standings.forEach((team: any) => {
            const games = team.gamesPlayed || 1;
            const fullName = team.teamName.default;
            stats[fullName] = {
                fullName,
                goalsForPerGame: team.goalFor / games,
                goalsAgainstPerGame: team.goalAgainst / games
            };
        });

        return stats;
    }

    private async getStandingsData(): Promise<any[]> {
        const url = `${this.baseUrl}/standings/now`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data.standings || [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Fetch goalie save percentage. In a real app we'd query the roster, 
     * but here we'll pull the top leaders as a baseline for 'Elite' vs 'Weak'.
     */
    async getGoalieLeaders(): Promise<{ elite: string[], weak: string[] }> {
        // Proprietary Goalie lists redacted for public repo
        return {
            elite: [],
            weak: []
        };
    }
}
