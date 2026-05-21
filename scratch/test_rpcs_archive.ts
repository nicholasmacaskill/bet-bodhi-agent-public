import { ethers } from 'ethers';

const rpcs = [
    'https://polygon-rpc.com',
    'https://polygon.llamarpc.com',
    'https://polygon.gateway.tenderly.co',
    'https://polygon-mainnet.public.blastapi.io',
    'https://1rpc.io/matic',
    'https://polygon.drpc.org',
    'https://matic-mainnet.chainstacklabs.com'
];

async function main() {
    const proxyAddress = '0x98652277eb9f1164d121c207e7a620710072f6af';
    const USDC_BRIDGED = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const paddedProxy = ethers.zeroPadValue(proxyAddress, 32).toLowerCase();

    // Scan block 84,000,000 to 84,010,000 (roughly April 2026)
    const fromBlock = 84000000;
    const toBlock = 84010000;

    for (const rpc of rpcs) {
        console.log(`Testing RPC: ${rpc}...`);
        try {
            const provider = new ethers.JsonRpcProvider(rpc);
            const logs = await provider.getLogs({
                address: USDC_BRIDGED,
                fromBlock,
                toBlock,
                topics: [transferTopic, null, paddedProxy]
            });
            console.log(`  -> SUCCESS! Found ${logs.length} logs in block range.`);
            return;
        } catch (e: any) {
            console.log(`  -> Failed: ${e.message}`);
        }
    }
}

main().catch(console.error);
