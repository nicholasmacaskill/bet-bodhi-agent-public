
import { NHLApi } from '../../src/lib/nhl-api';

async function main() {
    const api = new NHLApi();
    const teamStats = await api.getTeamStats();
    
    const wsh = teamStats['Washington Capitals'];
    const ott = teamStats['Ottawa Senators'];
    
    console.log("WSH Stats:", wsh);
    console.log("OTT Stats:", ott);
    
    // Manual calculation from NHLPillarAnalyzer
    const hGFA = wsh.goalsForPerGame;
    const hGAA = wsh.goalsAgainstPerGame;
    const aGFA = ott.goalsForPerGame;
    const aGAA = ott.goalsAgainstPerGame;

    // From logs: C. Lindgren (0.886) and J. Reimer (0.882)
    // We need GAA. Assume ~3.2 based on SV%.
    const homeGAAMetric = 3.2; // WSH
    const awayGAAMetric = 3.3; // OTT

    const homeEdge = (hGFA - aGAA) + (aGAA - homeGAAMetric);
    const awayEdge = (aGFA - hGAA) + (hGAA - awayGAAMetric);
    const diff = homeEdge - awayEdge;
    
    console.log(`Home Edge (WSH): ${homeEdge}`);
    console.log(`Away Edge (OTT): ${awayEdge}`);
    console.log(`Diff: ${diff}`);
}

main();
