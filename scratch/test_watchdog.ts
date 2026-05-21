import { BodhiWatchdog } from '../src/lib/agent/watchdog';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const watchdog = new BodhiWatchdog();
    console.log("Testing Watchdog with current data...");
    const vetos = await watchdog.checkForChanges();
    console.log("Vetos found:", vetos);

    // Mock a change
    console.log("\nMocking a pitcher change...");
    const snapshotPath = path.join(process.cwd(), 'data', 'active_slate.json');
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    if (snapshot.length > 0) {
        snapshot[0].homePitcher = "Fake Pitcher Name";
        fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
        const newVetos = await watchdog.checkForChanges();
        console.log("Vetos found after mock:", newVetos);
    }
}
main();
