import os
import glob
import csv
import datetime

downloads_dir = os.path.expanduser('~/Downloads')
pattern = os.path.join(downloads_dir, 'Polymarket-History-*.csv')
files = glob.glob(pattern)

if not files:
    print("No Polymarket history files found.")
    exit()

latest_file = max(files, key=os.path.getmtime)
print(f"Reading from latest file: {latest_file}")

today_local = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=3) # Local ADT time
today_str = today_local.strftime('%Y-%m-%d')
print(f"Filtering for local trade date (ADT): {today_str} or last 24h")

# Need to accurately account PnL for today's resolution or trades.
# "Netted out today" means closed positions today.
net_pnl = 0.0
wagered_today = 0.0
returned_today = 0.0
trades_today = 0

with open(latest_file, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        action = row['action']
        usdc = float(row['usdcAmount']) if row['usdcAmount'] else 0.0
        ts = int(row['timestamp'])
        
        dt_local = datetime.datetime.fromtimestamp(ts, datetime.UTC) - datetime.timedelta(hours=3)
        
        # Consider the "24 hour window" or matching today's date string.
        # Even if they bought yesterday and it resolved today, the "Sell/Redeem" happens today.
        if dt_local.strftime('%Y-%m-%d') == today_str or (today_local - dt_local).total_seconds() < 86400:
            if action == 'Buy':
                net_pnl -= usdc
                wagered_today += usdc
                trades_today += 1
            elif action in ['Sell', 'Redeem']:
                net_pnl += usdc
                returned_today += usdc
                trades_today += 1

print(f"\n--- TODAY's ACTIVITY SUMMARY ({today_str} ADT) ---")
print(f"Total Transactions: {trades_today}")
print(f"Total Wagered: ${wagered_today:,.2f}")
print(f"Total Returned: ${returned_today:,.2f}")
print(f"Net PnL (Open + Closed Today): ${net_pnl:,.2f}")

# Also calculate just the daily closed PnL if possible by mapping markets
market_stats = {}
f.seek(0)
reader = csv.DictReader(f)
for row in reader:
    market = row['marketName']
    action = row['action']
    usdc = float(row['usdcAmount']) if row['usdcAmount'] else 0.0
    ts = int(row['timestamp'])
    
    if market not in market_stats:
        market_stats[market] = {'cost': 0.0, 'return': 0.0, 'last_update': 0}
        
    if action == 'Buy':
        market_stats[market]['cost'] += usdc
        market_stats[market]['last_update'] = max(market_stats[market]['last_update'], ts)
    elif action in ['Sell', 'Redeem']:
        market_stats[market]['return'] += usdc
        market_stats[market]['last_update'] = max(market_stats[market]['last_update'], ts)

closed_pnl_today = 0.0
closed_markets_count = 0
for m, d in market_stats.items():
    dt_local = datetime.datetime.fromtimestamp(d['last_update'], datetime.UTC) - datetime.timedelta(hours=3)
    # If the market had activity or resolved in the last 24h
    if (today_local - dt_local).total_seconds() < 86400:
        # If it has a return, it's considered resolved/sold
        if d['return'] > 0:
            closed_pnl_today += (d['return'] - d['cost'])
            closed_markets_count += 1

print(f"\nRealized PnL (Closed positions today): ${closed_pnl_today:,.2f} over {closed_markets_count} markets")
