import { KBOApi } from '../src/lib/kbo-api';

async function test() {
    const baseUrl = 'https://www.koreabaseball.com/ws';
    const months = ["05", "5"];
    const srIds = ["1", "1,3,4,5,7"];

    for (const month of months) {
        for (const srId of srIds) {
            console.log(`Trying month: ${month}, srIdList: ${srId}`);
            const response = await fetch(`${baseUrl}/Schedule.asmx/GetScheduleList`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leId: 1,
                    srIdList: srId,
                    seasonId: "2026",
                    gameMonth: month,
                    teamId: ""
                })
            });

            const data = await response.json();
            const list = data.d || [];
            console.log(`Result: ${list.length} games`);
        }
    }
}

test();
