import { Wallet, ethers } from 'ethers';

export class SxBetApi {
    private apiUrl = 'https://api.sx.bet';

    /**
     * Fetches active markets from SX Bet.
     */
    async getActiveMarkets() {
        const res = await fetch(`${this.apiUrl}/markets/active`);
        const data = await res.json();
        return data.data?.markets || [];
    }

    /**
     * Fetches the wallet balance for the configured wallet on SX Network.
     */
    async getBalance(): Promise<number> {
        const privateKey = process.env.WALLET_PRIVATE_KEY;
        if (!privateKey || privateKey === 'your_private_key_here') return 0;

        try {
            const provider = new ethers.JsonRpcProvider('https://rpc.sx.technology');
            const wallet = new Wallet(privateKey, provider);

            // Fetch native SX balance
            const balance = await provider.getBalance(wallet.address);
            return parseFloat(ethers.formatEther(balance));
        } catch (error) {
            console.error("Failed to fetch SX Bet balance:", error);
            return 0;
        }
    }

    /**
     * Fetches open orders for the configured wallet from SX Bet API.
     */
    async getOpenOrders() {
        const privateKey = process.env.WALLET_PRIVATE_KEY;
        if (!privateKey || privateKey === 'your_private_key_here') return [];

        try {
            const wallet = new Wallet(privateKey);
            const res = await fetch(`${this.apiUrl}/orders?maker=${wallet.address}&status=open`);
            const data = await res.json();
            return data.data?.orders || [];
        } catch (error) {
            console.error("Failed to fetch SX Bet open orders:", error);
            return [];
        }
    }

    /**
     * Places a limit order on SX Bet.
     * Requires WALLET_PRIVATE_KEY in .env
     */
    async placeOrder(marketHash: string, outcome: string, amount: number, odds: number) {
        const privateKey = process.env.WALLET_PRIVATE_KEY;
        const isDryRun = process.env.DRY_RUN === 'true';

        if (!privateKey || privateKey === 'your_private_key_here') {
            throw new Error("Missing WALLET_PRIVATE_KEY in .env");
        }

        const wallet = new Wallet(privateKey);

        // Safety check for $1 limit
        const maxStake = parseFloat(process.env.MAX_TEST_STAKE || "1.00");
        if (amount > maxStake) {
            throw new Error(`Bet size $${amount} exceeds safety limit of $${maxStake}`);
        }

        console.log(`${isDryRun ? '[DRY RUN] ' : ''}Placing order on SX Bet: $${amount} on ${outcome} @ ${odds}`);

        if (isDryRun) {
            return { success: true, message: "Dry run completed successfully." };
        }

        // TODO: Implement actual SX Bet EIP-712 order signing & broadcast
        const timestamp = Date.now();
        const dummyMsg = `SX Bet Order: ${marketHash} | ${outcome} | ${amount} | ${odds} | ${timestamp}`;
        const sig = await wallet.signMessage(dummyMsg);

        console.log(`Signed Message: ${sig.slice(0, 10)}...`);

        return {
            success: true,
            orderId: `sx-${timestamp}`,
            message: "Order signed. (Broadcasting stubbed for safety until fully verified)"
        };
    }
}
