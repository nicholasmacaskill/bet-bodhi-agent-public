import * as dotenv from 'dotenv';
dotenv.config({ path: '/Users/nicholasmacaskill/Downloads/bet-bodhi/.env' });

import { Wallet, ethers } from 'ethers';

async function main() {
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
        console.error("Missing WALLET_PRIVATE_KEY");
        return;
    }

    const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
    const wallet = new Wallet(privateKey, provider);
    const proxyAddress = process.env.POLY_PROXY_ADDRESS;

    console.log("🔍 RUNNING WALLET DIAGNOSTICS...");
    console.log(`EOA (Wallet Address): ${wallet.address}`);
    console.log(`Proxy Address:        ${proxyAddress || "Not configured"}`);

    const addressesToCheck = [
        { name: "EOA (Wallet)", address: wallet.address },
        ...(proxyAddress ? [{ name: "Proxy", address: proxyAddress }] : [])
    ];

    // Token Addresses on Polygon
    const USDC_E = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // Bridged USDC (Polymarket collateral)
    const USDC_NATIVE = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359"; // Native USDC

    const tokenAbi = ["function balanceOf(address account) view returns (uint256)", "function decimals() view returns (uint8)"];
    const usdceContract = new ethers.Contract(USDC_E, tokenAbi, provider);
    const usdcNativeContract = new ethers.Contract(USDC_NATIVE, tokenAbi, provider);

    for (const addr of addressesToCheck) {
        console.log(`\n--- Checking ${addr.name}: ${addr.address} ---`);
        try {
            // 1. Check Native POL
            const polBalance = await provider.getBalance(addr.address);
            console.log(`  Native POL (Gas):  ${ethers.formatEther(polBalance)} POL`);

            // 2. Check USDC.e
            const usdceBal = await usdceContract.balanceOf(addr.address);
            console.log(`  USDC.e (Bridged):  $${ethers.formatUnits(usdceBal, 6)}`);

            // 3. Check Native USDC
            const usdcNativeBal = await usdcNativeContract.balanceOf(addr.address);
            console.log(`  USDC (Native):     $${ethers.formatUnits(usdcNativeBal, 6)}`);
        } catch (e: any) {
            console.error(`  Error checking ${addr.name}: ${e.message}`);
        }
    }
}

main().catch(console.error);
