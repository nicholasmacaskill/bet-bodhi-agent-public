import { Wallet, ethers } from 'ethers';
import 'dotenv/config';

async function main() {
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
        console.error("Missing WALLET_PRIVATE_KEY in .env");
        return;
    }

    const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
    const wallet = new Wallet(privateKey, provider);
    const eoaAddress = wallet.address;
    const proxyAddress = process.env.POLY_PROXY_ADDRESS;

    console.log(`EOA Address:   ${eoaAddress}`);
    console.log(`Proxy Address: ${proxyAddress || 'None configured'}`);

    // USDC contracts on Polygon
    const USDC_BRIDGED = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC.e
    const USDC_NATIVE  = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // USDC

    const erc20Abi = [
        "function balanceOf(address account) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
    ];

    async function checkToken(contractAddress: string, ownerAddress: string) {
        try {
            const contract = new ethers.Contract(contractAddress, erc20Abi, provider);
            const [balance, decimals, symbol] = await Promise.all([
                contract.balanceOf(ownerAddress),
                contract.decimals(),
                contract.symbol()
            ]);
            return {
                symbol,
                balance: parseFloat(ethers.formatUnits(balance, decimals))
            };
        } catch (e: any) {
            return { symbol: "Error", balance: 0, error: e.message };
        }
    }

    async function checkAddress(addr: string, label: string) {
        console.log(`\nChecking ${label} (${addr}):`);
        try {
            const maticBal = await provider.getBalance(addr);
            console.log(`  - Gas (POL/MATIC): ${parseFloat(ethers.formatEther(maticBal)).toFixed(4)}`);
        } catch (e: any) {
            console.log(`  - Gas Check Error: ${e.message}`);
        }

        const bridged = await checkToken(USDC_BRIDGED, addr);
        console.log(`  - Bridged USDC.e (${USDC_BRIDGED}): ${bridged.balance.toFixed(2)} ${bridged.symbol}`);

        const native = await checkToken(USDC_NATIVE, addr);
        console.log(`  - Native USDC (${USDC_NATIVE}): ${native.balance.toFixed(2)} ${native.symbol}`);
    }

    await checkAddress(eoaAddress, "EOA");
    if (proxyAddress) {
        await checkAddress(proxyAddress, "Proxy");
    }
}

main().catch(console.error);
