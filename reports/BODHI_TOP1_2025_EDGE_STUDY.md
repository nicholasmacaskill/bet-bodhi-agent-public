# Bet Bodhi — Top-1 Slate Edge Study (Full 2025 Season)

Generated: 2026-06-30
Source: `data/backtest_cache/rows_2025_poly1.json` (2,551 games replayed)

---

## Question

On each day, if we only took **the single highest-alpha pick**, how does that compare to taking the highest-alpha pick **with a Polymarket execution route** — using **actual Poly payout math**?

---

## Simulation assumptions

| Parameter | Value |
|-----------|-------|
| Starting bankroll | **$1000** |
| Stake sizing | **$40–$80** per bet (4–8% of bankroll, scaled by confidence 70→92+) |
| Entry price | Crowd price at kickoff = `confidence/100 − polyEV` |
| Win payout | `stake × (1 − price) / price` (standard Poly share redemption) |
| Loss | Full stake lost |
| Bankroll | Compounding — profits reinvested; min $20 reserve |

---

## Full 2025 results — actual Poly payouts

| Metric | Top 1 (POLY) | Notes |
|--------|-------------:|-------|
| **Bets placed** | 153 | 50 calendar days had no routable Poly top pick |
| **Win rate** | **66.0%** | 101W – 52L |
| **Total wagered** | $10,375 | Avg $68/bet |
| **Net PnL** | **+$5446** | Compounding from $1000 |
| **Ending bankroll** | **$6446** | |
| **ROI on bankroll** | **544.6%** | Full-season return on $1000 start |
| **ROI on wagered** | **52.5%** | Profit per dollar risked |
| **Max drawdown** | 11.7% | Peak-to-trough on compounding path |
| **Avg entry price** | 46.4¢ | Avg underdog-ish line |

Flat-stake comparison (same $40–$80 every bet, no compounding):
**+$5446** on $10,375 wagered (**52.5%** ROI on wagered).

---

## vs simplified 0.87× payout model (old)

The earlier ~23% ROI figure assumed every win paid 0.87× stake (flat -110 style).
At actual Poly entry prices (avg **46¢**), winners pay much more — especially on underdogs.

| Model | Net PnL | ROI (wagered) |
|-------|--------:|--------------:|
| **Actual Poly prices** | +$5446 | **52.5%** |
| Old 0.87× flat payout | +$2615 approx | ~25% |

---

## Overlap (unchanged)

| Case | Days |
|------|-----:|
| Top-1 overall **is** same game as top-1 POLY | **153** |
| Ranking conflict | **0** |
| Top-1 but no Poly route (PASS) | **50** (52.0% WR if you bet them anyway) |

On the 153 executable days, top-1 all and top-1 POLY are **identical picks** — same PnL.

---

## Monthly PnL — Top 1 (POLY)

| Month | W-L | WR | PnL |
|-------|-----|---:|----:|
| 2025-03 | 3-2 | 60.0% | $93 |
| 2025-04 | 20-9 | 69.0% | $757 |
| 2025-05 | 24-6 | 80.0% | $1182 |
| 2025-06 | 18-12 | 60.0% | $896 |
| 2025-07 | 12-15 | 44.4% | $1009 |
| 2025-08 | 23-8 | 74.2% | $1410 |
| 2025-09 | 1-0 | 100.0% | $100 |

---

## Operational takeaway

1. **One bet/day, POLY top-1, $1k bankroll:** $1000 → **$6446** (+545%) over full 2025.
2. **Per-dollar edge:** 52.5% ROI on $10,375 deployed.
3. Underdog-heavy entry prices (~46¢ avg) amplify wins — ROI is much higher than flat 0.87× model.
4. Skip PASS-only top-1 days (50/yr) — no contract to execute.

---

## Artifacts

- `data/backtest_cache/top1_2025_summary.json`
- `scratch/top1_poly_edge_2025.ts`
