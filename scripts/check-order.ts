import { ClobClient } from '@polymarket/clob-client';
import { Wallet, ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) throw new Error("No private key");

    const proxyAddress = process.env.POLY_PROXY_ADDRESS;
    const wallet = new Wallet(privateKey, provider);

    const signerAdapter: any = {
        getAddress: async () => wallet.address,
        signMessage: async (message: string) => wallet.signMessage(message),
        _signTypedData: async (domain: any, types: any, value: any) => wallet.signTypedData(domain, types, value),
        connect: () => signerAdapter
    };

    const creds = { key: process.env.POLY_API_KEY!, secret: process.env.POLY_SECRET!, passphrase: process.env.POLY_PASSPHRASE! };
    const client = new ClobClient('https://clob.polymarket.com', 137, signerAdapter, creds, proxyAddress ? 1 : undefined, proxyAddress);

    try {
        const order = await client.getOrder('0xba5d2e60b0652f902aaf1927d018a763d355e742ca77c0119ac18ead90c98a91');
        console.log('Order Status Payload:\n-------------------');
        console.log(JSON.stringify(order, null, 2));
    } catch (e: any) {
        console.log('Error fetching order:', e.message);
    }
}
run();
