
import { MLBApi } from './src/lib/mlb-api';

async function main() {
    const api = new MLBApi();
    const name = "Cincinnati Reds";

    try {
        const schedule = await api.getSchedule('2026-03-26');
        const game = schedule.find(g => g.homeTeam.includes(name) || g.awayTeam.includes(name));
        
        if (game) {
            const teamId = game.homeTeam.includes(name) ? game.homeId : game.awayId;
            if (teamId) {
                console.log(`Team ID for ${name}: ${teamId}`);
                const hot = await api.getHotBats(teamId);
                console.log(`Hot Bats: ${hot.join(', ')}`);
                
                const roster = await api.getTeamRoster(teamId);
                console.log(`Active Roster (${roster.length} players): ${roster.slice(0, 10).join(', ')}...`);
            }
        }

    } catch (e: any) {
        console.error("Failed to check Reds stats:", e.message);
    }
}

main();
