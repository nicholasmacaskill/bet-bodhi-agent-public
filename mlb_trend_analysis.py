import csv
from collections import defaultdict

file_path = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-04-12.csv'

# Market data: market_name -> {'pnl': float, 'buy_vol': float, 'teams': set}
market_stats = defaultdict(lambda: {'pnl': 0.0, 'buy_vol': 0.0, 'teams': set()})
team_stats = defaultdict(lambda: {'pnl': 0.0, 'buy_vol': 0.0, 'wins': 0, 'losses': 0})

with open(file_path, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        market = row['marketName']
        # Filter for MLB (approximate check)
        mlb_teams = ["Astros", "Mariners", "Angels", "Reds", "Dodgers", "Rangers", "Rockies", "Padres", "Pirates", "Cubs", "Nationals", "Brewers", "Red Sox", "Cardinals", "Marlins", "Tigers", "Twins", "Royals", "Athletics", "Yankees", "Guardians", "Braves", "Orioles", "White Sox", "Phillies", "Giants", "Blue Jays", "Mets", "Diamondbacks", "Tampa Bay Rays"]
        if not any(t in market for t in mlb_teams):
            continue

        action = row['action']
        usdc = float(row['usdcAmount']) if row['usdcAmount'] else 0.0
        team = row['tokenName']
        
        if action == 'Buy':
            market_stats[market]['pnl'] -= usdc
            market_stats[market]['buy_vol'] += usdc
            if team: market_stats[market]['teams'].add(team)
        elif action in ['Sell', 'Redeem']:
            market_stats[market]['pnl'] += usdc

# Aggregate by main team bet upon
for market, data in market_stats.items():
    pnl = data['pnl']
    teams = list(data['teams'])
    # If a market has a specific token name, attribute PnL to that team
    if teams:
        for t in teams:
            team_stats[t]['pnl'] += (pnl / len(teams)) # Distribute PnL if multiple teams (rare in winner markets)
            team_stats[t]['buy_vol'] += (data['buy_vol'] / len(teams))
            if pnl > 0.01:
                team_stats[t]['wins'] += 1
            else:
                team_stats[t]['losses'] += 1
    else:
        # If no token name (Redeem row might lack it), we attribute to the market as "General/Unknown"
        pass

print("--- MLB TREND ANALYSIS ---")
total_pnl = sum(m['pnl'] for m in market_stats.values())
total_vol = sum(m['buy_vol'] for m in market_stats.values())
print(f"Total MLB PnL: ${total_pnl:,.2f}")
print(f"Total Capital Wagered: ${total_vol:,.2f}")
print(f"Overall ROI: {(total_pnl/total_vol*100):.1f}%" if total_vol > 0 else "ROI: N/A")

print("\n--- WINNINGEST TEAMS ---")
winners = sorted([item for item in team_stats.items() if item[1]['pnl'] > 0], key=lambda x: x[1]['pnl'], reverse=True)
for team, stats in winners:
    print(f"{team}: +${stats['pnl']:,.2f} (Wins: {stats['wins']}, Vol: ${stats['buy_vol']:,.2f})")

print("\n--- BIGGEST MONEY SINKS (TRENDING DOWN) ---")
losers = sorted([item for item in team_stats.items() if item[1]['pnl'] <= 0], key=lambda x: x[1]['pnl'])
for team, stats in losers[:8]:
    print(f"{team}: ${stats['pnl']:,.2f} (Losses: {stats['losses']}, Vol: ${stats['buy_vol']:,.2f})")

# Trends based on market naming
print("\n--- STRATEGY TRENDS ---")
spread_pnl = sum(m['pnl'] for k, m in market_stats.items() if 'Spread:' in k)
spread_vol = sum(m['buy_vol'] for k, m in market_stats.items() if 'Spread:' in k)
print(f"Spread Bets: ${spread_pnl:,.2f} PnL on ${spread_vol:,.2f} Vol")

moneyline_pnl = sum(m['pnl'] for k, m in market_stats.items() if ' vs. ' in k and 'Spread:' not in k)
moneyline_vol = sum(m['buy_vol'] for k, m in market_stats.items() if ' vs. ' in k and 'Spread:' not in k)
print(f"Moneyline Bets: ${moneyline_pnl:,.2f} PnL on ${moneyline_vol:,.2f} Vol")
