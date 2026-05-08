import { MLBApi } from '../src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const id = await mlb.searchPerson('Aaron Judge');
    console.log('Aaron Judge ID:', id);

    if (id) {
        const splits = await mlb.getHandednessSplits(id, 'hitting');
        console.log('Handedness Splits:', JSON.stringify(splits, null, 2));
    }
}

main();
