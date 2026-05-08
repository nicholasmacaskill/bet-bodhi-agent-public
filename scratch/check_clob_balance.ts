
import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function checkClobBalance() {
    const poly = new PolymarketApi();
    const proxy = process.env.POLY_PROXY_ADDRESS;
    
    const client: any = await (poly as any).initClient();
    
    console.log(`Checking CLOB balance for Proxy: ${proxy}`);
    const balance = await client.getCollateralBalance(proxy);
    console.log(`Proxy CLOB Balance: $${balance}`);
}

checkClobBalance().catch(console.error);
