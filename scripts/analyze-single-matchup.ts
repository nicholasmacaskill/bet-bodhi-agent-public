import 'dotenv/config';
import { MLBApi } from '../src/lib/mlb-api';
import { OddsApi } from '../src/lib/odds-api';
import { PillarAnalyzer } from '../src/lib/pillar-analyzer';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function analyzeMatchup(teamQuery: string) {
    const mlb = new MLBApi();
    const oddsSvc = new OddsApi();
    const polyApi = new PolymarketApi();
    const analyzer = new PillarAnalyzer();
    const date = new Date().toISOString().split('T')[0];

    console.log(`\n🔍 DEEP DIVE ANALYSIS: ${teamQuery.toUpperCase()} Matchup`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
        const schedule = await mlb.getSchedule(date);
        const game = schedule.find(g => 
            g.homeTeam.toLowerCase().includes(teamQuery.toLowerCase()) || 
            g.awayTeam.toLowerCase().includes(teamQuery.toLowerCase())
        );

        if (!game) {
            console.log(`❌ No game found for "${teamQuery}" on ${date}`);
            return;
        }

        console.log(`📍 Found: ${game.awayTeam} @ ${game.homeTeam}`);

        // 1. Fetch Detailed Rosters & Probables
        const details = await mlb.getGameDetails(game.gamePk);
        const homeRosterList = game.homeId ? await mlb.getTeamRoster(game.homeId) : [];
        const awayRosterList = game.awayId ? await mlb.getTeamRoster(game.awayId) : [];

        // 2. Fetch Starter Stats & Hot Bats
        const homeStarterName = details?.probables?.home || game.probables?.home;
        const awayStarterName = details?.probables?.away || game.probables?.away;

        const [homeStarterId, awayStarterId, homeHotBats, awayHotBats] = await Promise.all([
            homeStarterName ? mlb.searchPerson(homeStarterName) : Promise.resolve(null),
            awayStarterName ? mlb.searchPerson(awayStarterName) : Promise.resolve(null),
            game.homeId ? mlb.getHotBats(game.homeId) : Promise.resolve([]),
            game.awayId ? mlb.getHotBats(game.awayId) : Promise.resolve([])
        ]);

        const [homeStarterStats, awayStarterStats, homeStarterBio, awayStarterBio] = await Promise.all([
            homeStarterId ? mlb.getPlayerStats(homeStarterId, 'pitching', '2024') : Promise.resolve(null), // Use 2024 for better baseline
            awayStarterId ? mlb.getPlayerStats(awayStarterId, 'pitching', '2024') : Promise.resolve(null),
            homeStarterId ? mlb.getPersonDetails(homeStarterId) : Promise.resolve(null),
            awayStarterId ? mlb.getPersonDetails(awayStarterId) : Promise.resolve(null)
        ]);

        const homeStarterInfo = { 
            name: homeStarterName || 'TBD', 
            note: homeStarterStats ? `${homeStarterBio?.pitchHand?.code}HP | 2024 ERA: ${homeStarterStats.era}` : "Spring Rotation: TBD" 
        };
        const awayStarterInfo = { 
            name: awayStarterName || 'TBD', 
            note: awayStarterStats ? `${awayStarterBio?.pitchHand?.code}HP | 2024 ERA: ${awayStarterStats.era}` : "Travel Squad: TBD" 
        };

        // 3. Fetch Market Data
        const [oddsList, polyMarket] = await Promise.all([
            oddsSvc.getOdds('baseball_mlb_preseason'),
            polyApi.getMarketByTeams(game.homeTeam, game.awayTeam)
        ]);

        // 4. Run Pillar Analysis
        const analysis = analyzer.analyzeGame(
            game, 
            details || { lineups: { home: [], away: [] }, probables: game.probables }, 
            polyMarket || undefined,
            [], 
            [], 
            new Map(),
            1000, 
            "sharp",
            8,
            { home: homeRosterList, away: awayRosterList }
        );

        // 5. Output Detailed Format (SIDE-BY-SIDE ANALYTICS)
        const deepDive = {
            matchup: `${game.awayTeam} @ ${game.homeTeam}`,
            startTime: game.date,
            venue: game.venue,
            weather: details?.weather ? `${details.weather.temp}°F, ${details.weather.condition} | ${details.weather.wind}` : "Indoor/Cloudy",
            starterBattle: {
                home: homeStarterInfo,
                away: awayStarterInfo
            },
            bullpenHealth: {
                home: `Depth: ${homeRosterList.length} active. Key arms available for late-game splits.`,
                away: `Depth: ${awayRosterList.length} active. Standard spring distribution.`
            },
            teamBreakdown: {
                home: {
                    name: game.homeTeam,
                    resonance: homeHotBats.length > 0 ? `Hot Bats (OPS): ${homeHotBats.join(', ')}` : "High technical floor.",
                    advantage: analysis.advantages?.find(a => a.includes("Cactus") || a.includes("Grapefruit")) || "Neutral venue advantage."
                },
                away: {
                    name: game.awayTeam,
                    resonance: awayHotBats.length > 0 ? `Hot Bats (OPS): ${awayHotBats.join(', ')}` : "Travel roster depth.",
                    advantage: (analysis.advantages && analysis.advantages.length > 1) ? analysis.advantages[1] : "Standard rotation depth."
                }
            },
            killCriteria: analysis.killCriteria || ["ABORT IF: Starter scratch or bullpen notification."],
            pillarAnalysis: analysis
        };

        console.log("DEEP_DIVE_START");
        console.log(JSON.stringify(deepDive, null, 2));
        console.log("DEEP_DIVE_END");

    } catch (error: any) {
        console.error(`Analysis failed: ${error.message}`);
    }
}

const teamName = process.argv[2];
if (!teamName) {
    console.error("Usage: npx tsx scripts/analyze-single-matchup.ts (team_name)");
    process.exit(1);
}

analyzeMatchup(teamName);
