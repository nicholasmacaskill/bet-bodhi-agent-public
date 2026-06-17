#!/usr/bin/env python3
"""
clob_full_resolve.py
---------------------
1. Page through ALL trades from Polymarket data API for the proxy wallet
2. Build a complete picture: which conditionIds were BUY'd, which had SELL (redemption)
3. Cross-reference with bodhi.db pending bets by (amount, timestamp)
4. Update DB and produce full audit report
"""

import sqlite3, requests, time, json, sys
from datetime import datetime, timezone
from collections import defaultdict

PROXY = "0x98652277eb9f1164d121c207e7a620710072f6af"
DB    = "/Users/nicholasmacaskill/Downloads/bet-bodhi/data/bodhi.db"
DRY   = "--dry-run" in sys.argv
OUT   = "/Users/nicholasmacaskill/Downloads/bet-bodhi/scratch/all_poly_trades.json"

BASE_URL = "https://data-api.polymarket.com/activity"

# ── 1. Fetch ALL trades via pagination ───────────────────────────────────────

print("Fetching all trades from Polymarket data API...")
all_trades = []
offset = 0
LIMIT  = 500

while True:
    url = f"{BASE_URL}?user={PROXY}&limit={LIMIT}&offset={offset}"
    resp = requests.get(url, timeout=30)
    if resp.status_code != 200:
        print(f"  HTTP {resp.status_code}: {resp.text[:200]}")
        break
    batch = resp.json()
    if not batch:
        break
    all_trades.extend(batch)
    print(f"  Fetched {len(all_trades)} trades so far (offset={offset})...")
    if len(batch) < LIMIT:
        break
    offset += LIMIT
    time.sleep(0.3)

print(f"\nTotal trades fetched: {len(all_trades)}")

# Save raw
with open(OUT, "w") as f:
    json.dump(all_trades, f, indent=2)
print(f"Raw trades saved → {OUT}")

# ── 2. Analyse trades ─────────────────────────────────────────────────────────

# Group by conditionId
by_condition = defaultdict(list)
for t in all_trades:
    by_condition[t["conditionId"]].append(t)

buy_conditions  = set()
sell_conditions = set()

for cid, trades in by_condition.items():
    sides = {t["side"] for t in trades}
    if "BUY" in sides:
        buy_conditions.add(cid)
    if "SELL" in sides:
        sell_conditions.add(cid)

print(f"\nUnique markets traded: {len(by_condition)}")
print(f"Markets with BUY:  {len(buy_conditions)}")
print(f"Markets with SELL: {len(sell_conditions)}")

# Build lookup: timestamp (unix) → list of trades (for matching to bodhi bets)
# Key: round to nearest second
by_ts = defaultdict(list)
for t in all_trades:
    by_ts[int(t["timestamp"])].append(t)

# Also build by (usdcSize rounded to 2dp)
by_usdc = defaultdict(list)
for t in all_trades:
    k = round(float(t["usdcSize"]), 2)
    by_usdc[k].append(t)

# Date range
timestamps = [t["timestamp"] for t in all_trades]
print(f"Date range: {datetime.fromtimestamp(min(timestamps),tz=timezone.utc).date()} → "
      f"{datetime.fromtimestamp(max(timestamps),tz=timezone.utc).date()}")

# ── 3. Load pending bets from DB ──────────────────────────────────────────────

con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
cur = con.cursor()

pending = cur.execute(
    "SELECT id, team, odds, amount, created_at, external_id FROM bets WHERE result='pending'"
).fetchall()

print(f"\nPending bets to resolve: {len(pending)}")

# ── 4. Match pending bets to API trades ───────────────────────────────────────

def iso_to_unix(s):
    try:
        dt = datetime.fromisoformat(s.replace("Z","+00:00"))
        return dt.timestamp()
    except:
        return None

resolved_win  = []
resolved_loss = []
unresolved    = []
match_log     = []

for bet in pending:
    bid    = bet["id"]
    amount = float(bet["amount"])
    bet_ts = iso_to_unix(bet["created_at"])

    best_match = None
    best_score = float("inf")

    # Search all_trades for a BUY that matches amount + timestamp
    for t in all_trades:
        if t["side"] != "BUY":
            continue
        usdc  = float(t["usdcSize"])
        t_ts  = float(t["timestamp"])

        amt_diff = abs(usdc - amount)
        ts_diff  = abs(t_ts - bet_ts) if bet_ts else 9999

        # Must be within 5% amount AND 10 minutes time
        if amt_diff / max(amount, 0.01) < 0.05 and ts_diff < 600:
            score = amt_diff + ts_diff * 0.001
            if score < best_score:
                best_score = score
                best_match = t

    if best_match:
        cid = best_match["conditionId"]
        title = best_match.get("title","?")
        outcome = best_match.get("outcome","?")

        # WIN if there's a SELL for this conditionId
        if cid in sell_conditions:
            # Sum all SELL usdcSize for this condition = payout
            sells = [tr for tr in by_condition[cid] if tr["side"]=="SELL"]
            payout = sum(float(s["usdcSize"]) for s in sells)
            resolved_win.append((bid, payout, best_match))
            match_log.append({
                "bet_id": bid, "result": "WIN",
                "market": title, "outcome": outcome,
                "wagered": amount, "payout": round(payout,2),
                "ts": best_match["timestamp"]
            })
        else:
            resolved_loss.append((bid, best_match))
            match_log.append({
                "bet_id": bid, "result": "LOSS",
                "market": title, "outcome": outcome,
                "wagered": amount, "payout": 0,
                "ts": best_match["timestamp"]
            })
    else:
        unresolved.append(bet)

print(f"\nMatched → WIN:    {len(resolved_win)}")
print(f"Matched → LOSS:   {len(resolved_loss)}")
print(f"Still unmatched:  {len(unresolved)}")

# ── 5. Show sample matches ────────────────────────────────────────────────────

print("\nSample matches:")
for m in match_log[:15]:
    print(f"  [{m['result']}] ${m['wagered']:.2f} → ${m['payout']:.2f} | {m['market'][:50]}")

# ── 6. Update DB ──────────────────────────────────────────────────────────────

if not DRY:
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
    print(f"\nDB updated: {len(resolved_win)} wins + {len(resolved_loss)} losses written.")
else:
    print("\n[DRY RUN] No DB changes.")

# ── 7. Final audit ────────────────────────────────────────────────────────────

all_bets = cur.execute(
    "SELECT id, team, odds, amount, result, payout, created_at FROM bets"
).fetchall()

wins   = [b for b in all_bets if b["result"]=="win"]
losses = [b for b in all_bets if b["result"]=="loss"]
still_pend = [b for b in all_bets if b["result"]=="pending"]

wagered = sum(b["amount"] for b in wins+losses)
returned = sum((b["payout"] or 0) for b in wins)
net = returned - wagered
wr = len(wins)/(len(wins)+len(losses))*100 if (wins or losses) else 0

print("\n" + "═"*60)
print("  COMPLETE TRADE HISTORY — FINAL AUDIT")
print("═"*60)
print(f"  Total bets (all time):   {len(all_bets)}")
print(f"  Wins:                    {len(wins)}")
print(f"  Losses:                  {len(losses)}")
print(f"  Still pending/unmatched: {len(still_pend)}")
print(f"  Win rate:                {wr:.1f}%")
print(f"  Total wagered:           ${wagered:,.2f}")
print(f"  Total returned (wins):   ${returned:,.2f}")
print(f"  Net PnL:                 ${net:+,.2f}")
if wagered:
    print(f"  ROI:                     {net/wagered*100:+.1f}%")
print("═"*60)

# ── 8. Unresolved detail ──────────────────────────────────────────────────────

if unresolved:
    print(f"\n⚠️  {len(unresolved)} bets still couldn't be matched:")
    for b in unresolved[:20]:
        print(f"  ${b['amount']:6.2f} | {b['created_at'][:19]} | ext={b['external_id']}")

    # Check if any of these are older than our API data
    oldest_api = min(timestamps)
    older_than_api = []
    for b in unresolved:
        bts = iso_to_unix(b["created_at"])
        if bts and bts < oldest_api:
            older_than_api.append(b)
    if older_than_api:
        print(f"\n  {len(older_than_api)} predate oldest API record ({datetime.fromtimestamp(oldest_api,tz=timezone.utc).date()})")

# ── 9. By-market breakdown for unresolved ─────────────────────────────────────

# Show total wagered on still-unresolved
if unresolved:
    total_unresolved = sum(b["amount"] for b in unresolved)
    print(f"\n  Total $ at stake in unresolved bets: ${total_unresolved:,.2f}")

con.close()
print("\nDone.")
