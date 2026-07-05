package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ─── Data Structures for API ────────────────────────────────────────────────

type GammaMarket struct {
	ConditionID  string          `json:"conditionId"`
	Question     string          `json:"question"`
	Active       bool            `json:"active"`
	Closed       bool            `json:"closed"`
	ClobTokenIds json.RawMessage `json:"clobTokenIds"`
}

// GetTokenIDs dynamically decodes the clobTokenIds field which can be a native JSON array or a stringified JSON array
func (m *GammaMarket) GetTokenIDs() []string {
	if len(m.ClobTokenIds) == 0 {
		return nil
	}

	var tokenIDs []string
	// Try parsing as native array of strings
	if err := json.Unmarshal(m.ClobTokenIds, &tokenIDs); err == nil {
		return tokenIDs
	}

	// Try parsing as a JSON string containing an array
	var tokenStr string
	if err := json.Unmarshal(m.ClobTokenIds, &tokenStr); err == nil {
		var subTokenIDs []string
		if err := json.Unmarshal([]byte(tokenStr), &subTokenIDs); err == nil {
			return subTokenIDs
		}
	}

	return nil
}

type GammaEvent struct {
	Title       string        `json:"title"`
	Description string        `json:"description"`
	Markets     []GammaMarket `json:"markets"`
}

// ─── Data Structures for WebSocket ──────────────────────────────────────────

type WSMessage struct {
	EventType string `json:"event_type"`
	AssetID   string `json:"asset_id"`
	BestBid   string `json:"best_bid"`
	BestAsk   string `json:"best_ask"`
}

type SubscriptionPayload struct {
	Type                 string   `json:"type"`
	AssetsIDs            []string `json:"assets_ids"`
	CustomFeatureEnabled bool     `json:"custom_feature_enabled"`
}

// ─── In-Memory Market Cache ──────────────────────────────────────────────────

type MarketPair struct {
	Question    string
	ConditionID string
	YesTokenID  string
	NoTokenID   string
}

// Live Prices tracked in memory
type LivePrice struct {
	Bid float64
	Ask float64
}

var (
	marketsMap = make(map[string]*MarketPair) // TokenID -> Market Info
	pricesMap  = make(map[string]LivePrice)  // TokenID -> Live Prices
	pricesMu   sync.RWMutex
)

// ANSI colors for console output
const (
	Reset   = "\033[0m"
	Bold    = "\033[1m"
	Green   = "\033[32m"
	Yellow  = "\033[33m"
	Cyan    = "\033[36m"
	Magenta = "\033[35m"
	Gray    = "\033[90m"
)

func main() {
	fmt.Printf("\n%s%s🏹 BODHI GO LOW-LATENCY WEBSOCKET SCANNER%s\n", Cyan, Bold, Reset)
	fmt.Printf("%s────────────────────────────────────────────────%s\n", Gray, Reset)
	fmt.Printf("%sMode: READ-ONLY | Streaming top matchup markets%s\n\n", Gray, Reset)

	// Step 1: Fetch active matchup markets from Gamma API
	fmt.Println("Fetching sports slate from Gamma API...")
	allMarkets, err := fetchMatchupMarkets()
	if err != nil {
		log.Fatalf("Failed to fetch markets: %v", err)
	}
	fmt.Printf("Loaded %d active match-up markets for tracking.\n", len(allMarkets))

	// Map them so we can easily look them up by TokenID and build subscription list
	var subscriptionTokens []string
	for _, m := range allMarkets {
		tokenIDs := m.GetTokenIDs()
		if len(tokenIDs) < 2 {
			continue
		}
		// Store pointers to the same pair in map for both YES and NO tokens
		pair := &MarketPair{
			Question:    m.Question,
			ConditionID: m.ConditionID,
			YesTokenID:  tokenIDs[0],
			NoTokenID:   tokenIDs[1],
		}
		marketsMap[pair.YesTokenID] = pair
		marketsMap[pair.NoTokenID] = pair

		subscriptionTokens = append(subscriptionTokens, pair.YesTokenID, pair.NoTokenID)
	}

	// Step 2: Connect to Polymarket CLOB WebSockets
	wsURL := "wss://ws-subscriptions-clob.polymarket.com/ws/market"
	fmt.Printf("Connecting to CLOB WebSocket at %s...\n", wsURL)
	
	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		log.Fatalf("WebSocket connection failed: %v", err)
	}
	defer conn.Close()
	fmt.Println("✅ Connected successfully!")

	// Step 3: Subscribe to the markets we fetched
	subPayload := SubscriptionPayload{
		Type:                 "market",
		AssetsIDs:            subscriptionTokens,
		CustomFeatureEnabled: true,
	}

	subJSON, err := json.Marshal(subPayload)
	if err != nil {
		log.Fatalf("Failed to marshal subscription payload: %v", err)
	}

	err = conn.WriteMessage(websocket.TextMessage, subJSON)
	if err != nil {
		log.Fatalf("Failed to send subscription: %v", err)
	}
	fmt.Printf("🎯 Subscribed to %d token order books.\n\n", len(subscriptionTokens))

	// Step 4: Start message listening loop
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Read error: %v", err)
			break
		}

		// Parse the message
		var wsMsg WSMessage
		if err := json.Unmarshal(msg, &wsMsg); err != nil {
			continue
		}

		// We only care about the best_bid_ask event type
		if wsMsg.EventType == "best_bid_ask" {
			processPriceUpdate(wsMsg)
		}
	}
}

// fetchMatchupMarkets queries Gamma API and filters out everything except current matchups (vs, @)
func fetchMatchupMarkets() ([]GammaMarket, error) {
	url := "https://gamma-api.polymarket.com/events?active=true&closed=false&limit=1000"
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var events []GammaEvent
	if err := json.Unmarshal(body, &events); err != nil {
		return nil, err
	}

	var matchupMarkets []GammaMarket
	for _, event := range events {
		title := strings.ToLower(event.Title)
		
		// Filter: Skip long-term season futures and championship winner markets
		if strings.Contains(title, "2025") || strings.Contains(title, "2026") || strings.Contains(title, "2027") {
			continue
		}
		if strings.Contains(title, "champion") || strings.Contains(title, "championship") || strings.Contains(title, "winner") {
			continue
		}

		// Filter: Matchups only
		if strings.Contains(title, " vs ") || strings.Contains(title, " vs. ") || strings.Contains(title, " @ ") {
			for _, m := range event.Markets {
				if m.Active && !m.Closed && len(m.GetTokenIDs()) >= 2 {
					// Add event context to question name if not present
					m.Question = fmt.Sprintf("%s (%s)", m.Question, event.Title)
					matchupMarkets = append(matchupMarkets, m)
				}
			}
		}
	}

	// Limit to top 50 matchups to avoid hitting network/API rate ceilings in this script
	if len(matchupMarkets) > 50 {
		matchupMarkets = matchupMarkets[:50]
	}

	return matchupMarkets, nil
}

// processPriceUpdate parses prices, updates state, and runs the arb math
func processPriceUpdate(msg WSMessage) {
	pricesMu.Lock()
	defer pricesMu.Unlock()

	// Parse strings to float64
	var bid, ask float64
	fmt.Sscanf(msg.BestBid, "%f", &bid)
	fmt.Sscanf(msg.BestAsk, "%f", &ask)

	// Save to live map
	pricesMap[msg.AssetID] = LivePrice{Bid: bid, Ask: ask}

	// Get parent market info
	market, exists := marketsMap[msg.AssetID]
	if !exists {
		return
	}

	// Fetch prices for both legs of the market
	yesPrice, yesExists := pricesMap[market.YesTokenID]
	noPrice, noExists := pricesMap[market.NoTokenID]

	// If we don't have prices for both YES and NO yet, we can't run arb math
	if !yesExists || !noExists {
		return
	}

	// ─── 1. MERGE ARBITRAGE MATH ──────────────────────────────────────────────
	// Buy YES and Buy NO for less than $1.00
	mergeCost := yesPrice.Ask + noPrice.Ask
	if mergeCost > 0 && mergeCost < 1.00 {
		mergeProfit := 1.00 - mergeCost
		mergeYield := (mergeProfit / mergeCost) * 100

		// Simple filter: only print if yield is positive and realistic (>0.1%)
		if mergeYield >= 0.1 {
			fmt.Printf("\n🎉 %s%s[MERGE ARB DETECTED]%s %s\n", Green, Bold, Reset, market.Question)
			fmt.Printf("   └ YES ask: $%.3f | NO ask: $%.3f | Combined Cost: $%.3f\n", yesPrice.Ask, noPrice.Ask, mergeCost)
			fmt.Printf("   └ %sYield: %.2f%%%s\n", Bold, mergeYield, Reset)
			fmt.Printf("   └ Condition ID: %s\n", market.ConditionID)
			fmt.Printf("   └ Action: Buy YES on book & Buy NO on book\n")
		}
	}

	// ─── 2. SPLIT ARBITRAGE MATH ──────────────────────────────────────────────
	// Mint YES+NO for $1.00 and sell both for more than $1.00
	splitRevenue := yesPrice.Bid + noPrice.Bid
	if splitRevenue > 1.00 {
		splitProfit := splitRevenue - 1.00
		splitYield := (splitProfit / 1.00) * 100

		if splitYield >= 0.1 {
			fmt.Printf("\n🎉 %s%s[SPLIT ARB DETECTED]%s %s\n", Green, Bold, Reset, market.Question)
			fmt.Printf("   └ YES bid: $%.3f | NO bid: $%.3f | Combined Bids: $%.3f\n", yesPrice.Bid, noPrice.Bid, splitRevenue)
			fmt.Printf("   └ %sYield: %.2f%%%s\n", Bold, splitYield, Reset)
			fmt.Printf("   └ Condition ID: %s\n", market.ConditionID)
			fmt.Printf("   └ Action: Split contract for $1.00 and Sell YES + Sell NO\n")
		}
	}
}

// Helper to format timestamps
func formatTime() string {
	return time.Now().Format("15:04:05")
}

