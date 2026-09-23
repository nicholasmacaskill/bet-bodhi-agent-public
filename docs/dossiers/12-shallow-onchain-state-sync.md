# [Dossier 12] Shallow On-Chain State Sync & Bankroll Verification

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Web3 Primitives & Cryptographic Routing` // **Type:** `technical` &nbsp;|&nbsp; **Date:** `2026-06-26`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *replacing brittle csv logs with bounded polygon queries*

**Executive Summary:** Replaces full historical database tree walks with shallow CLOB paging and direct USDC.e balance reads, cutting settlement checks from 11 minutes to under 5 seconds.

- **Telemetry:** `sync_mode: shallow // usdc_contract: 0x2791B... // csv_fallback: removed`
- **Tech Stack:** `Ethers.js v6`, `@polymarket/clob-client`, `Polygon RPC`, `TypeScript`, `USDC.e Contract Reads`, `Shallow Paging`, `On-Chain Bankroll Verification`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **full_sync_duration** | `~11 min` |
| **shallow_sync_duration** | `< 5s` |
| **latency_reduction** | `99.2%` |
| **trade_resolution_accuracy** | `100%` |

## Technical Architecture & Findings

### The Problem: Static CSV Settlement Logs

Pending bet settlement was originally tracked in local static CSV files. The workflow was brittle — prone to corruption, required manual reconciliation, and could not keep pace with live scanner cycles. Full historical syncs walked entire Supabase and CLOB trees on every diagnostic run, producing **~11 minute** state checks that blocked daily execution.

### Shallow Sync Architecture

Diagnostic and scanner entrypoints now default to **shallow syncs**: only the last 100 settled entries or 2 pages of active CLOB trade history are pulled before bankroll verification runs. This bounds network I/O while preserving enough context for same-day decisioning.

The sync pipeline pairs shallow trade paging with direct on-chain USDC.e balance reads on Polygon (`0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`):

```typescript
async getUSDCBalance(): Promise<number> {
    // 1. Try Polymarket CLOB collateral balance (fast path)
    const clobBalance = await client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
    if (clobBalance?.balance) {
        return parseFloat(clobBalance.balance) / 1_000_000;
    }

    // 2. Fallback: raw on-chain USDC.e wallet balance
    const usdcEAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    const contract = new ethers.Contract(usdcEAddress, ["function balanceOf(address) view returns (uint256)"], provider);
    const balance = await contract.balanceOf(targetAddress);
    return parseFloat(ethers.formatUnits(balance, 6));
}
```

### Impact

* **Data integrity**: 100% automated trade resolution — local CSV intermediaries removed.
* **Latency floor**: State checks reduced from **11 minutes** to **under 5 seconds**, a **99.2%** reduction.
* **Scanner coupling**: `daily-scanner.ts` invokes `SyncService` at scan start so bankroll and pending-bet state are fresh before pillar evaluation runs.

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
