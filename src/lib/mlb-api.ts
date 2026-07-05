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
    series?: CurrentSeriesContext;
}

/** In-progress series between today's two teams (e.g. game 3 of 4, TEX leads 2-0). */
export interface CurrentSeriesContext {
    description: string;
    gameNumber: number;
    totalGames: number;
    leaderSide: 'home' | 'away' | 'tied' | null;
    leaderWins: number;
    trailerWins: number;
    result: string;
    isSeriesFinale: boolean;
}

/** Season-long head-to-head record between two clubs. */
export interface SeasonSeriesRecord {
    homeWins: number;
    awayWins: number;
    gamesPlayed: number;
    leaderSide: 'home' | 'away' | 'tied' | null;
}

export type PlayoffMotivationTier =
    | 'division_clinch'
    | 'division_race'
    | 'wildcard_bubble'
    | 'stay_alive'
    | 'clinched'
    | 'out_of_contention'
    | 'neutral';

/** Playoff-race motivation derived from live standings. */
export interface TeamPlayoffContext {
    tier: PlayoffMotivationTier;
    motivationBonus: number;
    reason: string;
    divisionLeader: boolean;
    clinched: boolean;
    divisionGamesBack: number | null;
    wildCardGamesBack: number | null;
}

export class MLBApi {
    private baseUrl = 'https://statsapi.mlb.com/api/v1';

    async getSchedule(date: string): Promise<MLBGame[]> {
        const url = `${this.baseUrl}/schedule?sportId=1&date=${date}&hydrate=team,lineups,probablePitcher,venue,linescore,boxscore,seriesStatus`;
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
                },
                series: this.parseCurrentSeriesContext(
                    game.teams.home.team.id,
                    game.teams.away.team.id,
                    game.seriesStatus,
                    game.seriesGameNumber,
                    game.gamesInSeries,
                    game.seriesDescription
                )
            };
        }));
    }

    private parseCurrentSeriesContext(
        homeId: number,
        awayId: number,
        seriesStatus: any,
        seriesGameNumber?: number,
        gamesInSeries?: number,
        seriesDescription?: string
    ): CurrentSeriesContext | undefined {
        const gameNumber = seriesStatus?.gameNumber ?? seriesGameNumber;
        const totalGames = seriesStatus?.totalGames ?? gamesInSeries;
        if (!gameNumber || !totalGames) return undefined;

        const winningId = seriesStatus?.winningTeam?.id;
        const leaderWins = seriesStatus?.wins ?? 0;
        const trailerWins = seriesStatus?.losses ?? 0;

        let leaderSide: CurrentSeriesContext['leaderSide'] = 'tied';
        if (winningId === homeId) leaderSide = 'home';
        else if (winningId === awayId) leaderSide = 'away';
        else if (leaderWins > trailerWins) leaderSide = null;

        return {
            description: seriesDescription || seriesStatus?.description || 'Regular Season',
            gameNumber,
            totalGames,
            leaderSide,
            leaderWins,
            trailerWins,
            result: seriesStatus?.result || '',
            isSeriesFinale: gameNumber === totalGames
        };
    }

    private parseGamesBack(value: string | undefined): number | null {
        if (!value || value === '-') return null;
        const cleaned = value.replace('+', '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
    }

    private seasonFromDate(dateStr: string): number {
        return new Date(dateStr).getFullYear();
    }

    async getSeasonSeriesRecord(
        homeId: number,
        awayId: number,
        season?: number,
        beforeDate?: string
    ): Promise<SeasonSeriesRecord> {
        const year = season ?? new Date().getFullYear();
        const url = `${this.baseUrl}/schedule?sportId=1&season=${year}&teamId=${homeId}&opponentId=${awayId}&gameType=R`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            const games: any[] = data.dates?.flatMap((d: any) => d.games) || [];
            let homeWins = 0;
            let awayWins = 0;
            const cutoff = beforeDate ? new Date(beforeDate).getTime() : null;

            for (const g of games) {
                if (g.status?.abstractGameState !== 'Final') continue;
                if (cutoff !== null && new Date(g.gameDate).getTime() >= cutoff) continue;
                const hs = g.teams.home.score ?? 0;
                const as = g.teams.away.score ?? 0;
                const homeWon = hs > as;
                const gameHomeId = g.teams.home.team.id;
                if (gameHomeId === homeId) {
                    if (homeWon) homeWins++;
                    else awayWins++;
                } else {
                    if (homeWon) awayWins++;
                    else homeWins++;
                }
            }

            let leaderSide: SeasonSeriesRecord['leaderSide'] = 'tied';
            if (homeWins > awayWins) leaderSide = 'home';
            else if (awayWins > homeWins) leaderSide = 'away';

            return { homeWins, awayWins, gamesPlayed: homeWins + awayWins, leaderSide };
        } catch {
            return { homeWins: 0, awayWins: 0, gamesPlayed: 0, leaderSide: 'tied' };
        }
    }

    async getTeamPlayoffContext(teamId: number, asOfDate?: string): Promise<TeamPlayoffContext> {
        const standings = await this.getStandings(asOfDate);
        const neutral: TeamPlayoffContext = {
            tier: 'neutral',
            motivationBonus: 0,
            reason: 'Mid-season positioning — no acute playoff pressure detected.',
            divisionLeader: false,
            clinched: false,
            divisionGamesBack: null,
            wildCardGamesBack: null
        };
        if (!standings?.records) return neutral;

        for (const record of standings.records) {
            for (const teamRecord of record.teamRecords) {
                if (teamRecord.team.id !== teamId) continue;

                const divisionLeader = teamRecord.divisionLeader === true || teamRecord.divisionRank === '1';
                const clinched = teamRecord.clinched === true;
                const divisionGamesBack = this.parseGamesBack(teamRecord.divisionGamesBack);
                const wildCardGamesBack = this.parseGamesBack(teamRecord.wildCardGamesBack);
                const magicNumber = teamRecord.magicNumber ? parseInt(teamRecord.magicNumber, 10) : null;
                const wcElim = teamRecord.wildCardEliminationNumber && teamRecord.wildCardEliminationNumber !== '-'
                    ? parseInt(teamRecord.wildCardEliminationNumber, 10)
                    : null;

                if (clinched) {
                    return {
                        tier: 'clinched',
                        motivationBonus: -2.0,
                        reason: `${teamRecord.team.name} has clinched — rest/lineup management risk elevated.`,
                        divisionLeader,
                        clinched,
                        divisionGamesBack,
                        wildCardGamesBack
                    };
                }

                if (divisionLeader && magicNumber !== null && magicNumber <= 12) {
                    return {
                        tier: 'division_clinch',
                        motivationBonus: 2.5,
                        reason: `${teamRecord.team.name} leads the division (magic #${magicNumber}) — division-clinch push.`,
                        divisionLeader,
                        clinched,
                        divisionGamesBack,
                        wildCardGamesBack
                    };
                }

                if (divisionGamesBack !== null && divisionGamesBack <= 2.5) {
                    return {
                        tier: 'division_race',
                        motivationBonus: 2.0,
                        reason: `${teamRecord.team.name} is ${divisionGamesBack} GB in the division — title-race urgency.`,
                        divisionLeader,
                        clinched,
                        divisionGamesBack,
                        wildCardGamesBack
                    };
                }

                if (wildCardGamesBack !== null && wildCardGamesBack <= 2.5) {
                    return {
                        tier: 'wildcard_bubble',
                        motivationBonus: 2.0,
                        reason: `${teamRecord.team.name} is ${wildCardGamesBack} GB of the Wild Card — must-win pressure.`,
                        divisionLeader,
                        clinched,
                        divisionGamesBack,
                        wildCardGamesBack
                    };
                }

                if (wcElim !== null && wcElim <= 12) {
                    return {
                        tier: 'stay_alive',
                        motivationBonus: 1.5,
                        reason: `${teamRecord.team.name} fighting to stay alive (WC elim. #${wcElim}).`,
                        divisionLeader,
                        clinched,
                        divisionGamesBack,
                        wildCardGamesBack
                    };
                }

                if (wildCardGamesBack !== null && wildCardGamesBack >= 8) {
                    return {
                        tier: 'out_of_contention',
                        motivationBonus: -1.5,
                        reason: `${teamRecord.team.name} is ${wildCardGamesBack} GB — playoff hopes fading.`,
                        divisionLeader,
                        clinched,
                        divisionGamesBack,
                        wildCardGamesBack
                    };
                }

                return {
                    ...neutral,
                    reason: `${teamRecord.team.name} in neutral playoff position.`,
                    divisionLeader,
                    divisionGamesBack,
                    wildCardGamesBack
                };
            }
        }
        return neutral;
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
    async getHotBats(teamId: number, season?: string): Promise<string[]> {
        const currentSeason = season ?? new Date().getFullYear().toString();
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

    private standingsCache = new Map<string, any>();

    async getStandings(asOfDate?: string): Promise<any> {
        const dateKey = asOfDate?.split('T')[0] || new Date().toISOString().split('T')[0];
        if (this.standingsCache.has(dateKey)) return this.standingsCache.get(dateKey);

        const season = this.seasonFromDate(dateKey);
        const url = `${this.baseUrl}/standings?leagueId=103,104&season=${season}&date=${dateKey}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            this.standingsCache.set(dateKey, data);
            return data;
        } catch (e) {
            return null;
        }
    }

    async getTeamForm(teamId: number, asOfDate?: string): Promise<{ streak: string, l10: string, l10Wins: number }> {
        const standings = await this.getStandings(asOfDate);
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
        lineupHandedness?: any;
        lateInningStats?: {
            home: { hittingOps: number, pitchingEra: number, pitchingOps: number };
            away: { hittingOps: number, pitchingEra: number, pitchingOps: number };
        };
        currentSeries?: CurrentSeriesContext;
        seasonSeries?: SeasonSeriesRecord;
        playoffContext?: { home: TeamPlayoffContext; away: TeamPlayoffContext };
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

        const todayDate = game.date.split('T')[0];
        const gameSeason = this.seasonFromDate(todayDate).toString();
        const gameSeasonNum = parseInt(gameSeason, 10);

        // 3. Hot Bats (Technical Signals)
        const [homeHotRaw, awayHotRaw] = await Promise.all([
            game.homeId ? this.getHotBats(game.homeId, gameSeason) : Promise.resolve([]),
            game.awayId ? this.getHotBats(game.awayId, gameSeason) : Promise.resolve([])
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
                const currentYear = gameSeason;
                const lastYear = (gameSeasonNum - 1).toString();
                const [reg, spr, currentReg, splits] = await Promise.all([
                    this.getPlayerStats(id, 'pitching', lastYear, 'R'),
                    this.getPlayerStats(id, 'pitching', currentYear, 'S'),
                    this.getPlayerStats(id, 'pitching', currentYear, 'R'),
                    this.getHandednessSplits(id, 'pitching')
                ]);
                playerStats.set(name, { regular: reg, spring: spr, currentRegular: currentReg });
                platoonSplits.set(name, splits);
            }
        };
        const bullpenFatigue = { home: 0, away: 0 };
        const teamForm = { 
            home: { streak: '', l10: '', l10Wins: 0 }, 
            away: { streak: '', l10: '', l10Wins: 0 } 
        };
        const lateInningStats = {
            home: { hittingOps: 0.720, pitchingEra: 4.00, pitchingOps: 0.720 },
            away: { hittingOps: 0.720, pitchingEra: 4.00, pitchingOps: 0.720 }
        };

        let seasonSeries: SeasonSeriesRecord | undefined;
        const playoffContext: { home: TeamPlayoffContext; away: TeamPlayoffContext } = {
            home: { tier: 'neutral', motivationBonus: 0, reason: '', divisionLeader: false, clinched: false, divisionGamesBack: null, wildCardGamesBack: null },
            away: { tier: 'neutral', motivationBonus: 0, reason: '', divisionLeader: false, clinched: false, divisionGamesBack: null, wildCardGamesBack: null }
        };
        
        await Promise.all([
            hProb ? fetchDualStats(hProb) : Promise.resolve(),
            aProb ? fetchDualStats(aProb) : Promise.resolve(),
            game.homeId ? this.getYesterdaysBullpenUsage(game.homeId, todayDate).then(p => bullpenFatigue.home = p) : Promise.resolve(),
            game.awayId ? this.getYesterdaysBullpenUsage(game.awayId, todayDate).then(p => bullpenFatigue.away = p) : Promise.resolve(),
            game.homeId ? this.getTeamForm(game.homeId, todayDate).then(f => teamForm.home = f) : Promise.resolve(),
            game.awayId ? this.getTeamForm(game.awayId, todayDate).then(f => teamForm.away = f) : Promise.resolve(),
            game.homeId ? this.getCompositeTeamLateSplits(game.homeId, todayDate).then(s => lateInningStats.home = s) : Promise.resolve(),
            game.awayId ? this.getCompositeTeamLateSplits(game.awayId, todayDate).then(s => lateInningStats.away = s) : Promise.resolve(),
            (game.homeId && game.awayId)
                ? this.getSeasonSeriesRecord(game.homeId, game.awayId, gameSeasonNum, todayDate).then(r => { seasonSeries = r; })
                : Promise.resolve(),
            game.homeId ? this.getTeamPlayoffContext(game.homeId, todayDate).then(c => { playoffContext.home = c; }) : Promise.resolve(),
            game.awayId ? this.getTeamPlayoffContext(game.awayId, todayDate).then(c => { playoffContext.away = c; }) : Promise.resolve()
        ]);
 
        details.lateInningStats = lateInningStats;

        return {
            details,
            rosters,
            homeHot,
            awayHot,
            playerStats,
            platoonSplits,
            bullpenFatigue,
            teamForm,
            lineupHandedness: details.lineupHandedness || { home: { L: 0, R: 0, S: 0 }, away: { L: 0, R: 0, S: 0 } },
            lateInningStats,
            currentSeries: game.series,
            seasonSeries,
            playoffContext
        };
    }

    /**
     * Fetch team-level late-inning splits (ig07 code: 7th inning or later)
     * for the current season, blending with last season if sample size is small.
     */
    async getCompositeTeamLateSplits(teamId: number, todayDateStr: string): Promise<{ hittingOps: number, pitchingEra: number, pitchingOps: number }> {
        const currentYear = new Date(todayDateStr).getFullYear().toString();
        const lastYear = (new Date(todayDateStr).getFullYear() - 1).toString();
        
        const currentUrlHit = `${this.baseUrl}/teams/${teamId}/stats?stats=statSplits&group=hitting&season=${currentYear}&sitCodes=ig07`;
        const currentUrlPitch = `${this.baseUrl}/teams/${teamId}/stats?stats=statSplits&group=pitching&season=${currentYear}&sitCodes=ig07`;
        
        const lastUrlHit = `${this.baseUrl}/teams/${teamId}/stats?stats=statSplits&group=hitting&season=${lastYear}&sitCodes=ig07`;
        const lastUrlPitch = `${this.baseUrl}/teams/${teamId}/stats?stats=statSplits&group=pitching&season=${lastYear}&sitCodes=ig07`;
        
        const parseVal = (val: any, fallback: number) => {
            if (val === undefined || val === null) return fallback;
            const parsed = parseFloat(val);
            return isNaN(parsed) ? fallback : parsed;
        };

        try {
            const [curHit, curPitch, lastHit, lastPitch] = await Promise.all([
                fetch(currentUrlHit).then(r => r.json()).catch(() => ({})),
                fetch(currentUrlPitch).then(r => r.json()).catch(() => ({})),
                fetch(lastUrlHit).then(r => r.json()).catch(() => ({})),
                fetch(lastUrlPitch).then(r => r.json()).catch(() => ({}))
            ]);
            
            const curHitStat = curHit.stats?.[0]?.splits?.[0]?.stat;
            const curPitchStat = curPitch.stats?.[0]?.splits?.[0]?.stat;
            
            const lastHitStat = lastHit.stats?.[0]?.splits?.[0]?.stat;
            const lastPitchStat = lastPitch.stats?.[0]?.splits?.[0]?.stat;
            
            const curGames = curHitStat?.gamesPlayed || 0;
            
            let hittingOps = 0.720;
            let pitchingEra = 4.00;
            let pitchingOps = 0.720;
            
            if (curGames >= 15) {
                hittingOps = parseVal(curHitStat.ops, 0.720);
                pitchingEra = parseVal(curPitchStat.era, 4.00);
                pitchingOps = parseVal(curPitchStat.ops, 0.720);
            } else if (lastHitStat && lastPitchStat) {
                if (curGames >= 5 && curHitStat && curPitchStat) {
                    const weight = curGames / 15;
                    hittingOps = (parseVal(curHitStat.ops, 0.720) * weight) + (parseVal(lastHitStat.ops, 0.720) * (1 - weight));
                    pitchingEra = (parseVal(curPitchStat.era, 4.00) * weight) + (parseVal(lastPitchStat.era, 4.00) * (1 - weight));
                    pitchingOps = (parseVal(curPitchStat.ops, 0.720) * weight) + (parseVal(lastPitchStat.ops, 0.720) * (1 - weight));
                } else {
                    hittingOps = parseVal(lastHitStat.ops, 0.720);
                    pitchingEra = parseVal(lastPitchStat.era, 4.00);
                    pitchingOps = parseVal(lastPitchStat.ops, 0.720);
                }
            } else if (curHitStat && curPitchStat) {
                hittingOps = parseVal(curHitStat.ops, 0.720);
                pitchingEra = parseVal(curPitchStat.era, 4.00);
                pitchingOps = parseVal(curPitchStat.ops, 0.720);
            }
            
            return { hittingOps, pitchingEra, pitchingOps };
        } catch (e) {
            console.error(`Failed to fetch composite late splits for team ${teamId}:`, e);
            return { hittingOps: 0.720, pitchingEra: 4.00, pitchingOps: 0.720 };
        }
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
