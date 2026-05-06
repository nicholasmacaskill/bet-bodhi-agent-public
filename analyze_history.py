import csv
from collections import defaultdict

file_path = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-04-12.csv'

# Tracking
market_pnl = defaultdict(float)
team_pnl = defaultdict(float)
team_buy_vol = defaultdict(float)
category_pnl = defaultdict(float)

with open(file_path, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Debug: print row keys if needed
        # print(row.keys())
        action = row['action']
        if action in ['Deposit', 'Withdraw']:
            continue
            
        usdc_str = row['usdcAmount']
        usdc = float(usdc_str) if usdc_str else 0.0
        market = row['marketName']
        team = row['tokenName']
        
        # Simple category tagging
        if 'Up or Down' in market:
            cat = 'Crypto'
        elif ' vs. ' in market:
            # Check for common sports names or just classify as Sports
            cat = 'Sports'
        else:
            cat = 'Other'
            
        if action == 'Buy':
            category_pnl[cat] -= usdc
            market_pnl[market] -= usdc
            if team:
                team_pnl[team] -= usdc
                team_buy_vol[team] += usdc
        elif action in ['Sell', 'Redeem']:
            category_pnl[cat] += usdc
            market_pnl[market] += usdc
            if team:
                team_pnl[team] += usdc

print("--- PNL SUMMARY BY CATEGORY ---")
for cat, pnl in sorted(category_pnl.items(), key=lambda x: x[1], reverse=True):
    print(f"{cat}: ${pnl:,.2f}")

print("\n--- TOP 5 BIGGEST WINNING TEAMS/TOKENS (Realized/Closed) ---")
sorted_teams = sorted(team_pnl.items(), key=lambda x: x[1], reverse=True)
for team, pnl in sorted_teams[:5]:
    if team:
        print(f"{team}: ${pnl:,.2f} (Buy Vol: ${team_buy_vol[team]:,.2f})")

print("\n--- TOP 5 BIGGEST LOSSES/OPEN BUYS ---")
for team, pnl in sorted(sorted_teams, key=lambda x: x[1]):
    if pnl >= 0: break
    if team:
        print(f"{team}: ${pnl:,.2f} (Buy Vol: ${team_buy_vol[team]:,.2f})")

print("\n--- TOP 5 MOST ACTIVE MARKETS ---")
active_markets = sorted(market_pnl.items(), key=lambda x: abs(x[1]), reverse=True)
for market, pnl in active_markets[:5]:
    print(f"{market}: ${pnl:,.2f}")
