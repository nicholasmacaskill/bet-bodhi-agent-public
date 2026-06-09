import os
import glob
import csv
from collections import defaultdict

def analyze_baseball_profit():
    downloads_dir = os.path.expanduser('~/Downloads')
    pattern = os.path.join(downloads_dir, 'Polymarket-History-*.csv')
    files = glob.glob(pattern)

    if not files:
        print("No Polymarket history files found.")
        return

    # De-duplicate transactions by hash
    transactions = {}
    for file_path in files:
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    tx_hash = row.get('hash')
                    if tx_hash:
                        transactions[tx_hash] = row
        except Exception as e:
            print(f"Error reading {file_path}: {e}")

    baseball_markets = defaultdict(lambda: {'cost': 0.0, 'return': 0.0, 'is_baseball': False})

    baseball_keywords = ['KBO:', 'MLB:', 'Yankees', 'Dodgers', 'Red Sox', 'Cubs', 'Braves', 'Phillies', 'Astros']

    for tx in transactions.values():
        market = tx['marketName']
        is_baseball = any(kw in market for kw in baseball_keywords)
        
        # Another check for baseball vs
        if not is_baseball and ' vs ' in market:
            # Check if it has baseball terms, though maybe we just rely on MLB/KBO
            pass

        if not is_baseball:
            continue
            
        baseball_markets[market]['is_baseball'] = True
        
        action = tx['action']
        usdc = float(tx.get('usdcAmount', 0) or 0.0)
        
        if action == 'Buy':
            baseball_markets[market]['cost'] += usdc
        elif action in ['Sell', 'Redeem']:
            baseball_markets[market]['return'] += usdc

    total_cost = 0.0
    total_return = 0.0
    kbo_profit = 0.0
    mlb_profit = 0.0
    resolved_markets = 0
    
    for market, data in baseball_markets.items():
        # Only count resolved or sold markets (where we have returns or cost > 0 but we assume older ones are closed)
        # To be safe on "profit", we can just sum all returns minus all costs for closed markets, 
        # or just sum all returns minus all costs across everything (which includes open bets as negative PnL right now)
        # Let's separate "Realized Profit" (markets with returns or verified closed) and "Total Net"
        
        # A market is likely resolved if return > 0 or it's old. For simplicity, just use net = return - cost
        profit = data['return'] - data['cost']
        
        total_cost += data['cost']
        total_return += data['return']
        
        if 'KBO:' in market:
            kbo_profit += profit
        else:
            mlb_profit += profit

        if data['return'] > 0 or data['cost'] > 0:
            resolved_markets += 1

    total_profit = total_return - total_cost

    print("--- ALL-TIME BASEBALL PNL ---")
    print(f"Total Baseball Markets Traded: {resolved_markets}")
    print(f"Total USDC Spent (Cost): ${total_cost:.2f}")
    print(f"Total USDC Received (Return): ${total_return:.2f}")
    print(f"\nNet KBO Profit: ${kbo_profit:.2f}")
    print(f"Net MLB Profit: ${mlb_profit:.2f}")
    print(f"--------------------------------")
    print(f"TOTAL BASEBALL PROFIT: ${total_profit:.2f}")

if __name__ == "__main__":
    analyze_baseball_profit()
