import { Wallet, ethers } from 'ethers';
import 'dotenv/config';

async function main() {
    const { ClobClient } = await import('@polymarket/clob-client');
    
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
        console.error("Missing WALLET_PRIVATE_KEY");
        return;
    }

    const wallet = new Wallet(privateKey);
    console.log(`EOA Address: ${wallet.address}`);

    const signerAdapter: any = {
        getAddress: async () => wallet.address,
        signMessage: async (message: string | Uint8Array) => wallet.signMessage(typeof message === 'string' ? message : ethers.hexlify(message)),
        _signTypedData: async (domain: any, types: any, value: any) => {
            const { EIP712Domain, ...restTypes } = types;
            return await wallet.signTypedData(domain, restTypes, value);
        },
        connect: () => signerAdapter
    };

    const credentials = (process.env.POLY_API_KEY && process.env.POLY_SECRET) ? {
        key: process.env.POLY_API_KEY,
        secret: process.env.POLY_SECRET,
        passphrase: process.env.POLY_PASSPHRASE || ""
    } : undefined;

    const proxyAddress = process.env.POLY_PROXY_ADDRESS;
    console.log(`Using Proxy: ${proxyAddress}`);

    console.log("Initializing ClobClient...");
    const client = new ClobClient(
        'https://clob.polymarket.com',
        137,
        signerAdapter,
        credentials as any,
        proxyAddress ? 1 : undefined,
        proxyAddress
    );

    // Let's print out all available methods on client to see what we can use to check balance
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client));
    console.log("\nAvailable ClobClient methods:", methods);

    try {
        console.log("\nChecking getCollateralBalance...");
        const balance = await client.getCollateralBalance();
        console.log("Collateral Balance:", balance);
    } catch (e: any) {
        console.error("Failed getCollateralBalance:", e.message);
    }

    try {
        console.log("\nChecking getBalances...");
        // getBalances might require a token address or be a general call
        if (typeof (client as any).getBalances === 'function') {
            const balances = await (client as any).getBalances();
            console.log("Balances:", balances);
        }
    } catch (e: any) {
        console.error("Failed getBalances:", e.message);
    }

    try {
        console.log("\nChecking getAccountInfo / getProfile...");
        // Check for other potential profile/account methods
        const checkMethods = ["getAccount", "getProfile", "getMarginSummary", "getTradingBalance"];
        for (const m of checkMethods) {
            if (typeof (client as any)[m] === 'function') {
                console.log(`Calling ${m}...`);
                const res = await (client as any)[m]();
                console.log(`${m} Result:`, res);
            }
        }
    } catch (e: any) {
        console.error("Failed account check:", e.message);
    }
}

main().catch(console.error);
