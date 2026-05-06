import 'dotenv/config';
import { MLBApi } from '../src/lib/mlb-api';
import { NHLApi } from '../src/lib/nhl-api';
import { NBAApi } from '../src/lib/nba-api';
import { OddsApi } from '../src/lib/odds-api';
import { PillarAnalyzer } from '../src/lib/pillar-analyzer';
import { NHLPillarAnalyzer } from '../src/lib/nhl-pillar-analyzer';
import { NBAPillarAnalyzer } from '../src/lib/nba-pillar-analyzer';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function analyzeMatchup(teamQuery: string, overrideDate?: string) {
    const mlb = new MLBApi();
    const nhl = new NHLApi();
    const nba = new NBAApi();
    const oddsSvc = new OddsApi();
    const polyApi = new PolymarketApi();
    
    const mlbAnalyzer = new PillarAnalyzer();
    const nhlAnalyzer = new NHLPillarAnalyzer();
    const nbaAnalyzer = new NBAPillarAnalyzer();
    
    const date = overrideDate || new Date().toISOString().split('T')[0];

    console.log(`\n🔍 DEEP DIVE ANALYSIS: ${teamQuery.toUpperCase()} Matchup`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
        // 1. Discover Sport & Game
        const nbaDate = date.replace(/-/g, '');
        const [mlbSchedule, nhlSchedule, nbaSchedule] = await Promise.all([
            mlb.getSchedule(date),
            nhl.getSchedule(date),
            nba.getSchedule(nbaDate)
        ]);

        const mlbGame = mlbSchedule.find(g => 
            g.homeTeam.toLowerCase().includes(teamQuery.toLowerCase()) || 
            g.awayTeam.toLowerCase().includes(teamQuery.toLowerCase())
        );
        const nhlGame = nhlSchedule.find(g => 
            g.homeTeam.toLowerCase().includes(teamQuery.toLowerCase()) || 
            g.awayTeam.toLowerCase().includes(teamQuery.toLowerCase())
        );
        const nbaGame = nbaSchedule.find(g => 
            g.homeTeam.toLowerCase().includes(teamQuery.toLowerCase()) || 
            g.awayTeam.toLowerCase().includes(teamQuery.toLowerCase())
        );

        if (mlbGame) {
            await handleMLB(mlbGame, mlb, mlbAnalyzer, oddsSvc, polyApi);
        } else if (nhlGame) {
            await handleNHL(nhlGame, nhl, nhlAnalyzer, polyApi);
        } else if (nbaGame) {
            await handleNBA(nbaGame, nba, nbaAnalyzer, polyApi);
        } else {
            console.log(`❌ No game found for "${teamQuery}" on ${date} (MLB, NHL, or NBA)`);
            return;
        }

    } catch (error: any) {
        console.error(`Analysis failed: ${error.message}`);
    }
}

async function handleMLB(game: any, api: MLBApi, analyzer: PillarAnalyzer, oddsSvc: OddsApi, polyApi: PolymarketApi) {
    console.log(`📍 Found MLB: ${game.awayTeam} @ ${game.homeTeam}`);
    
    const { details, rosters, homeHot, awayHot, playerStats } = await api.getHydratedAnalysisData(game);
    const combinedHot = [...homeHot, ...awayHot];

    const [oddsList, polyMarket] = await Promise.all([
        oddsSvc.getOdds('baseball_mlb_preseason'),
        polyApi.getMarketByTeams(game.homeTeam, game.awayTeam)
    ]);

    const homeStarterName = details?.probables?.home || game.probables?.home;
    const awayStarterName = details?.probables?.away || game.probables?.away;

    const [homeStarterId, awayStarterId] = await Promise.all([
        api.searchPerson(homeStarterName || ""),
        api.searchPerson(awayStarterName || ""),
    ]);

    const [homeStarterStats, awayStarterStats, homeStarterBio, awayStarterBio] = await Promise.all([
        homeStarterId ? api.getPlayerStats(homeStarterId, 'pitching', '2024') : Promise.resolve(null),
        awayStarterId ? api.getPlayerStats(awayStarterId, 'pitching', '2024') : Promise.resolve(null),
        homeStarterId ? api.getPersonDetails(homeStarterId) : Promise.resolve(null),
        awayStarterId ? api.getPersonDetails(awayStarterId) : Promise.resolve(null)
    ]);

    const analysis = analyzer.analyzeGame(
        game, 
        details || { lineups: { home: [], away: [] }, probables: game.probables }, 
        polyMarket || undefined,
        combinedHot,
        [], 
        playerStats,
        464, 
        rosters
    );

    const deepDive = {
        sport: 'MLB',
        matchup: `${game.awayTeam} @ ${game.homeTeam}`,
        startTime: game.date,
        venue: game.venue,
        weather: details?.weather ? `${details.weather.temp}°F, ${details.weather.condition} | ${details.weather.wind}` : "Indoor/Cloudy",
        starterBattle: {
            home: { name: homeStarterName || 'TBD', note: homeStarterStats ? `${homeStarterBio?.pitchHand?.code}HP | 2024 ERA: ${homeStarterStats.era}` : "Rotation: TBD" },
            away: { name: awayStarterName || 'TBD', note: awayStarterStats ? `${awayStarterBio?.pitchHand?.code}HP | 2024 ERA: ${awayStarterStats.era}` : "Rotation: TBD" }
        },
        teamBreakdown: {
            home: { name: game.homeTeam, resonance: `Hot Bats: ${homeHot.length > 0 ? homeHot.join(', ') : 'None'}` },
            away: { name: game.awayTeam, resonance: `Hot Bats: ${awayHot.length > 0 ? awayHot.join(', ') : 'None'}` }
        },
        pillarAnalysis: analysis
    };

    console.log("DEEP_DIVE_START");
    console.log(JSON.stringify(deepDive, null, 2));
    console.log("DEEP_DIVE_END");
}

async function handleNHL(game: any, api: NHLApi, analyzer: NHLPillarAnalyzer, polyApi: PolymarketApi) {
    console.log(`📍 Found NHL: ${game.awayTeam} @ ${game.homeTeam}`);
    
    const { teamStats, goalieLeaders } = await api.getHydratedAnalysisData();
    const polyMarket = await polyApi.getMarketByTeams(game.homeTeam, game.awayTeam);

    const analysis = analyzer.analyzeGame(game, teamStats, polyMarket || undefined, goalieLeaders, undefined, 464, "sharp", 8, 1.0);

    const deepDive = {
        sport: 'NHL',
        matchup: `${game.awayTeam} @ ${game.homeTeam}`,
        startTime: game.startTime,
        venue: game.venue || "TBD",
        pillarAnalysis: analysis
    };

    console.log("DEEP_DIVE_START");
    console.log(JSON.stringify(deepDive, null, 2));
    console.log("DEEP_DIVE_END");
}

async function handleNBA(game: any, api: NBAApi, analyzer: NBAPillarAnalyzer, polyApi: PolymarketApi) {
    console.log(`📍 Found NBA: ${game.awayTeam} @ ${game.homeTeam}`);
    
    const { nbaStats } = await api.getHydratedAnalysisData();
    const polyMarket = await polyApi.getMarketByTeams(game.homeTeam, game.awayTeam);

    const analysis = analyzer.analyzeGame(game, nbaStats, polyMarket || undefined, 464, "sharp", 8, 1.0);

    const deepDive = {
        sport: 'NBA',
        matchup: `${game.awayTeam} @ ${game.homeTeam}`,
        startTime: game.startTime,
        venue: game.venue || "TBD",
        pillarAnalysis: analysis
    };

    console.log("DEEP_DIVE_START");
    console.log(JSON.stringify(deepDive, null, 2));
    console.log("DEEP_DIVE_END");
}

const teamName = process.argv[2];
const dateOverride = process.argv[3];

if (!teamName) {
    console.log("Usage: npx tsx scripts/analyze-single-matchup.ts (team_name) [date]");
    process.exit(1);
}

analyzeMatchup(teamName, dateOverride);
