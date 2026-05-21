import { ethers } from 'ethers';
import 'dotenv/config';

async function main() {
    const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
    const proxyAddress = '0x98652277eb9f1164d121c207e7a620710072f6af';
    
    // USDC contracts on Polygon
    const USDC_BRIDGED = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC.e
    const USDC_NATIVE  = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // USDC

    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const paddedProxy = ethers.zeroPadValue(proxyAddress, 32).toLowerCase();

    console.log(`Querying logs for Proxy: ${proxyAddress}`);

    const currentBlock = await provider.getBlockNumber();
    // 90 days is roughly 3.9 million blocks on Polygon
    const lookbackBlocks = 5000000;
    const startBlock = currentBlock - lookbackBlocks;
    
    console.log(`Current Block: ${currentBlock}`);
    console.log(`Starting scan from block: ${startBlock} (${lookbackBlocks} blocks lookback)...`);

    // We will query in chunks of 500,000 blocks to avoid RPC limits
    const chunkSize = 500000;
    let allLogs: any[] = [];

    for (let from = startBlock; from < currentBlock; from += chunkSize) {
        const to = Math.min(from + chunkSize - 1, currentBlock);
        console.log(`Scanning blocks ${from} to ${to}...`);

        try {
            // Find incoming transfers to the proxy
            const inLogs = await provider.getLogs({
                fromBlock: from,
                toBlock: to,
                topics: [
                    transferTopic,
                    null,
                    paddedProxy
                ]
            });

            // Find outgoing transfers from the proxy
            const outLogs = await provider.getLogs({
                fromBlock: from,
                toBlock: to,
                topics: [
                    transferTopic,
                    paddedProxy,
                    null
                ]
            });

            allLogs.push(...inLogs.map(l => ({ ...l, type: 'IN' })));
            allLogs.push(...outLogs.map(l => ({ ...l, type: 'OUT' })));
        } catch (e: any) {
            console.error(`Error scanning block chunk ${from}-${to}:`, e.message);
        }
    }

    console.log(`Found ${allLogs.length} total raw USDC transfers.`);

    // Filter only USDC_BRIDGED and USDC_NATIVE contracts
    const usdcLogs = allLogs.filter(l => 
        l.address.toLowerCase() === USDC_BRIDGED.toLowerCase() ||
        l.address.toLowerCase() === USDC_NATIVE.toLowerCase()
    );

    console.log(`Filtered to ${usdcLogs.length} actual USDC/USDC.e transfers.`);

    interface TransferRecord {
        type: 'IN' | 'OUT';
        from: string;
        to: string;
        amount: number;
        token: string;
        blockNumber: number;
        txHash: string;
    }

    const records: TransferRecord[] = [];

    for (const log of usdcLogs) {
        const fromAddr = '0x' + log.topics[1].substring(26);
        const toAddr = '0x' + log.topics[2].substring(26);
        
        // Parse the amount from the data field
        const decimals = 6; // Both USDC and USDC.e on Polygon are 6 decimals
        const amount = parseFloat(ethers.formatUnits(log.data, decimals));
        const tokenSymbol = log.address.toLowerCase() === USDC_BRIDGED.toLowerCase() ? 'USDC.e' : 'USDC';

        records.push({
            type: log.type,
            from: fromAddr,
            to: toAddr,
            amount,
            token: tokenSymbol,
            blockNumber: log.blockNumber,
            txHash: log.transactionHash
        });
    }

    // De-duplicate in case a transfer was captured in both filters or double-scanned
    const uniqueRecordsMap = new Map<string, TransferRecord>();
    for (const r of records) {
        const key = `${r.txHash}-${r.type}`;
        uniqueRecordsMap.set(key, r);
    }
    const uniqueRecords = Array.from(uniqueRecordsMap.values()).sort((a, b) => a.blockNumber - b.blockNumber);

    let totalIn = 0;
    let totalOut = 0;

    console.log("\n--- DETAILED TRANSFERS ---");
    for (const r of uniqueRecords) {
        // Exclude internal Polymarket contract interactions if necessary, 
        // but typically all external transfers into proxy are deposits,
        // and transfers out of proxy to user EOA are withdrawals.
        console.log(`[${r.type}] Block: ${r.blockNumber} | ${r.amount} ${r.token} | From: ${r.from} -> To: ${r.to} | Tx: ${r.txHash.substring(0, 10)}...`);
        if (r.type === 'IN') {
            totalIn += r.amount;
        } else {
            totalOut += r.amount;
        }
    }

    console.log("\n====================================================");
    console.log("            ON-CHAIN RECONCILIATION SUMMARY");
    console.log("====================================================");
    console.log(`Total On-Chain Deposits (IN)  : $${totalIn.toFixed(2)}`);
    console.log(`Total On-Chain Withdraws (OUT): $${totalOut.toFixed(2)}`);
    console.log(`Net Capital Deposited         : $${(totalIn - totalOut).toFixed(2)}`);
    console.log("====================================================");
}

main().catch(console.error);
