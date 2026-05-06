# 🏹 BODHI COMMAND CHEAT SHEET

Quick reference for scanner and execution commands.

## 🔍 Scanning Commands

| Command | Description |
| :--- | :--- |
| `npx tsx scripts/daily-scanner.ts` | Scan all sports for today's games. |
| `npx tsx scripts/daily-scanner.ts --verbose` | Expanded Scan: Shows detailed reasons for every pillar score. |
| `npx tsx scripts/daily-scanner.ts --date 2026-03-08` | Scan for a specific date (YYYY-MM-DD). |
| `npx tsx scripts/daily-scanner.ts --watch` | Start the scanner in watch mode (updates every 15 min). |
| `npx tsx scripts/daily-scanner.ts --watch --interval 5` | Watch mode with custom interval (minutes). |

## 🏹 Execution Commands (Manual Trigger)

Use these commands when the scanner identifies a **Value Play (+EV)**.

### Polymarket
```bash
npx tsx scripts/place-bet.ts --market poly --id <conditionId> --outcome <0/1> --amount <USD> --price <price> --slippage 0.05
```

### SX Bet
```bash
npx tsx scripts/place-bet.ts --market sx --id <marketHash> --outcome "<Team Name>" --amount <USD> --price <price>
```

## 🛠️ Configuration & Wallet

| Action | Command/File |
| :--- | :--- |
| View Proxy Wallet | `echo $POLY_PROXY_ADDRESS` |
| Edit Environment | `nano .env` |
| Check Wallet Balance | `npx tsx scripts/daily-scanner.ts` (Syncs at startup) |

## ⚠️ Safety Limits
* **Max Stake:** Defaulted to **$1.00** in `place-bet.ts` for safety (controllable via `MAX_TEST_STAKE` in `.env`).
* **Dry Run:** Set `DRY_RUN=true` in `.env` to test signing without broadcasting.
