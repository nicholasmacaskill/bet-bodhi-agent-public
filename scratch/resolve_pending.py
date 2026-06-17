"""
resolve_pending.py  (v3 — match by timestamp + amount, not team name)
----------------------------------------------------------------------
Problem: All 243 pending bets have team='Polymarket Event' (set by sync-service.ts
when trade.outcome and market.question are unavailable). The CSV uses real team
names in tokenName, so team-name matching fails.

Fix: Match pending bets to CSV Buy rows by timestamp + amount proximity instead.

Strategy:
  1. Build resolution ledger from CSV (same as before) — keyed by (marketName, tokenName)
  2. Build a flat index of ALL Buy rows: (timestamp, usdcAmount, marketName, tokenName)
  3. For each pending bet, find the Buy row with closest timestamp AND matching amount
  4. Look up the resolution for that (marketName, tokenName) pair
  5. Bets before CSV date range (March 2026) → mark as 'unknown' (no data available)
"""

import sqlite3
import csv
import datetime
from collections import defaultdict

DB_PATH = "/Users/nicholasmacaskill/Downloads/bet-bodhi/data/bodhi.db"
CSV_PATH = "/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-06-16.csv"

# ── 1. Load CSV ───────────────────────────────────────────────────────────────
with open(CSV_PATH, encoding="utf-8-sig") as f:
    all_rows = list(csv.DictReader(f))

print(f"📂 Loaded {len(all_rows)} rows from {CSV_PATH}")

from collections import Counter
print("   Actions:", dict(Counter(r["action"] for r in all_rows)))

# ── 2. Build per-(market, token/team) ledger ──────────────────────────────────
# key = (marketName, tokenName)
ledger = defaultdict(lambda: {"buys": [], "sells": [], "redeems": []})

for r in all_rows:
    if r["action"] in ("Deposit", "Withdraw"):
        continue
    key = (r["marketName"].strip(), r["tokenName"].strip())
    entry = {
        "action": r["action"],
        "usdc":   float(r["usdcAmount"] or 0),
        "tokens": float(r["tokenAmount"] or 0),
        "ts":     int(r["timestamp"] or 0),
    }
    if r["action"] == "Buy":
        ledger[key]["buys"].append(entry)
    elif r["action"] == "Sell":
        ledger[key]["sells"].append(entry)
    elif r["action"] == "Redeem":
        ledger[key]["redeems"].append(entry)

print(f"\n🗺️  Ledger entries for {len(ledger)} (market, team) pairs")

# ── 3. Resolve each position ──────────────────────────────────────────────────
resolution = {}  # key → {result, cost, returned, net}

for key, pos in ledger.items():
    cost     = sum(e["usdc"] for e in pos["buys"])
    from_sell   = sum(e["usdc"] for e in pos["sells"])
    from_redeem = sum(e["usdc"] for e in pos["redeems"])
    returned = from_sell + from_redeem

    has_redeem = len(pos["redeems"]) > 0
    profitable_sell = from_sell >= cost * 0.9  # allow 10% slippage for sells

    if has_redeem or (pos["sells"] and profitable_sell):
        result = "win"
    elif pos["sells"] and from_sell > 0:
        result = "loss"
    else:
        result = "loss"

    all_ts = [e["ts"] for e in pos["buys"] + pos["sells"] + pos["redeems"]]
    earliest_buy_ts = min((e["ts"] for e in pos["buys"]), default=0)

    resolution[key] = {
        "result":       result,
        "cost":         cost,
        "returned":     returned,
        "net":          returned - cost,
        "earliest_buy_ts": earliest_buy_ts,
        "has_redeem":   has_redeem,
        "sell_count":   len(pos["sells"]),
        "redeem_count": len(pos["redeems"]),
    }

wins   = sum(1 for v in resolution.values() if v["result"] == "win")
losses = sum(1 for v in resolution.values() if v["result"] == "loss")
print(f"   ✅ Resolvable wins: {wins}")
print(f"   ❌ Resolvable losses: {losses}")

# ── 4. Build Buy-row index for timestamp+amount matching ──────────────────────
# Each entry: (timestamp, usdcAmount, marketName, tokenName)
buy_index = []
for r in all_rows:
    if r["action"] == "Buy":
        buy_index.append({
            "ts":        int(r["timestamp"] or 0),
            "usdc":      float(r["usdcAmount"] or 0),
            "market":    r["marketName"].strip(),
            "token":     r["tokenName"].strip(),
        })

buy_index.sort(key=lambda x: x["ts"])
print(f"\n🔍 Buy-row index: {len(buy_index)} entries (earliest={datetime.datetime.fromtimestamp(buy_index[0]['ts'], tz=datetime.timezone.utc).date() if buy_index else 'N/A'})")

# Determine CSV date range
csv_earliest_ts = buy_index[0]["ts"] if buy_index else 0
csv_earliest_dt = datetime.datetime.fromtimestamp(csv_earliest_ts, tz=datetime.timezone.utc)

# ── 5. Load pending bets ──────────────────────────────────────────────────────
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

pending = cur.execute("""
    SELECT id, team, odds, amount, created_at, external_id
    FROM bets WHERE result = 'pending'
    ORDER BY created_at
""").fetchall()
print(f"\n📊 Pending bets in DB: {len(pending)}")

# ── 6. Match bets → CSV entries by timestamp + amount ─────────────────────────
def parse_ts(s):
    """Parse ISO timestamp string → Unix epoch float."""
    try:
        s = s.replace("T", " ").replace("+00:00", "").split(".")[0]
        return datetime.datetime.fromisoformat(s).timestamp()
    except:
        return 0

def find_best_buy_match(bet_ts, bet_amount, buy_index, max_time_diff=86400):
    """
    Find the Buy row with closest timestamp to bet_ts, where amount
    is within 10% of bet_amount. Returns (match, distance) or (None, None).
    """
    # Binary search for closest timestamp
    lo, hi = 0, len(buy_index) - 1
    best_idx = None
    best_dist = float('inf')

    while lo <= hi:
        mid = (lo + hi) // 2
        mid_ts = buy_index[mid]["ts"]
        if mid_ts < bet_ts:
            lo = mid + 1
        elif mid_ts > bet_ts:
            hi = mid - 1
        else:
            best_idx = mid
            break

    # Check the surrounding area (±5 indices) for amount match
    if best_idx is None:
        best_idx = lo if lo < len(buy_index) else hi

    search_range = range(max(0, best_idx - 50), min(len(buy_index), best_idx + 50))

    for i in search_range:
        candidate = buy_index[i]
        time_dist = abs(candidate["ts"] - bet_ts)
        if time_dist > max_time_diff:
            continue
        # Check if amount matches within 10% tolerance
        if candidate["usdc"] > 0:
            ratio = bet_amount / candidate["usdc"]
            if 0.9 <= ratio <= 1.1:
                if time_dist < best_dist:
                    best_dist = time_dist
                    best_idx = i

    if best_idx is not None and best_dist < max_time_diff:
        return buy_index[best_idx], best_dist
    return None, None

matched   = []
unmatched = []
no_csv_data = []  # Bets before CSV date range

for bet in pending:
    bet_ts = parse_ts(bet["created_at"])
    bet_amount = bet["amount"]

    # Check if bet is before CSV data range
    if bet_ts < csv_earliest_ts:
        no_csv_data.append(dict(bet))
        continue

    # Find best Buy match by timestamp + amount
    buy_match, dist = find_best_buy_match(bet_ts, bet_amount, buy_index)

    if buy_match is None:
        unmatched.append(dict(bet))
        continue

    # Look up resolution for this (marketName, tokenName)
    res_key = (buy_match["market"], buy_match["token"])
    res = resolution.get(res_key)

    if res is None:
        unmatched.append(dict(bet))
        continue

    matched.append({
        "id":          bet["id"],
        "team":        buy_match["token"],
        "market":      buy_match["market"],
        "amount":      bet["amount"],
        "odds":        bet["odds"],
        "created_at":  bet["created_at"],
        "result":      res["result"],
        "payout":      res["returned"] if res["result"] == "win" else 0,
        "net":         res["net"],
        "has_redeem":  res["has_redeem"],
        "match_ts_dist": dist,
    })

print(f"\n✅ Matched (timestamp+amount): {len(matched)} bets")
print(f"❓ Unmatched (in CSV range but no match): {len(unmatched)} bets")
print(f"⏭️  Before CSV range (no data): {len(no_csv_data)} bets")

# ── 7. Full report ────────────────────────────────────────────────────────────
m_wins   = [m for m in matched if m["result"] == "win"]
m_losses = [m for m in matched if m["result"] == "loss"]

total_wagered = sum(m["amount"] for m in matched)
total_payout  = sum(m["payout"] for m in m_wins)
total_lost    = sum(m["amount"] for m in m_losses)
net_pnl       = total_payout - total_lost

print("\n" + "="*70)
print("  RESOLVED P&L REPORT  (pending bets now settled)")
print("="*70)
print(f"  Matched & resolved: {len(matched)} bets")
print(f"  Wins:  {len(m_wins)}   Losses: {len(m_losses)}")
print(f"  Win Rate:  {100*len(m_wins)/max(1,len(matched)):.1f}%")
print(f"  Wagered:   ${total_wagered:.2f}")
print(f"  Returned:  ${total_payout:.2f}")
print(f"  Lost:      ${total_lost:.2f}")
print(f"  Net PnL:   ${net_pnl:+.2f}")

# Stake tier breakdown
tiers = [
    ("<$5",    0,   5),
    ("$5-15",  5,   15),
    ("$15-25", 15,  25),
    ("$25-40", 25,  40),
    ("$40+",   40,  9999),
]
print("\n  STAKE TIER BREAKDOWN (resolved):")
print(f"  {'Tier':<10} {'N':>5} {'W':>5} {'L':>5} {'Win%':>7} {'Wagered':>10} {'Payout':>10} {'Net':>10}")
for label, lo, hi in tiers:
    t_bets = [m for m in matched if lo <= m["amount"] < hi]
    if not t_bets:
        continue
    tw = [m for m in t_bets if m["result"] == "win"]
    tl = [m for m in t_bets if m["result"] == "loss"]
    wag = sum(m["amount"] for m in t_bets)
    pay = sum(m["payout"] for m in tw)
    net = pay - sum(m["amount"] for m in tl)
    pct = 100*len(tw)/len(t_bets)
    print(f"  {label:<10} {len(t_bets):>5} {len(tw):>5} {len(tl):>5} {pct:>6.1f}% ${wag:>9.2f} ${pay:>9.2f} ${net:>+9.2f}")

# Team breakdown
team_stats = defaultdict(lambda: {"w":0,"l":0,"wag":0,"pay":0})
for m in matched:
    ts = team_stats[m["team"]]
    ts["wag"] += m["amount"]
    if m["result"] == "win":
        ts["w"] += 1
        ts["pay"] += m["payout"]
    else:
        ts["l"] += 1

print("\n  TEAM BREAKDOWN (resolved):")
print(f"  {'Team':<32} {'W':>4} {'L':>4} {'Win%':>7} {'Wagered':>10} {'Net':>10}")
for team, ts in sorted(team_stats.items(), key=lambda x: -(x[1]["pay"] - x[1]["wag"])):
    net = ts["pay"] - ts["wag"]
    pct = 100*ts["w"]/max(1, ts["w"]+ts["l"])
    print(f"  {team:<32} {ts['w']:>4} {ts['l']:>4} {pct:>6.1f}% ${ts['wag']:>9.2f} ${net:>+9.2f}")

# ── 8. Write to DB ────────────────────────────────────────────────────────────
WRITE = True
if WRITE:
    updated = 0
    for m in matched:
        cur.execute("""
            UPDATE bets
            SET result = ?, payout = ?, updated_at = datetime('now')
            WHERE id = ?
        """, (m["result"], m["payout"], m["id"]))
        updated += 1
    conn.commit()
    print(f"\n💾 Written {updated} resolutions to bodhi.db")
else:
    print("\n⚠️  DRY RUN — set WRITE = True to commit")

conn.close()

# ── 9. Summary ────────────────────────────────────────────────────────────────
print(f"\n{'='*70}")
print(f"  SUMMARY")
print(f"{'='*70}")
print(f"  Total pending bets:     {len(pending)}")
print(f"  Resolved (matched):     {len(matched)}")
print(f"  Unmatched (in CSV):     {len(unmatched)}")
print(f"  No CSV data (pre-Apr):  {len(no_csv_data)}")
print(f"  Net PnL from resolved:  ${net_pnl:+.2f}")
if no_csv_data:
    print(f"\n  ⚠️  {len(no_csv_data)} bets from before {csv_earliest_dt.date()} have no CSV data.")
    print(f"     To resolve these, download an older Polymarket export covering March 2026.")
