
import 'dotenv/config';
import { Wallet, ethers } from 'ethers';

async function checkBalances() {
    const rpcs = [
        'https://polygon-bor-rpc.publicnode.com',
        'https://rpc-mainnet.maticvigil.com'
    ];
    
    const proxy = process.env.POLY_PROXY_ADDRESS;
    const wallet = new Wallet(process.env.WALLET_PRIVATE_KEY || "");
    const eoa = wallet.address;
    
    const tokens = [
        { name: "USDC.e", addr: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" },
        { name: "USDC Native", addr: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" }
    ];
    
    const abi = ["function balanceOf(address account) view returns (uint256)", "function decimals() view returns (uint8)"];

    for (const rpc of rpcs) {
        try {
            console.log(`\nTesting RPC: ${rpc}`);
            const provider = new ethers.JsonRpcProvider(rpc);
            
            for (const t of tokens) {
                const contract = new ethers.Contract(t.addr, abi, provider);
                if (proxy) {
                    const pb = await contract.balanceOf(proxy);
                    const pd = await contract.decimals();
                    console.log(`Proxy (${proxy}) ${t.name}: $${ethers.formatUnits(pb, pd)}`);
                }
                const eb = await contract.balanceOf(eoa);
                const ed = await contract.decimals();
                console.log(`EOA (${eoa}) ${t.name}: $${ethers.formatUnits(eb, ed)}`);
            }
        } catch (e: any) {
            console.log(`RPC ${rpc} failed: ${e.message}`);
        }
    }
}

checkBalances().catch(console.error);
