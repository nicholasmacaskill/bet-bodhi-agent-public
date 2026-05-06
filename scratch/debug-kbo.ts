import { KBOApi } from '../src/lib/kbo-api';

async function test() {
    const baseUrl = 'https://www.koreabaseball.com/ws';
    const date = '2026-05-06';
    const year = '2026';
    const month = '05';

    console.log(`Manually calling KBO API for ${year}-${month}...`);
    const response = await fetch(`${baseUrl}/Schedule.asmx/GetScheduleList`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            leId: 1,
            srIdList: "1,3,4,5,7",
            seasonId: year,
            gameMonth: month,
            teamId: ""
        })
    });

    const data = await response.json();
    const list = data.d || [];
    console.log(`Total games in May: ${list.length}`);
    if (list.length > 0) {
        console.log(`First game ID: ${list[0].G_ID}`);
        console.log(`Last game ID: ${list[list.length - 1].G_ID}`);
        
        const dayStr = date.replace(/-/g, '');
        const match = list.find((g: any) => g.G_ID.startsWith(dayStr));
        console.log(`Found match for ${dayStr}? ${!!match}`);
        if (match) console.log(JSON.stringify(match));
    }
}

test();
