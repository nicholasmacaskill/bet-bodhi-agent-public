import os
import glob
import csv
from collections import defaultdict
import datetime

def calculate_win_rate():
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

    # Group by market
    market_data = defaultdict(lambda: {'cost': 0.0, 'return': 0.0, 'is_sports': False, 'resolved': False})

    # Sports detection keywords
    sports_keywords = [' vs. ', 'KBO:', 'MLB:', 'NHL:', 'NBA:', 'NFL:', 'Premier League', 'UFC', 'Tennis']

    for tx in transactions.values():
        market = tx['marketName']
        action = tx['action']
        usdc = float(tx['usdcAmount']) if tx['usdcAmount'] else 0.0
        
        # Check if it's a sports market
        is_sports = any(kw in market for kw in sports_keywords)
        if not is_sports and ('Buy' in action or 'Sell' in action or 'Redeem' in action):
            if ' vs ' in market.lower():
                is_sports = True
        
        if not is_sports:
            continue
            
        market_data[market]['is_sports'] = True
        
        if action == 'Buy':
            market_data[market]['cost'] += usdc
        elif action in ['Sell', 'Redeem']:
            market_data[market]['return'] += usdc
            market_data[market]['resolved'] = True

    # Stats
    total_sports_markets = 0
    resolved_sports_markets = 0
    wins = 0
    losses = 0
    
    kbo_stats = {'total': 0, 'wins': 0}
    mlb_stats = {'total': 0, 'wins': 0}

    now_ts = datetime.datetime.now().timestamp()
    one_week_ago = now_ts - (7 * 24 * 60 * 60)
    one_day_ago = now_ts - (24 * 60 * 60)

    recent_stats = {'total': 0, 'wins': 0}
    daily_stats = {'total': 0, 'wins': 0}

    for market, data in market_data.items():
        if not data['is_sports']:
            continue
            
        total_sports_markets += 1
        
        if data['resolved'] or data['return'] > 0:
            resolved_sports_markets += 1
            
            is_win = data['return'] > data['cost']
            if is_win:
                wins += 1
            else:
                losses += 1
                
            # Time-based check
            market_txs = [tx for tx in transactions.values() if tx['marketName'] == market]
            max_ts = max(int(tx['timestamp']) for tx in market_txs)
            
            if max_ts > one_week_ago:
                recent_stats['total'] += 1
                if is_win: recent_stats['wins'] += 1
                
            if max_ts > one_day_ago:
                daily_stats['total'] += 1
                if is_win: daily_stats['wins'] += 1

            if 'KBO:' in market:
                kbo_stats['total'] += 1
                if is_win: kbo_stats['wins'] += 1
            if 'MLB' in market or any(team in market for team in ['Yankees', 'Dodgers', 'Red Sox', 'Cubs']):
                mlb_stats['total'] += 1
                if is_win: mlb_stats['wins'] += 1

    win_rate = (wins / resolved_sports_markets * 100) if resolved_sports_markets > 0 else 0

    print(f"--- SPORTS WIN RATE REPORT ---")
    print(f"Total Sports Markets: {total_sports_markets}")
    print(f"Resolved Sports Markets: {resolved_sports_markets}")
    print(f"Wins: {wins}")
    print(f"Losses: {losses}")
    print(f"Overall Win Rate: {win_rate:.2f}%")
    
    if recent_stats['total'] > 0:
        recent_rate = (recent_stats['wins'] / recent_stats['total'] * 100)
        print(f"Last 7 Days Win Rate: {recent_rate:.2f}% ({recent_stats['wins']}/{recent_stats['total']})")

    if daily_stats['total'] > 0:
        daily_rate = (daily_stats['wins'] / daily_stats['total'] * 100)
        print(f"Last 24 Hours Win Rate: {daily_rate:.2f}% ({daily_stats['wins']}/{daily_stats['total']})")
        
    if kbo_stats['total'] > 0:
        kbo_rate = (kbo_stats['wins'] / kbo_stats['total'] * 100)
        print(f"KBO Overall Win Rate: {kbo_rate:.2f}% ({kbo_stats['wins']}/{kbo_stats['total']})")
        
    if mlb_stats['total'] > 0:
        mlb_rate = (mlb_stats['wins'] / mlb_stats['total'] * 100)
        print(f"MLB Overall Win Rate: {mlb_rate:.2f}% ({mlb_stats['wins']}/{mlb_stats['total']})")

if __name__ == "__main__":
    calculate_win_rate()
