import 'dotenv/config';
import { Wallet } from 'ethers';

async function main() {
    const proxy = process.env.POLY_PROXY_ADDRESS;
    const wallet = new Wallet(process.env.WALLET_PRIVATE_KEY || "");
    const eoa = wallet.address;

    console.log(`Querying Polymarket positions for Proxy: ${proxy} and EOA: ${eoa}`);

    const addresses = [proxy, eoa].filter(Boolean) as string[];

    for (const addr of addresses) {
        console.log(`\nAddress: ${addr}`);
        try {
            const url = `https://data-api.polymarket.com/positions?user=${addr}`;
            const res = await fetch(url);
            if (!res.ok) {
                console.error(`Failed to fetch for ${addr}: Status ${res.status}`);
                continue;
            }
            const positions = await res.json();
            console.log(`Found ${positions.length} positions.`);
            for (const pos of positions) {
                // Filter only active positions (size > 0)
                const size = parseFloat(pos.size || "0");
                if (size > 0) {
                    console.log(JSON.stringify(pos, null, 2));
                }
            }
        } catch (e: any) {
            console.error(`Error fetching positions for ${addr}:`, e.message);
        }
    }
}

main().catch(console.error);
