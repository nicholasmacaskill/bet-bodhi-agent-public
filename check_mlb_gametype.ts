async function main() {
    const date = '2026-03-11';
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.dates && data.dates.length > 0) {
        data.dates[0].games.forEach((g: any) => {
            console.log(`${g.teams.away.team.name} @ ${g.teams.home.team.name} | Type: ${g.gameType} | Status: ${g.status.detailedState}`);
        });
    }
}
main();
