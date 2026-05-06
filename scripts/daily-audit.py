import csv
import datetime
import os
from collections import defaultdict

# --- CONFIGURATION ---
CSV_PATH = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-04-15 (1).csv'
REPORTS_DIR = '/Users/nicholasmacaskill/Downloads/bet-bodhi/reports/audits'
LOCAL_OFFSET = -3 # ADT
TILT_THRESHOLD = -5.0 # Dollars

# --- DATA STRUCTURES ---
market_stats = defaultdict(lambda: {'cost': 0.0, 'return': 0.0, 'buys': [], 'sells': []})
team_performance = defaultdict(lambda: {'pnl': 0.0, 'vol': 0.0})
hourly_pnl = defaultdict(float)
hourly_vol = defaultdict(float)

MLB_TEAMS = ["Astros", "Mariners", "Angels", "Reds", "Dodgers", "Rangers", "Rockies", "Padres", "Pirates", "Cubs", "Nationals", "Brewers", "Red Sox", "Cardinals", "Marlins", "Tigers", "Twins", "Royals", "Athletics", "Yankees", "Guardians", "Braves", "Orioles", "White Sox", "Phillies", "Giants", "Blue Jays", "Mets", "Diamondbacks", "Rays"]

def generate_audit():
    if not os.path.exists(CSV_PATH):
        print(f"Error: CSV not found at {CSV_PATH}")
        return

    with open(CSV_PATH, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            market = row['marketName']
            if not any(t in market for t in MLB_TEAMS): continue
            
            action = row['action']
            usdc = float(row['usdcAmount']) if row['usdcAmount'] else 0.0
            tokens = float(row['tokenAmount']) if row['tokenAmount'] else 0.0
            ts = int(row['timestamp'])
            team = row['tokenName']
            
            if action == 'Buy':
                price = usdc / tokens if tokens > 0 else 0
                market_stats[market]['cost'] += usdc
                market_stats[market]['buys'].append({'ts': ts, 'price': price, 'usdc': usdc})
            elif action in ['Sell', 'Redeem']:
                market_stats[market]['return'] += usdc
                if action == 'Sell':
                    market_stats[market]['sells'].append({'ts': ts, 'usdc': usdc})

    # --- PROCESS INSIGHTS ---
    active_markets = []
    total_wagered = 0
    total_returned = 0
    
    for m, d in market_stats.items():
        pnl = d['return'] - d['cost']
        total_wagered += d['cost']
        total_returned += d['return']
        
        first_buy_ts = min(b['ts'] for b in d['buys']) if d['buys'] else 0
        active_markets.append({
            'name': m, 'pnl': pnl, 'vol': d['cost'], 
            'ts': first_buy_ts, 'buys': sorted(d['buys'], key=lambda x: x['ts']),
            'num_sells': len(d['sells'])
        })
        
        # Team attribution
        for t in MLB_TEAMS:
            if t in m:
                team_performance[t]['pnl'] += pnl
                team_performance[t]['vol'] += d['cost']
        
        # Hourly
        dt_local = datetime.datetime.fromtimestamp(first_buy_ts, datetime.UTC) + datetime.timedelta(hours=LOCAL_OFFSET)
        hourly_pnl[dt_local.hour] += pnl
        hourly_vol[dt_local.hour] += d['cost']

    active_markets.sort(key=lambda x: x['ts'])
    
    # --- RENDER REPORT ---
    today_str = datetime.datetime.now().strftime('%Y-%m-%d')
    report_file = os.path.join(REPORTS_DIR, f"audit_{today_str}.md")
    
    with open(report_file, 'w') as f:
        f.write(f"# 🛡️ BODHI DAILY PERFORMANCE AUDIT: {today_str}\n\n")
        
        # Section 1: The Hard Numbers
        roi = (total_returned / total_wagered * 100) - 100 if total_wagered > 0 else 0
        status_emoji = "📈" if total_returned > total_wagered else "📉"
        f.write(f"## {status_emoji} PORTFOLIO SNAPSHOT\n")
        f.write(f"- **Net PnL**: ${total_returned - total_wagered:,.2f}\n")
        f.write(f"- **Total Capital Wagered**: ${total_wagered:,.2f}\n")
        f.write(f"- **Overall ROI**: {roi:.1f}%\n")
        f.write(f"- **System Pulse**: All positions marked 'Open' in history are treated as 100% loss.\n\n")

        # Section 2: Alpha Killers
        f.write(f"## ⚠️ ALPHA KILLERS (VULNERABILITIES)\n")
        
        # Tilt Check
        tilt_count = 0
        tilt_pnl = 0
        for i in range(1, len(active_markets)):
            prev = active_markets[i-1]
            curr = active_markets[i]
            if prev['pnl'] < TILT_THRESHOLD:
                if (curr['ts'] - prev['ts']) < 7200: # 2 hours
                    tilt_count += 1
                    tilt_pnl += curr['pnl']
        
        if tilt_count > 0:
            f.write(f"### 🛑 TILT WARNING\n")
            f.write(f"You placed **{tilt_count} trades** immediately following a loss today/recently. These 'revenge' trades have cost you **${abs(tilt_pnl):,.2f}**. Close the laptop after a -$5 hit.\n\n")

        # Sizing Check
        small_vol = sum(m['vol'] for m in active_markets if m['vol'] < 50)
        small_pnl = sum(m['pnl'] for m in active_markets if m['vol'] < 50)
        large_vol = sum(m['vol'] for m in active_markets if m['vol'] >= 50)
        large_pnl = sum(m['pnl'] for m in active_markets if m['vol'] >= 50)
        
        f.write(f"### 📏 SIZING AUDIT\n")
        f.write(f"| Size Bloom | ROI | Status |\n")
        f.write(f"| :--- | :---: | :--- |\n")
        f.write(f"| **Small (<$50)** | {(small_pnl/small_vol*100 if small_vol > 0 else 0):.1f}% | {'✅ Profitable' if small_pnl > 0 else '❌ Bleeding'} |\n")
        f.write(f"| **Large (>$50)** | {(large_pnl/large_vol*100 if large_vol > 0 else 0):.1f}% | {'✅ Scaling Well' if large_pnl > 0 else '🛑 DANGEROUS'} |\n\n")

        # Averaging Down Check
        avg_down_pnl = 0
        avg_down_count = 0
        for m in active_markets:
            if len(m['buys']) > 1 and m['buys'][1]['price'] < m['buys'][0]['price']:
                avg_down_count += 1
                avg_down_pnl += m['pnl']
        
        if avg_down_count > 0:
            f.write(f"### 📉 THE 'DIP' TRAP\n")
            f.write(f"You 'averaged down' (bought the dip) on **{avg_down_count}** losers. Net result: **${avg_down_pnl:,.2f}**. Stop adding to losing positions.\n\n")

        # Section 3: Performance Heatmap
        f.write(f"## ⏰ LOCAL TIME WINDOWS (ADT)\n")
        f.write(f"| Hour | Alpha Status | ROI |\n")
        f.write(f"| :--- | :--- | :---: |\n")
        for h in range(24):
            if hourly_vol[h] > 10:
                pnl = hourly_pnl[h]
                vol = hourly_vol[h]
                h_roi = (pnl/vol*100)
                label = "✅ GREEN" if pnl > 0 else "🛑 DANGER"
                f.write(f"| {h:02}:00 | {label} | {h_roi:.1f}% |\n")
        f.write("\n")

        # Section 4: Team Curses & Anchors
        f.write(f"## 🏟️ TEAM INTEL\n")
        sorted_teams = sorted(team_performance.items(), key=lambda x: x[1]['pnl'])
        f.write(f"- **Top Alpha Anchor**: {sorted_teams[-1][0]} (+${sorted_teams[-1][1]['pnl']:,.2f})\n")
        f.write(f"- **Top Capital Drain**: {sorted_teams[0][0]} (${sorted_teams[0][1]['pnl']:,.2f})\n\n")

        # Section 5: Golden Rules for Today
        f.write(f"## 💡 DAILY DIRECTIVES\n")
        f.write(f"1. **Ban List**: Do not touch the **{sorted_teams[0][0]}** or **{sorted_teams[1][0]}** today.\n")
        f.write(f"2. **Hard Ceiling**: Cap all positions at **$45**. Sizing up is currently your biggest PnL drain.\n")
        f.write(f"3. **Cooling Period**: If you hit a -$5 target, you must wait **4 hours** before the next entry.\n")
        f.write(f"4. **No Dips**: Only buy the 'Sovereign' entries pre-match. Chasing live or averaging down is mathematically failing.\n")

    print(f"✅ Daily Audit generated: {report_file}")

if __name__ == "__main__":
    generate_audit()
