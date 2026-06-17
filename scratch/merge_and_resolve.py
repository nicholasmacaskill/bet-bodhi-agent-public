#!/usr/bin/env python3
"""
merge_and_resolve.py
--------------------
1. Merge ALL Polymarket CSVs into one deduplicated master
2. Map every bodhi.db bet to a CSV row using tx hash or (market, amount, timestamp) fuzzy match
3. Resolve win/loss from CSV: if a SELL row exists for the same market → WIN, else LOSS
4. Print full audit report + update bodhi.db
"""

import sqlite3, csv, glob, os, re, sys
from datetime import datetime, timezone
from collections import defaultdict

DB_PATH   = "/Users/nicholasmacaskill/Downloads/bet-bodhi/data/bodhi.db"
CSV_GLOB  = "/Users/nicholasmacaskill/Downloads/Polymarket-History-*.csv"
OUT_CSV   = "/Users/nicholasmacaskill/Downloads/bet-bodhi/scratch/master_trades.csv"

# ── 1. Load & merge all CSVs ─────────────────────────────────────────────────

all_rows = {}   # keyed by tx hash (dedup)
file_stats = []

csv_files = sorted(glob.glob(CSV_GLOB))
print(f"Found {len(csv_files)} CSV files:")
for f in csv_files:
    print(f"  {os.path.basename(f)}")

for fpath in csv_files:
    fname = os.path.basename(fpath)
    count = 0
    with open(fpath, "r", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            h = row.get("hash","").strip()
            if h and h not in all_rows:
                all_rows[h] = row
                count += 1
            elif h in all_rows:
                pass  # duplicate across files
    file_stats.append((fname, count))
    print(f"  {fname}: {count} new unique rows")

print(f"\nTotal unique CSV rows: {len(all_rows)}")

# Write master CSV
fieldnames = ["marketName","action","usdcAmount","tokenAmount","tokenName","timestamp","hash"]
with open(OUT_CSV, "w", newline="") as fh:
    writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in all_rows.values():
        writer.writerow(row)
print(f"Master CSV written → {OUT_CSV}\n")

# ── 2. Index CSV rows ─────────────────────────────────────────────────────────

# Index BUY rows by market name (normalised) → list of rows
def normalise(s):
    """lower, strip punctuation, collapse spaces"""
    s = s.lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

buy_by_market  = defaultdict(list)   # norm_market → [rows]
sell_by_market = defaultdict(list)

for row in all_rows.values():
    nm = normalise(row.get("marketName",""))
    action = row.get("action","").strip().lower()
    ts = int(row.get("timestamp", 0))
    row["_norm_market"] = nm
    row["_ts"] = ts
    row["_usdc"] = float(row.get("usdcAmount", 0) or 0)
    if action == "buy":
        buy_by_market[nm].append(row)
    elif action == "sell":
        sell_by_market[nm].append(row)

# Date range
all_ts = [r["_ts"] for r in all_rows.values() if r["_ts"]]
print(f"CSV date range: {datetime.fromtimestamp(min(all_ts), tz=timezone.utc).date()} → "
      f"{datetime.fromtimestamp(max(all_ts), tz=timezone.utc).date()}")
print(f"BUY actions:  {sum(len(v) for v in buy_by_market.values())}")
print(f"SELL actions: {sum(len(v) for v in sell_by_market.values())}\n")

# ── 3. Load pending bets from bodhi.db ────────────────────────────────────────

con = sqlite3.connect(DB_PATH)
con.row_factory = sqlite3.Row
cur = con.cursor()

pending = cur.execute(
    "SELECT id, team, odds, amount, created_at, external_id FROM bets WHERE result='pending'"
).fetchall()

print(f"Pending bets to resolve: {len(pending)}\n")

# ── 4. Matching logic ─────────────────────────────────────────────────────────

resolved_win  = []
resolved_loss = []
unresolved    = []

def ts_from_str(s):
    """Convert ISO string from bodhi.db to unix timestamp"""
    try:
        dt = datetime.fromisoformat(s.replace("Z","+00:00"))
        return dt.timestamp()
    except:
        return 0

for bet in pending:
    bid      = bet["id"]
    team     = bet["team"]
    amount   = bet["amount"]
    bet_ts   = ts_from_str(bet["created_at"])
    norm_team = normalise(team)

    # Strategy A: exact market-name match (team appears in market name)
    # Find all BUY rows where the market contains the team name
    candidates = []
    for nm, rows in buy_by_market.items():
        if norm_team in nm:
            candidates.extend(rows)

    # Narrow by amount (within 10%) and timestamp (within 5 minutes = 300s)
    TIME_WINDOW = 300
    AMT_TOL     = 0.10

    matched_buy = None
    for row in candidates:
        amt_ok = abs(row["_usdc"] - amount) / max(amount, 0.01) < AMT_TOL
        ts_ok  = abs(row["_ts"] - bet_ts) < TIME_WINDOW if bet_ts else True
        if amt_ok and ts_ok:
            matched_buy = row
            break

    # Fallback: relax time window to 2 hours
    if not matched_buy:
        for row in candidates:
            amt_ok = abs(row["_usdc"] - amount) / max(amount, 0.01) < AMT_TOL
            ts_ok  = abs(row["_ts"] - bet_ts) < 7200 if bet_ts else True
            if amt_ok and ts_ok:
                matched_buy = row
                break

    if matched_buy:
        nm = matched_buy["_norm_market"]
        # Check if a SELL exists for this market (= payout = WIN)
        if nm in sell_by_market:
            sell_rows = sell_by_market[nm]
            # Any sell that happened AFTER the buy = win
            buy_ts = matched_buy["_ts"]
            win_sells = [s for s in sell_rows if s["_ts"] >= buy_ts]
            if win_sells:
                payout = sum(s["_usdc"] for s in win_sells)
                resolved_win.append((bid, payout, matched_buy))
            else:
                resolved_loss.append((bid, matched_buy))
        else:
            # No sell row = position expired worthless = LOSS
            resolved_loss.append((bid, matched_buy))
    else:
        unresolved.append(bet)

print(f"Matched → WIN:  {len(resolved_win)}")
print(f"Matched → LOSS: {len(resolved_loss)}")
print(f"Still unmatched: {len(unresolved)}\n")

# ── 5. Update DB ──────────────────────────────────────────────────────────────

DRY_RUN = "--dry-run" in sys.argv

if not DRY_RUN:
    for (bid, payout, row) in resolved_win:
        cur.execute(
            "UPDATE bets SET result='win', payout=?, updated_at=datetime('now') WHERE id=?",
            (round(payout,2), bid)
        )
    for (bid, row) in resolved_loss:
        cur.execute(
            "UPDATE bets SET result='loss', payout=0, updated_at=datetime('now') WHERE id=?",
            (bid,)
        )
    con.commit()
    print(f"DB updated: {len(resolved_win)} wins + {len(resolved_loss)} losses written.")
else:
    print("[DRY RUN] No DB changes made.")

# ── 6. Print full audit stats ─────────────────────────────────────────────────

# Re-query full picture
all_bets = cur.execute(
    "SELECT id, team, odds, amount, result, payout, created_at FROM bets"
).fetchall()

wins   = [b for b in all_bets if b["result"]=="win"]
losses = [b for b in all_bets if b["result"]=="loss"]
still_pending = [b for b in all_bets if b["result"]=="pending"]

total_wagered = sum(b["amount"] for b in all_bets if b["result"] in ("win","loss"))
total_payout  = sum((b["payout"] or 0) for b in all_bets if b["result"]=="win")
net_pnl       = total_payout - total_wagered

print("\n" + "═"*60)
print("  FULL TRADE HISTORY — FINAL AUDIT")
print("═"*60)
print(f"  Total bets (all time):   {len(all_bets)}")
print(f"  Wins:                    {len(wins)}")
print(f"  Losses:                  {len(losses)}")
print(f"  Still pending:           {len(still_pending)}")
print(f"  Win rate:                {len(wins)/(len(wins)+len(losses))*100:.1f}%")
print(f"  Total wagered:           ${total_wagered:,.2f}")
print(f"  Total returned (wins):   ${total_payout:,.2f}")
print(f"  Net PnL:                 ${net_pnl:+,.2f}")
print(f"  ROI:                     {net_pnl/total_wagered*100:+.1f}%" if total_wagered else "")
print("═"*60)

# ── 7. Unresolved detail ──────────────────────────────────────────────────────

if unresolved:
    print(f"\n⚠️  {len(unresolved)} bets could NOT be matched to any CSV row:")
    for b in unresolved[:30]:
        print(f"  {b['id'][:8]}… | {b['team'][:35]:<35} | ${b['amount']:6.2f} | {b['created_at'][:10]}")
    if len(unresolved) > 30:
        print(f"  ... and {len(unresolved)-30} more")

    print("\nPossible reasons:")
    print("  1. These bets predate all CSVs (before 2026-03-09)")
    print("  2. Team name in bodhi.db doesn't match Polymarket market name")
    print("  3. Amount or timestamp is too far off from any CSV row")

con.close()
print("\nDone.")
