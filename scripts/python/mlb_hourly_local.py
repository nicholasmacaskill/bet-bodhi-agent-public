import csv
import datetime
from collections import defaultdict

file_path = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-04-12.csv'
offset = -3 # Based on user metadata -03:00

market_results = defaultdict(lambda: {'cost': 0.0, 'return': 0.0, 'buys': []})
mlb_teams = ["Astros", "Mariners", "Angels", "Reds", "Dodgers", "Rangers", "Rockies", "Padres", "Pirates", "Cubs", "Nationals", "Brewers", "Red Sox", "Cardinals", "Marlins", "Tigers", "Twins", "Royals", "Athletics", "Yankees", "Guardians", "Braves", "Orioles", "White Sox", "Phillies", "Giants", "Blue Jays", "Mets", "Diamondbacks", "Rays"]

with open(file_path, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        market = row['marketName']
        if not any(t in market for t in mlb_teams):
            continue
        action = row['action']
        usdc = float(row['usdcAmount']) if row['usdcAmount'] else 0.0
        ts = int(row['timestamp'])
        if action == 'Buy':
            market_results[market]['cost'] += usdc
            market_results[market]['buys'].append(ts)
        elif action in ['Sell', 'Redeem']:
            market_results[market]['return'] += usdc

hour_pnl = defaultdict(float)
hour_vol = defaultdict(float)

for market, data in market_results.items():
    if not data['buys']: continue
    pnl = data['return'] - data['cost']
    # Use the first buy for the timestamp
    dt_utc = datetime.datetime.fromtimestamp(min(data['buys']), datetime.UTC)
    # Convert to local time (UTC-3)
    dt_local = dt_utc + datetime.timedelta(hours=offset)
    hour = dt_local.hour
    hour_pnl[hour] += pnl
    hour_vol[hour] += data['cost']

print("--- MLB HOURLY PERFORMANCE (Local Time / -03:00) ---")
for h in range(24):
    if hour_vol[h] > 10:
        pnl = hour_pnl[h]
        vol = hour_vol[h]
        print(f"{h:02}:00: ${pnl:,.2f} \t(Vol: ${vol:,.2f})")
