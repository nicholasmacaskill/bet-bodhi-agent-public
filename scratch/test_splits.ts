async function inspectSplitStats() {
    const teamId = 147;
    const season = 2025;
    
    try {
        const hitRes = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=statSplits&group=hitting&season=${season}&sitCodes=ig07`);
        const hitData = await hitRes.json();
        const hitSplit = hitData.stats?.[0]?.splits?.[0]?.stat;
        console.log("Hitting split stat fields:", Object.keys(hitSplit || {}));
        console.log("Sample Hitting stat details:", JSON.stringify(hitSplit, null, 2));

        const pitchRes = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=statSplits&group=pitching&season=${season}&sitCodes=ig07`);
        const pitchData = await pitchRes.json();
        const pitchSplit = pitchData.stats?.[0]?.splits?.[0]?.stat;
        console.log("\nPitching split stat fields:", Object.keys(pitchSplit || {}));
        console.log("Sample Pitching stat details:", JSON.stringify(pitchSplit, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

inspectSplitStats();
