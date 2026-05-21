import { ethers } from 'ethers';
import 'dotenv/config';

// Concurrency helper
async function pMap<T, R>(
    items: T[],
    mapper: (item: T) => Promise<R>,
    concurrency: number
): Promise<R[]> {
    const results: R[] = [];
    const iterator = items.entries();

    const workers = Array.from({ length: concurrency }, async () => {
        for (const [index, item] of iterator) {
            results[index] = await mapper(item);
        }
    });

    await Promise.all(workers);
    return results;
}

async function findBlockByTimestamp(targetTimestamp: number, provider: ethers.JsonRpcProvider): Promise<number> {
    let low = 80000000;
    let high = await provider.getBlockNumber();
    
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        try {
            const block = await provider.getBlock(mid);
            if (!block) {
                high = mid - 1;
                continue;
            }
            if (Math.abs(block.timestamp - targetTimestamp) < 7200) {
                return mid;
            } else if (block.timestamp < targetTimestamp) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        } catch {
            high = mid - 1;
        }
    }
    return low;
}

async function main() {
    const provider = new ethers.JsonRpcProvider('https://polygon.gateway.tenderly.co');
    const proxyAddress = '0x98652277eb9f1164d121c207e7a620710072f6af';
    const eoaAddress = '0xb1Aa8Ff8CEeB5506044DB7BcB2B2D243Ff680BB1'.toLowerCase();
    
    const USDC_BRIDGED = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC.e
    const USDC_NATIVE  = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // USDC

    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const paddedProxy = ethers.zeroPadValue(proxyAddress, 32).toLowerCase();

    const startTimestamp = Math.floor(new Date('2026-03-01T00:00:00Z').getTime() / 1000);
    const startBlock = await findBlockByTimestamp(startTimestamp, provider);
    const currentBlock = await provider.getBlockNumber();

    const chunkSize = 10000;
    const chunks: { from: number; to: number }[] = [];
    for (let from = startBlock; from < currentBlock; from += chunkSize) {
        chunks.push({
            from,
            to: Math.min(from + chunkSize - 1, currentBlock)
        });
    }

    const allLogs: any[] = [];
    let processed = 0;

    await pMap(chunks, async (chunk) => {
        try {
            const [inBridged, outBridged, inNative, outNative] = await Promise.all([
                provider.getLogs({
                    address: USDC_BRIDGED,
                    fromBlock: chunk.from,
                    toBlock: chunk.to,
                    topics: [transferTopic, null, paddedProxy]
                }),
                provider.getLogs({
                    address: USDC_BRIDGED,
                    fromBlock: chunk.from,
                    toBlock: chunk.to,
                    topics: [transferTopic, paddedProxy, null]
                }),
                provider.getLogs({
                    address: USDC_NATIVE,
                    fromBlock: chunk.from,
                    toBlock: chunk.to,
                    topics: [transferTopic, null, paddedProxy]
                }),
                provider.getLogs({
                    address: USDC_NATIVE,
                    fromBlock: chunk.from,
                    toBlock: chunk.to,
                    topics: [transferTopic, paddedProxy, null]
                })
            ]);

            allLogs.push(...inBridged.map(l => ({ ...l, type: 'IN' })));
            allLogs.push(...outBridged.map(l => ({ ...l, type: 'OUT' })));
            allLogs.push(...inNative.map(l => ({ ...l, type: 'IN' })));
            allLogs.push(...outNative.map(l => ({ ...l, type: 'OUT' })));
        } catch (e: any) {
            // ignore
        }
        processed++;
    }, 10);

    interface TransferRecord {
        type: 'IN' | 'OUT';
        counterparty: string;
        amount: number;
        token: string;
        blockNumber: number;
        txHash: string;
    }

    const records: TransferRecord[] = [];
    for (const log of allLogs) {
        const fromAddr = '0x' + log.topics[1].substring(26);
        const toAddr = '0x' + log.topics[2].substring(26);
        const counterparty = log.type === 'IN' ? fromAddr.toLowerCase() : toAddr.toLowerCase();
        const amount = parseFloat(ethers.formatUnits(log.data, 6));
        const tokenSymbol = log.address.toLowerCase() === USDC_BRIDGED.toLowerCase() ? 'USDC.e' : 'USDC';

        records.push({
            type: log.type,
            counterparty,
            amount,
            token: tokenSymbol,
            blockNumber: log.blockNumber,
            txHash: log.transactionHash
        });
    }

    // Deduplicate
    const uniqueRecordsMap = new Map<string, TransferRecord>();
    for (const r of records) {
        const key = `${r.txHash}-${r.type}`;
        uniqueRecordsMap.set(key, r);
    }
    const uniqueRecords = Array.from(uniqueRecordsMap.values()).sort((a, b) => a.blockNumber - b.blockNumber);

    // Analyze counterparties
    const counterparties = new Map<string, { inVol: number; outVol: number; txs: number }>();
    for (const r of uniqueRecords) {
        if (!counterparties.has(r.counterparty)) {
            counterparties.set(r.counterparty, { inVol: 0, outVol: 0, txs: 0 });
        }
        const stats = counterparties.get(r.counterparty)!;
        stats.txs++;
        if (r.type === 'IN') {
            stats.inVol += r.amount;
        } else {
            stats.outVol += r.amount;
        }
    }

    console.log("====================================================");
    console.log("             COUNTERPARTY VOLUME SUMMARY");
    console.log("====================================================");
    for (const [address, stats] of counterparties.entries()) {
        console.log(`Address: ${address}`);
        console.log(`  - Incoming Vol (IN to Proxy) : $${stats.inVol.toFixed(2)}`);
        console.log(`  - Outgoing Vol (OUT from Proxy): $${stats.outVol.toFixed(2)}`);
        console.log(`  - Total Transactions: ${stats.txs}`);
    }
    console.log("====================================================");
}

main().catch(console.error);
