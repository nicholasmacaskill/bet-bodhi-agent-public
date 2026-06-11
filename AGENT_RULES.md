# 🧠 Bodhi Agent — Operating Rules

This document defines **hard rules** for how any AI agent or assistant (Antigravity, Bodhi, or otherwise) must behave when working within this codebase. These rules are non-negotiable and must be respected in every session.

---

## 🔑 Rule 1: Always Use the Polymarket API for Game/PnL Checks

**NEVER use a browser agent or screen scraper to check:**
- Current game scores or live KBO/MLB/NHL game state
- Active open positions
- Realized or floating PnL
- Trade history

**ALWAYS use the Polymarket API instead**, specifically via the existing scripts and library:

```bash
# Check active open positions and live PnL
npx tsx scratch/check_active_bets.ts

# Check realized PnL history
npx tsx scripts/calculate-live-pnl.ts

# Check recent trades directly from the CLOB
npx tsx scratch/quick_trades.ts
```

The underlying library is at `src/lib/polymarket-api.ts`. It uses:
- **CLOB API** (`https://clob.polymarket.com`) for authenticated trade history — requires `POLY_API_KEY`, `POLY_SECRET`, `POLY_PASSPHRASE` from `.env`
- **Gamma API** (`https://gamma-api.polymarket.com`) for market metadata and current prices — no auth required

Game status can be inferred from Polymarket market prices:
- Price near `$1.00` → that outcome has essentially won
- Price near `$0.00` → that outcome has essentially lost
- Mid-range price → game is live and uncertain

**Rationale:** Browser agents trigger Cloudflare on scraping sites (e.g. MyKBOStats), are slow, and are unreliable. The Polymarket API is the ground truth for all positions and is always available instantly.

---

## 🔑 Rule 2: Use the CLOB Client (not raw fetch) for Authenticated Endpoints

The `/trades` endpoint on `clob.polymarket.com` requires signed headers. Raw `fetch` calls will return `401 Unauthorized`. Always use the `ClobClient` from `@polymarket/clob-client` (initialized with credentials from `.env`) for any authenticated calls.

---

## 🔑 Rule 3: Never Exceed the Safety Stake Limit

The maximum bet size is defined by `MAX_TEST_STAKE` in `.env` (currently `$35.00`). The `placeOrder` method in `polymarket-api.ts` enforces this — never bypass it.

---

## 🔑 Rule 4: Do Not Commit `.env` or Private Keys

The `.gitignore` excludes `.env` and `.env.local`. Never remove these exclusions. Never echo or log private keys or API secrets in output.

---

## 🔑 Rule 5: KBO Game Checking Protocol

When asked about KBO games in progress:
1. Identify relevant Polymarket markets via `getActiveSportsMarkets('KBO')` or `getMarketByTeams()`
2. Check current `outcomePrices` from the Gamma API — this reflects live in-game probability
3. Cross-reference with recent trades via `quick_trades.ts` to understand active positions
4. **Do NOT open a browser or use a browser subagent**

---

## 📋 Script Reference

| Task | Script |
|------|--------|
| Check active open bets + floating PnL | `scratch/check_active_bets.ts` |
| Full realized PnL audit | `scripts/calculate-live-pnl.ts` |
| Recent 20 trades with market names | `scratch/quick_trades.ts` |
| Place a bet | `scripts/place-bet.ts` |
| Morning briefing / scanner | `scripts/daily-scanner.ts` |
| KBO live scanner | `scripts/kbo-live-scanner.ts` |
