import os
import glob
import csv
from collections import defaultdict
import datetime

def analyze_kbo():
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

    kbo_markets = defaultdict(lambda: {'cost': 0.0, 'return': 0.0, 'buys': [], 'sells': []})

    for tx in transactions.values():
        market = tx['marketName']
        if 'KBO:' not in market:
            continue
            
        action = tx['action']
        usdc = float(tx.get('usdcAmount', 0) or 0.0)
        shares = float(tx.get('tokenAmount', 0) or 0.0)
        price = (usdc / shares) if shares > 0 else 0
        asset = tx.get('tokenName', 'Unknown')
        
        if action == 'Buy':
            kbo_markets[market]['cost'] += usdc
            kbo_markets[market]['buys'].append({'usdc': usdc, 'shares': shares, 'price': price, 'asset': asset})
        elif action in ['Sell', 'Redeem']:
            kbo_markets[market]['return'] += usdc
            kbo_markets[market]['sells'].append({'usdc': usdc, 'shares': shares, 'price': price, 'asset': asset})

    wins = []
    losses = []
    
    print("--- KBO BET ANALYSIS ---")
    
    for market, data in kbo_markets.items():
        if data['return'] > 0 or data['cost'] > 0:
            is_win = data['return'] > data['cost']
            
            total_shares_bought = sum(b['shares'] for b in data['buys'])
            avg_buy_price = data['cost'] / total_shares_bought if total_shares_bought > 0 else 0
            
            # Find the team they backed
            backed_asset = data['buys'][0]['asset'] if data['buys'] else 'Unknown'
            
            profit = data['return'] - data['cost']
            
            record = {
                'market': market,
                'team': backed_asset,
                'cost': data['cost'],
                'return': data['return'],
                'profit': profit,
                'avg_price': avg_buy_price,
                'num_buys': len(data['buys'])
            }
            
            if is_win:
                wins.append(record)
            elif data['return'] > 0 or data['sells']: # Meaning it's resolved and a loss, or they sold at a loss
                losses.append(record)
            else:
                # If there's no return and no sells, it might be open or zeroed out
                # Assuming if cost > 0 and no return, and old enough, it's a loss
                losses.append(record)

    wins = sorted(wins, key=lambda x: x['profit'], reverse=True)
    losses = sorted(losses, key=lambda x: x['profit'])

    print(f"Total Analyzed KBO Markets: {len(wins) + len(losses)}")
    print(f"Wins: {len(wins)}, Losses: {len(losses)}")
    
    if wins:
        avg_win_price = sum(w['avg_price'] for w in wins) / len(wins)
        avg_win_profit = sum(w['profit'] for w in wins) / len(wins)
        print(f"\nWinning Bets Average Buy Price: {avg_win_price:.3f}c")
        print(f"Average Profit per Win: ${avg_win_profit:.2f}")
    
    if losses:
        avg_loss_price = sum(l['avg_price'] for l in losses) / len(losses)
        avg_loss_loss = sum(l['profit'] for l in losses) / len(losses)
        print(f"\nLosing Bets Average Buy Price: {avg_loss_price:.3f}c")
        print(f"Average Loss per Loss: ${avg_loss_loss:.2f}")
        
    print("\n--- WINNING TRADES ---")
    for w in wins:
        print(f"[{w['avg_price']:.2f}c] {w['team']:<15} | Profit: ${w['profit']:>6.2f} | Market: {w['market'][:40]}...")

    print("\n--- LOSING TRADES ---")
    for l in losses:
        print(f"[{l['avg_price']:.2f}c] {l['team']:<15} | Loss: ${l['profit']:>6.2f} | Market: {l['market'][:40]}...")

if __name__ == "__main__":
    analyze_kbo()
