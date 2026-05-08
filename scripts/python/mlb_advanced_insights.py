import csv
import datetime
from collections import defaultdict

file_path = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-04-12.csv'

market_stats = defaultdict(lambda: {'cost': 0.0, 'return': 0.0, 'buys': [], 'sells': []})
mlb_teams = ["Astros", "Mariners", "Angels", "Reds", "Dodgers", "Rangers", "Rockies", "Padres", "Pirates", "Cubs", "Nationals", "Brewers", "Red Sox", "Cardinals", "Marlins", "Tigers", "Twins", "Royals", "Athletics", "Yankees", "Guardians", "Braves", "Orioles", "White Sox", "Phillies", "Giants", "Blue Jays", "Mets", "Diamondbacks", "Rays"]

with open(file_path, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        market = row['marketName']
        if not any(t in market for t in mlb_teams): continue
        action = row['action']
        usdc = float(row['usdcAmount']) if row['usdcAmount'] else 0.0
        ts = int(row['timestamp'])
        if action == 'Buy':
            market_stats[market]['cost'] += usdc
            market_stats[market]['buys'].append({'ts': ts, 'usdc': usdc})
        elif action in ['Sell', 'Redeem']:
            market_stats[market]['return'] += usdc
            if action == 'Sell':
                market_stats[market]['sells'].append({'ts': ts, 'usdc': usdc})

# 1. Sizing Analysis: Does bet size correlate with ROI?
small_bets_pnl = 0
large_bets_pnl = 0
small_bets_vol = 0
large_bets_vol = 0

# 2. Churn Analysis: Are they "paper handing" or over-managing?
managed_markets_pnl = 0 # Markets with more than 1 buy or at least 1 sell
single_shot_pnl = 0 # Markets with 1 buy and no sells before redeem

# 3. Recency/Tilt Check: PnL after a winning vs losing market
sorted_markets = []
for m, d in market_stats.items():
    if not d['buys']: continue
    pnl = d['return'] - d['cost']
    first_buy_ts = min(b['ts'] for b in d['buys'])
    sorted_markets.append({'name': m, 'pnl': pnl, 'vol': d['cost'], 'ts': first_buy_ts, 'num_buys': len(d['buys']), 'num_sells': len(d['sells'])})

sorted_markets.sort(key=lambda x: x['ts'])

for m in sorted_markets:
    if m['vol'] > 50:
        large_bets_pnl += m['pnl']
        large_bets_vol += m['vol']
    else:
        small_bets_pnl += m['pnl']
        small_bets_vol += m['vol']
        
    if m['num_buys'] > 1 or m['num_sells'] > 0:
        managed_markets_pnl += m['pnl']
    else:
        single_shot_pnl += m['pnl']

print("--- ADVANCED MLB INSIGHTS ---")
print(f"\n1. SIZING EFFICIENCY:")
print(f"Large Bets (>$50 per market): ${large_bets_pnl:,.2f} PnL on ${large_bets_vol:,.2f} Vol (ROI: {(large_bets_pnl/large_bets_vol*100):.1f}%)")
print(f"Small Bets (<$50 per market): ${small_bets_pnl:,.2f} PnL on ${small_bets_vol:,.2f} Vol (ROI: {(small_bets_pnl/small_bets_vol*100):.1f}%)")

print(f"\n2. TRADING STYLE:")
print(f"Set & Forget (1 buy, 0 early sells): ${single_shot_pnl:,.2f} PnL")
print(f"Active Management (Multi-buy/Sell early): ${managed_markets_pnl:,.2f} PnL")

print(f"\n3. THE 'TILT' TEST (PnL following a loss):")
tilt_trades = 0
tilt_pnl = 0
for i in range(1, len(sorted_markets)):
    prev = sorted_markets[i-1]
    curr = sorted_markets[i]
    if prev['pnl'] < -5: # Significant loss
        time_diff = curr['ts'] - prev['ts']
        if time_diff < 7200: # Within 2 hours of previous market entry
            tilt_trades += 1
            tilt_pnl += curr['pnl']

print(f"Bets placed within 2h of a -$5 loss: {tilt_trades} trades, ${tilt_pnl:,.2f} total PnL")

print(f"\n4. TEAM SPECIFIC CURSES:")
team_names = defaultdict(lambda: {'pnl': 0.0, 'vol': 0.0})
for m, d in market_stats.items():
    pnl = d['return'] - d['cost']
    for t in mlb_teams:
        if t in m:
            team_names[t]['pnl'] += pnl
            team_names[t]['vol'] += d['cost']

worst_teams = sorted(team_names.items(), key=lambda x: x[1]['pnl'])[:3]
for team, data in worst_teams:
    print(f"The {team} Curse: ${data['pnl']:,.2f} total loss")
