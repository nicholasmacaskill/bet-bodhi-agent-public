/**
 * Revised MLB Stats API Wrapper
 * Optimized for Spring Training with defensive checks.
 */

export interface MLBGame {
    gamePk: number;
    homeTeam: string;
    homeId?: number;
    awayTeam: string;
    awayId?: number;
    venue: string;
    status: string;
    date: string;
    lineups?: {
        home: string[];
        away: string[];
    };
    probables?: {
        home?: string;
        away?: string;
    };
    weather?: {
        condition: string;
        temp: string;
        wind: string;
    };
}

export class MLBApi {
    private baseUrl = 'https://statsapi.mlb.com/api/v1';

    async getSchedule(date: string): Promise<MLBGame[]> {
        const url = `${this.baseUrl}/schedule?sportId=1&date=${date}&hydrate=team,lineups,probablePitcher,venue`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.dates || data.dates.length === 0) return [];

        return data.dates[0].games.map((game: any) => {
            const homePitcher = game.teams.home.probablePitcher?.fullName;
            const awayPitcher = game.teams.away.probablePitcher?.fullName;

            return {
                gamePk: game.gamePk,
                homeTeam: (game.teams.home.team.name || "").trim(),
                homeId: game.teams.home.team.id,
                awayTeam: (game.teams.away.team.name || "").trim(),
                awayId: game.teams.away.team.id,
                venue: (game.venue.name || "").trim(),
                status: game.status.detailedState,
                date: game.gameDate,
                probables: {
                    home: homePitcher,
                    away: awayPitcher
                },
                lineups: {
                    home: game.lineups?.homePlayers?.map((p: any) => p.fullName) || [],
                    away: game.lineups?.awayPlayers?.map((p: any) => p.fullName) || []
                }
            };
        });
    }

    /**
     * Fetch statistical leaders for a specific category (e.g., 'onBasePlusSlugging' or 'earnedRunAverage').
     */
    async getLeaders(category: string, group: 'hitting' | 'pitching'): Promise<string[]> {
        const url = `${this.baseUrl}/stats/leaders?leaderCategories=${category}&statGroup=${group}&season=2026&gameType=S&limit=10`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!data.leagueLeaders || data.leagueLeaders.length === 0) return [];

            return data.leagueLeaders[0].leaders.map((l: any) => l.person.fullName);
        } catch (e) {
            console.error(`Failed to fetch ${category} leaders:`, e);
            return [];
        }
    }

    /**
     * Fallback to detailed game feed if schedule isn't hydrated.
     */
    async getGameDetails(gamePk: number): Promise<any> {
        const url = `${this.baseUrl}/game/${gamePk}/feed/live`;
        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!data.gameData || !data.liveData) return null;

            const boxscore = data.liveData.boxscore;
            const homePitcher = data.gameData.probablePitchers?.home?.fullName;
            const awayPitcher = data.gameData.probablePitchers?.away?.fullName;

            // Boxscore format sometimes fails to hydrate linepus in spring, try to fall back to the live gameData format if boxscore lineup is empty
            const parseLineup = (teamData: any, fallbackPlayers: any[]) => {
                let lineup: string[] = [];
                if (teamData && teamData.lineup) {
                    lineup = teamData.lineup.map((id: number) => {
                        const player = teamData.players[`ID${id}`];
                        return player?.person?.fullName || "Unknown";
                    });
                }

                // If boxscore logic failed to find players and we have a fallback, use it
                if (lineup.length === 0 && fallbackPlayers && fallbackPlayers.length > 0) {
                    lineup = fallbackPlayers.map(p => p.fullName);
                }
                return lineup;
            };

            // Try to extract from schedule if it made it into the game feed but not the boxscore
            const activeGameInfo = data.liveData?.plays?.currentPlay?.about || {};

            // If boxscore lacks lineups, try to find them in the gameData players array
            const fallbackHomePlayers = Object.values(data.gameData?.players || {}).filter((p: any) => p.currentTeam && p.currentTeam.id === data.gameData?.teams?.home?.id);
            const fallbackAwayPlayers = Object.values(data.gameData?.players || {}).filter((p: any) => p.currentTeam && p.currentTeam.id === data.gameData?.teams?.away?.id);

            return {
                gamePk,
                lineups: {
                    home: parseLineup(boxscore?.teams?.home, fallbackHomePlayers),
                    away: parseLineup(boxscore?.teams?.away, fallbackAwayPlayers)
                },
                probables: {
                    home: homePitcher,
                    away: awayPitcher
                },
                weather: data.gameData?.weather ? {
                    condition: data.gameData.weather.condition,
                    temp: data.gameData.weather.temp,
                    wind: data.gameData.weather.wind
                } : undefined
            };
        } catch (e) {
            return null;
        }
    }

    /**
     * Fetch the active roster for a team.
     */
    async getTeamRoster(teamId: number): Promise<string[]> {
        const url = `${this.baseUrl}/teams/${teamId}/roster?rosterType=active`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!data.roster) return [];
            return data.roster.map((p: any) => p.person.fullName);
        } catch (e) {
            console.error(`Failed to fetch roster for team ${teamId}:`, e);
            return [];
        }
    }

    /**
     * Fetch basic person details (handedness, etc).
     */
    async getPersonDetails(personId: number): Promise<any> {
        const url = `${this.baseUrl}/people/${personId}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data.people ? data.people[0] : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Fetch player stats for a specific group and season.
     */
    async getPlayerStats(personId: number, group: 'hitting' | 'pitching', season: string = '2026'): Promise<any> {
        const url = `${this.baseUrl}/people/${personId}/stats?stats=statsSingleSeason&group=${group}&season=${season}&gameType=S`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!data.stats || data.stats.length === 0) return null;
            return data.stats[0].splits[0]?.stat || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Search for a person by name to get their ID.
     */
    async searchPerson(name: string): Promise<number | null> {
        const url = `${this.baseUrl}/people/search?names=${encodeURIComponent(name)}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!data.people || data.people.length === 0) return null;
            return data.people[0].id;
        } catch (e) {
            return null;
        }
    }

    /**
     * Get hot hitters (Top 3 by OPS) for a specific team.
     */
    async getHotBats(teamId: number): Promise<string[]> {
        const url = `${this.baseUrl}/stats/leaders?leaderCategories=onBasePlusSlugging&statGroup=hitting&season=2024&gameType=R&teamId=${teamId}&limit=3`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!data.leagueLeaders || data.leagueLeaders.length === 0) return [];
            return data.leagueLeaders[0].leaders.map((l: any) => `${l.person.fullName} (${l.value})`);
        } catch (e) {
            return [];
        }
    }

    /**
     * Fetch vs-Handedness splits for a player.
     */
    async getHandednessSplits(personId: number, group: 'hitting' | 'pitching'): Promise<any> {
        const url = `${this.baseUrl}/people/${personId}/stats?stats=statSplits&group=${group}&season=2024&gameType=R`; // Use 2024 Reg Season for deeper samples
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!data.stats) return [];
            return data.stats[0]?.splits || [];
        } catch (e) {
            return [];
        }
    }

    /**
     * CENTRALIZED HYDRATION: Fetch all data needed for a Pillar Analysis in one call.
     * Ensures consistency between bulk scanner and single analyst.
     */
    async getHydratedAnalysisData(game: MLBGame): Promise<{
        details: any;
        rosters: { home: string[], away: string[] };
        homeHot: string[];
        awayHot: string[];
    }> {
        const gamePk = game.gamePk;
        
        // 1. Details (Lineups + Weather + Probables)
        const details = await this.getGameDetails(gamePk) || { 
            probables: game.probables || {}, 
            lineups: game.lineups || { home: [], away: [] } 
        };

        // 2. Rosters (Hallucination Guard)
        let rosters = { home: [] as string[], away: [] as string[] };
        if (game.homeId && game.awayId) {
            const [h, a] = await Promise.all([
                this.getTeamRoster(game.homeId),
                this.getTeamRoster(game.awayId)
            ]);
            rosters = { home: h, away: a };
        }

        // 3. Hot Bats (Technical Signals)
        const [homeHotRaw, awayHotRaw] = await Promise.all([
            game.homeId ? this.getHotBats(game.homeId) : Promise.resolve([]),
            game.awayId ? this.getHotBats(game.awayId) : Promise.resolve([])
        ]);

        // Normalize hot bats (remove OPS strings)
        const cleanHot = (names: string[]) => names.map(n => n.split(' (')[0]);
        const homeHot = cleanHot(homeHotRaw);
        const awayHot = cleanHot(awayHotRaw);

        return {
            details,
            rosters,
            homeHot,
            awayHot
        };
    }
}
