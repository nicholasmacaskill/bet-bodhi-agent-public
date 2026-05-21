
import { PolymarketApi } from '../src/lib/polymarket-api';

async function testPolyKBO() {
    const poly = new PolymarketApi();
    const markets = await poly.getActiveSportsMarkets('KBO');
    console.log("Markets:", JSON.stringify(markets, null, 2));
}

testPolyKBO();
