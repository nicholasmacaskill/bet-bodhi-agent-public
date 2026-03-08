
import { PillarAnalyzer } from '../src/lib/pillar-analyzer';

async function verifyRunLine() {
    const analyzer = new PillarAnalyzer();

    const mockGame = {
        gamePk: 12345,
        homeTeam: "Washington Nationals",
        awayTeam: "New York Yankees",
        sport_key: "baseball_mlb",
        venue: "CACTI Park",
        date: new Date().toISOString()
    };

    const mockDetails = {
        probables: { home: "Josiah Gray", away: "Will Warren" },
        lineups: {
            home: ["James Wood", "Dylan Crews", "CJ Abrams", "Brady House", " Luis García Jr."],
            away: ["Jasson Domínguez", "Spencer Jones", "Seth Brown"]
        }
    };

    // Mock Odds with spreads
    const mockOdds = [
        {
            home_team: "Washington Nationals",
            away_team: "New York Yankees",
            bookmakers: [{
                key: "draftkings",
                markets: [
                    {
                        key: "h2h",
                        outcomes: [
                            { name: "Washington Nationals", price: 1.65 },
                            { name: "New York Yankees", price: 2.25 }
                        ]
                    },
                    {
                        key: "spreads",
                        outcomes: [
                            { name: "Washington Nationals", price: 2.10, point: -1.5 },
                            { name: "New York Yankees", price: 1.75, point: 1.5 }
                        ]
                    }
                ]
            }]
        }
    ];

    console.log("--- TEST: Nationals High Disparity ---");
    // We need to inject "James Wood" and "Dylan Crews" as hot bats or elite bats to trigger the technical advantage
    // Actually, I'll just check if the analyzer picks up on the disparity.

    const analysis = analyzer.analyzeGame(mockGame, mockDetails, mockOdds);

    console.log("Confidence:", analysis.overallConfidence + "%");
    console.log("Action:", analysis.recommendedAction);
    if (analysis.runLineTeam) {
        console.log("RL Team:", analysis.runLineTeam);
        console.log("RL Odds:", analysis.runLineOdds);
        console.log("RL Point:", analysis.runLinePoint);
    } else {
        console.log("No Run Line detected.");
    }

    if (analysis.runLineTeam === "Washington Nationals" && analysis.runLinePoint === -1.5) {
        console.log("\n✅ SUCCESS: Run Line correctly identified for technical favorite.");
    } else {
        console.log("\n❌ FAILURE: Run Line logic did not trigger as expected.");
    }
}

verifyRunLine();
