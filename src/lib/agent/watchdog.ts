import * as fs from 'fs';
import * as path from 'path';
import { MLBApi } from '../mlb-api';

export class BodhiWatchdog {
    private mlb = new MLBApi();
    private snapshotPath = path.join(process.cwd(), 'data', 'active_slate.json');

    /**
     * Compare the current live game status against the nightly snapshot.
     * Returns a list of veto messages if conditions have changed.
     */
    async checkForChanges(): Promise<string[]> {
        if (!fs.existsSync(this.snapshotPath)) {
            console.log("No active slate snapshot found. Skipping watchdog check.");
            return [];
        }

        let snapshot;
        try {
            snapshot = JSON.parse(fs.readFileSync(this.snapshotPath, 'utf8'));
        } catch (e) {
            console.error("Failed to parse active slate snapshot:", e);
            return [];
        }

        const vetos: string[] = [];

        for (const game of snapshot) {
            // Only monitor significant games (Alpha > 7.5 or clear value)
            if (game.unifiedAlpha < 7.5 && game.valueTeam === 'NEUTRAL') continue;

            const liveDetails = await this.mlb.getGameDetails(game.gamePk);
            if (!liveDetails) continue;

            const homeTeam = game.homeTeam;
            const awayTeam = game.awayTeam;

            // 1. Pitcher Scratch Detection
            const liveHomePitcher = liveDetails.probables?.home;
            const liveAwayPitcher = liveDetails.probables?.away;

            // Normalize names for comparison
            const normalize = (n?: string) => n?.trim().toLowerCase() || "";

            if (game.homePitcher && liveHomePitcher && normalize(game.homePitcher) !== normalize(liveHomePitcher)) {
                vetos.push(`🚨 *VETO ALERT*: ${awayTeam} @ ${homeTeam}\nHome Pitcher change detected! Original: ${game.homePitcher} ➔ Now: ${liveHomePitcher}. The structural edge has shifted.`);
            }
            if (game.awayPitcher && liveAwayPitcher && normalize(game.awayPitcher) !== normalize(liveAwayPitcher)) {
                vetos.push(`🚨 *VETO ALERT*: ${awayTeam} @ ${homeTeam}\nAway Pitcher change detected! Original: ${game.awayPitcher} ➔ Now: ${liveAwayPitcher}. The structural edge has shifted.`);
            }

            // 2. Lineup Integrity Check
            // If lineups were expected but are now missing or heavily modified
            const snapshotLineupCount = (game.lineups?.home?.length || 0) + (game.lineups?.away?.length || 0);
            const liveLineupCount = (liveDetails.lineups?.home?.length || 0) + (liveDetails.lineups?.away?.length || 0);

            if (snapshotLineupCount > 0 && liveLineupCount === 0) {
                 vetos.push(`⚠️ *DATA DRIFT*: ${awayTeam} @ ${homeTeam}\nLineups have disappeared from the API feed. Proceed with caution as data integrity is degraded.`);
            }
        }

        return vetos;
    }
}
