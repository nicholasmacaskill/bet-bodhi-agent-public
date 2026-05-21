import { Wallet, ethers } from 'ethers';
import 'dotenv/config';

async function main() {
    const { ClobClient } = await import('@polymarket/clob-client');
    const { AssetType } = await import('@polymarket/clob-client'); // In case it's exported there
    
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
        console.error("Missing WALLET_PRIVATE_KEY");
        return;
    }

    const wallet = new Wallet(privateKey);
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

    console.log("Initializing CLOB Client...");
    const client = new ClobClient(
        'https://clob.polymarket.com',
        137,
        signerAdapter,
        credentials as any,
        proxyAddress ? 1 : undefined,
        proxyAddress
    );

    try {
        console.log("Fetching balance allowance for COLLATERAL...");
        const res = await client.getBalanceAllowance({
            asset_type: "COLLATERAL" as any
        });
        console.log("COLLATERAL Balance Allowance Response:", res);
    } catch (error: any) {
        console.error("Error fetching COLLATERAL balance:", error.message);
    }
}

main().catch(console.error);
