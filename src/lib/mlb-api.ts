/**
 * Revised MLB Stats API Wrapper
 * Optimized for Spring Training with defensive checks.
 */

import * as fs from 'fs';

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
    score?: string;
}

export class MLBApi {
    private baseUrl = 'https://statsapi.mlb.com/api/v1';

    async getSchedule(date: string): Promise<MLBGame[]> {
        const url = `${this.baseUrl}/schedule?sportId=1&date=${date}&hydrate=team,lineups,probablePitcher,venue,linescore,boxscore`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.dates || data.dates.length === 0) return [];

        return Promise.all(data.dates[0].games.map(async (game: any) => {
            const homePitcher = game.teams.home.probablePitcher?.fullName;
            const awayPitcher = game.teams.away.probablePitcher?.fullName;
            const homeTeamName = (game.teams.home.team.name || "").trim();
            const awayTeamName = (game.teams.away.team.name || "").trim();
            
            const manualScore = await this.getManualScore(date, homeTeamName, awayTeamName);
            const liveScore = game.linescore ? `${game.teams.away.score}-${game.teams.home.score}` : undefined;

            return {
                gamePk: game.gamePk,
                homeTeam: homeTeamName,
                homeId: game.teams.home.team.id,
                awayTeam: awayTeamName,
                awayId: game.teams.away.team.id,
                venue: (game.venue.name || "").trim(),
                status: game.status.detailedState,
                date: game.gameDate,
                score: manualScore || liveScore,
                probables: {
                    home: homePitcher,
                    away: awayPitcher
                },
                lineups: {
                    home: game.lineups?.homePlayers?.map((p: any) => p.fullName) || [],
                    away: game.lineups?.awayPlayers?.map((p: any) => p.fullName) || []
                }
            };
        }));
    }

    /**
     * Fetch statistical leaders for a specific category (e.g., 'onBasePlusSlugging' or 'earnedRunAverage').
     */
    async getLeaders(category: string, group: 'hitting' | 'pitching', gameType: string = 'R'): Promise<string[]> {
        const lastSeason = new Date().getFullYear() - 1;
        const url = `${this.baseUrl}/stats/leaders?leaderCategories=${category}&statGroup=${group}&season=${lastSeason}&gameType=${gameType}&limit=10`;
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

            const parseHandedness = (teamData: any) => {
                let L = 0, R = 0, S = 0;
                if (teamData && teamData.lineup) {
                    teamData.lineup.forEach((id: number) => {
                        const player = teamData.players[`ID${id}`];
                        const batSide = player?.person?.batSide?.code || player?.batSide?.code;
                        if (batSide === 'L') L++;
                        if (batSide === 'R') R++;
                        if (batSide === 'S') S++;
                    });
                }
                return { L, R, S };
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
                lineupHandedness: {
                    home: parseHandedness(boxscore?.teams?.home),
                    away: parseHandedness(boxscore?.teams?.away)
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
    async getPlayerStats(personId: number, group: 'hitting' | 'pitching', season: string = (new Date().getFullYear() - 1).toString(), gameType: string = 'R'): Promise<any> {
        const url = `${this.baseUrl}/people/${personId}/stats?stats=statsSingleSeason&group=${group}&season=${season}&gameType=${gameType}`;
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
        const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const url = `${this.baseUrl}/people/search?names=${encodeURIComponent(cleanName)}`;
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
        const currentSeason = new Date().getFullYear().toString();
        const url = `${this.baseUrl}/stats/leaders?leaderCategories=onBasePlusSlugging&statGroup=hitting&season=${currentSeason}&gameType=R&teamId=${teamId}&limit=3`;
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
        const lastSeason = new Date().getFullYear() - 1;
        const url = `${this.baseUrl}/people/${personId}/stats?stats=statSplits&group=${group}&season=${lastSeason}&gameType=R&sitCodes=vl,vr`; // Fetch vs Left and vs Right splits
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
     * Fetch yesterday's bullpen usage (pitch count for non-starters).
     */
    async getYesterdaysBullpenUsage(teamId: number, today: string): Promise<number> {
        try {
            const yesterdayDate = new Date(new Date(today).getTime() - 86400000);
            const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
            const url = `${this.baseUrl}/schedule?sportId=1&date=${yesterdayStr}&teamId=${teamId}&hydrate=team,probablePitcher,linescore,boxscore`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (!data.dates || data.dates.length === 0 || data.dates[0].games.length === 0) return 0;
            
            const game = data.dates[0].games[0];
            const gamePk = game.gamePk;
            
            const feedUrl = `${this.baseUrl}/game/${gamePk}/feed/live`;
            const feedRes = await fetch(feedUrl);
            const feedData = await feedRes.json();
            
            const isHome = game.teams.home.team.id === teamId;
            const teamData = isHome ? feedData.liveData?.boxscore?.teams?.home : feedData.liveData?.boxscore?.teams?.away;
            const probables = feedData.gameData?.probablePitchers || {};
            const starterId = isHome ? probables.home?.id : probables.away?.id;
            
            if (!teamData || !teamData.players) return 0;
            
            let reliefPitches = 0;
            for (const [key, player] of Object.entries(teamData.players) as any) {
                const stats = player.stats?.pitching;
                if (stats && stats.numberOfPitches > 0 && player.person.id !== starterId) {
                    reliefPitches += stats.numberOfPitches;
                }
            }
            return reliefPitches;
        } catch (e) {
            console.error('Failed to fetch yesterday bullpen usage:', e);
            return 0;
        }
    }

    private cachedStandings: any = null;

    async getStandings(): Promise<any> {
        if (this.cachedStandings) return this.cachedStandings;
        const url = `${this.baseUrl}/standings?leagueId=103,104`;
        try {
            const response = await fetch(url);
            this.cachedStandings = await response.json();
            return this.cachedStandings;
        } catch (e) {
            return null;
        }
    }

    async getTeamForm(teamId: number): Promise<{ streak: string, l10: string, l10Wins: number }> {
        const standings = await this.getStandings();
        if (!standings || !standings.records) return { streak: '', l10: '', l10Wins: 0 };
        
        for (const record of standings.records) {
            for (const teamRecord of record.teamRecords) {
                if (teamRecord.team.id === teamId) {
                    const streak = teamRecord.streak?.streakCode || '';
                    const l10Obj = teamRecord.records?.splitRecords?.find((r: any) => r.type === 'lastTen');
                    const l10 = l10Obj ? `${l10Obj.wins}-${l10Obj.losses}` : '';
                    const l10Wins = l10Obj ? l10Obj.wins : 0;
                    return { streak, l10, l10Wins };
                }
            }
        }
        return { streak: '', l10: '', l10Wins: 0 };
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
        playerStats: Map<string, any>;
        platoonSplits: Map<string, any>;
        bullpenFatigue: { home: number, away: number };
        teamForm: { home: { streak: string, l10: string, l10Wins: number }, away: { streak: string, l10: string, l10Wins: number } };
    }> {
        const gamePk = game.gamePk;
        
        // 1. Details (Lineups + Weather + Probables)
        const details = await this.getGameDetails(gamePk) || { 
            probables: game.probables || {}, 
            lineups: game.lineups || { home: [], away: [] },
            lineupHandedness: { home: { L: 0, R: 0, S: 0 }, away: { L: 0, R: 0, S: 0 } }
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

        // 4. Dual-Stream Pitcher Stats (70/30 weighting logic)
        const playerStats = new Map<string, any>();
        const hProb = details.probables?.home;
        const aProb = details.probables?.away;

        const platoonSplits = new Map<string, any>();
        const fetchDualStats = async (name: string) => {
            if (!name) return;
            const id = await this.searchPerson(name);
            if (id) {
                const currentYear = new Date().getFullYear().toString();
                const lastYear = (new Date().getFullYear() - 1).toString();
                const [reg, spr, currentReg, splits] = await Promise.all([
                    this.getPlayerStats(id, 'pitching', lastYear, 'R'), // Avg Performance (Last Year)
                    this.getPlayerStats(id, 'pitching', currentYear, 'S'),  // Recent Performance (Spring Training)
                    this.getPlayerStats(id, 'pitching', currentYear, 'R'),  // Active Season Performance (Current Year)
                    this.getHandednessSplits(id, 'pitching')
                ]);
                playerStats.set(name, { regular: reg, spring: spr, currentRegular: currentReg });
                platoonSplits.set(name, splits);
            }
        };

        const todayDate = game.date.split('T')[0];
        const bullpenFatigue = { home: 0, away: 0 };
        const teamForm = { 
            home: { streak: '', l10: '', l10Wins: 0 }, 
            away: { streak: '', l10: '', l10Wins: 0 } 
        };
        
        await Promise.all([
            hProb ? fetchDualStats(hProb) : Promise.resolve(),
            aProb ? fetchDualStats(aProb) : Promise.resolve(),
            game.homeId ? this.getYesterdaysBullpenUsage(game.homeId, todayDate).then(p => bullpenFatigue.home = p) : Promise.resolve(),
            game.awayId ? this.getYesterdaysBullpenUsage(game.awayId, todayDate).then(p => bullpenFatigue.away = p) : Promise.resolve(),
            game.homeId ? this.getTeamForm(game.homeId).then(f => teamForm.home = f) : Promise.resolve(),
            game.awayId ? this.getTeamForm(game.awayId).then(f => teamForm.away = f) : Promise.resolve()
        ]);

        return {
            details,
            rosters,
            homeHot,
            awayHot,
            playerStats,
            platoonSplits,
            bullpenFatigue,
            teamForm,
            lineupHandedness: details.lineupHandedness || { home: { L: 0, R: 0, S: 0 }, away: { L: 0, R: 0, S: 0 } }
        };
    }

    /**
     * Check for manual score overrides (Data Integrity Guard)
     */
    async getManualScore(date: string, homeTeam: string, awayTeam: string): Promise<string | null> {
        try {
            // Extract YYYY-MM-DD from full date string if needed
            const simpleDate = date.split('T')[0];
            const path = '/Users/nicholasmacaskill/Downloads/bet-bodhi/data/2026_04_01_manual_scores.json';
            
            if (!fs.existsSync(path)) return null;
            
            const data = JSON.parse(fs.readFileSync(path, 'utf8'));
            const dateData = data[simpleDate];
            if (!dateData) return null;
            
            // Search for the match
            for (const [match, score] of Object.entries(dateData)) {
                if (match.toLowerCase().includes(homeTeam.toLowerCase()) || match.toLowerCase().includes(awayTeam.toLowerCase())) {
                    return score as string;
                }
            }
            return null;
        } catch (e) {
            return null;
        }
    }
}
