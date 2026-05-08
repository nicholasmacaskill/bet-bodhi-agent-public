import csv
import datetime
from collections import defaultdict

file_path = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-04-12.csv'

# Market data
market_results = defaultdict(lambda: {'cost': 0.0, 'return': 0.0, 'buys': [], 'teams': set()})

mlb_teams = ["Astros", "Mariners", "Angels", "Reds", "Dodgers", "Rangers", "Rockies", "Padres", "Pirates", "Cubs", "Nationals", "Brewers", "Red Sox", "Cardinals", "Marlins", "Tigers", "Twins", "Royals", "Athletics", "Yankees", "Guardians", "Braves", "Orioles", "White Sox", "Phillies", "Giants", "Blue Jays", "Mets", "Diamondbacks", "Rays"]

with open(file_path, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        market = row['marketName']
        if not any(t in market for t in mlb_teams):
            continue
            
        action = row['action']
        usdc = float(row['usdcAmount']) if row['usdcAmount'] else 0.0
        tokens = float(row['tokenAmount']) if row['tokenAmount'] else 0.0
        ts = int(row['timestamp'])
        team = row['tokenName']
        
        if action == 'Buy':
            price = usdc / tokens if tokens > 0 else 0
            market_results[market]['cost'] += usdc
            market_results[market]['buys'].append({'ts': ts, 'price': price, 'usdc': usdc})
            if team: market_results[market]['teams'].add(team)
        elif action in ['Sell', 'Redeem']:
            market_results[market]['return'] += usdc

# Analyze Trends
underdog_pnl = 0
favorite_pnl = 0
underdog_vol = 0
favorite_vol = 0

hour_pnl = defaultdict(float)
hour_vol = defaultdict(float)

live_pnl = 0
live_vol = 0
pre_pnl = 0
pre_vol = 0

for market, data in market_results.items():
    pnl = data['return'] - data['cost']
    
    # Analyze first buy to determine dog vs fav
    if not data['buys']: continue
    
    # Sort buys by timestamp
    data['buys'].sort(key=lambda x: x['ts'])
    first_buy = data['buys'][0]
    
    # Avg Price determination
    avg_price = data['cost'] / sum(b['usdc']/b['price'] for b in data['buys'] if b['price'] > 0) if data['buys'] else 0
    
    if avg_price < 0.48: # Underdog (leaving buffer for vig)
        underdog_pnl += pnl
        underdog_vol += data['cost']
    else:
        favorite_pnl += pnl
        favorite_vol += data['cost']
        
    # Time of Day (Hour in UTC)
    dt = datetime.datetime.fromtimestamp(first_buy['ts'], datetime.UTC)
    hour = dt.hour
    hour_pnl[hour] += pnl
    hour_vol[hour] += data['cost']
    
    # Live vs Pre-match
    # Rule: If buys happen over a span of > 1 hour, or first buy is within 3 hours of subsequent buys, it might be live.
    # More simply: if we buy once and don't touch it, it's likely pre-match. 
    # If we buy and then buy again > 2 hours later, it's likely live.
    time_span = data['buys'][-1]['ts'] - data['buys'][0]['ts']
    if time_span > 7200: # 2 hours
        live_pnl += pnl
        live_vol += data['cost']
    else:
        pre_pnl += pnl
        pre_vol += data['cost']

print("--- MLB DEEP TRENDS (CLOSED POSITIONS ONLY) ---")
print(f"\nMarket Bias:")
print(f"Underdogs (<$0.48): ${underdog_pnl:,.2f} PnL on ${underdog_vol:,.2f} Vol (ROI: {(underdog_pnl/underdog_vol*100):.1f}% if vol > 0 else 0)")
print(f"Favorites (>$0.48): ${favorite_pnl:,.2f} PnL on ${favorite_vol:,.2f} Vol (ROI: {(favorite_pnl/favorite_vol*100):.1f}% if vol > 0 else 0)")

print(f"\nTiming Bias:")
print(f"Pre-Match: ${pre_pnl:,.2f} PnL on ${pre_vol:,.2f} Vol (ROI: {(pre_pnl/pre_vol*100):.1f}%)")
print(f"Live/Chased: ${live_pnl:,.2f} PnL on ${live_vol:,.2f} Vol (ROI: {(live_pnl/live_vol*100):.1f}%)")

print(f"\nHourly Performance (UTC Window):")
for h in sorted(hour_pnl.keys()):
    vol = hour_vol[h]
    pnl = hour_pnl[h]
    if vol > 20: # Filter for noise
        print(f"{h:02}h: ${pnl:,.2f} (Vol: ${vol:,.2f})")

print(f"\nLoss Triggers (Biggest Loss Factors):")
# Identify if "Averaging Down" is a thing
averaging_down_pnl = 0
for m, d in market_results.items():
    if len(d['buys']) > 1:
        # Check if second buy is cheaper than first
        if d['buys'][1]['price'] < d['buys'][0]['price']:
            averaging_down_pnl += (d['return'] - d['cost'])
print(f"Averaging Down (Buying cheaper after initial entry): ${averaging_down_pnl:,.2f}")
