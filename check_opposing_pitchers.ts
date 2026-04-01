
import { MLBApi } from './src/lib/mlb-api';

const pitchers = [
    { name: "Freddy Peralta", team: "Mets" },
    { name: "Shane Smith", team: "White Sox" },
    { name: "Matthew Boyd", team: "Cubs" },
    { name: "Joe Ryan", team: "Twins" },
    { name: "Garrett Crochet", team: "Red Sox" },
    { name: "Hunter Brown", team: "Astros" },
    { name: "Nick Pivetta", team: "Padres" },
    { name: "Matthew Liberatore", team: "Cardinals" },
    { name: "Zac Gallen", team: "D-backs" },
    { name: "Tanner Bibee", team: "Guardians" }
];

async function main() {
    const mlb = new MLBApi();
    const results = [];

    for (const p of pitchers) {
        const id = await mlb.searchPerson(p.name);
        if (id) {
            const stats = await mlb.getPlayerStats(id, 'pitching', '2026');
            results.push({ ...p, stats: stats || { era: "N/A", whip: "N/A" } });
        } else {
            results.push({ ...p, stats: { era: "N/A", whip: "N/A" } });
        }
    }

    console.log(JSON.stringify(results, null, 2));
}

main();
