-- Migration: Add dedicated user_sentiment tracking table
-- Purpose: Store trader psychometric state at scan time for later
--          correlation analysis against bet results (sentiment vs win-rate).
--
-- This replaces the loose agent_internal_logs approach with a structured table
-- that can be JOIN'd against betting_opportunities via sentiment_id.

CREATE TABLE IF NOT EXISTS user_sentiment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Session reference — unix timestamp of the Telegram session that triggered the check
    session_id TEXT NOT NULL,

    -- Free-text mood descriptor (e.g. "focused", "tired", "stressed", "sharp")
    mood TEXT NOT NULL,

    -- Calmness score 1–10 (10 = fully composed, 1 = highly emotional/reactive)
    calmness INTEGER NOT NULL CHECK (calmness >= 1 AND calmness <= 10),

    -- Computed risk multiplier applied to all stakes in this session's report
    -- Values: 1.0 (full), 0.75 (caution), 0.5 (half)
    risk_multiplier REAL NOT NULL CHECK (risk_multiplier > 0 AND risk_multiplier <= 1.0),

    -- Source of the sentiment check (telegram_bot, manual, etc.)
    source TEXT NOT NULL DEFAULT 'telegram_bot',

    -- The report date this sentiment was tied to (YYYY-MM-DD)
    report_date TEXT NOT NULL
);

-- Indexes for analysis queries
CREATE INDEX IF NOT EXISTS idx_user_sentiment_created_at ON user_sentiment(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sentiment_report_date ON user_sentiment(report_date);
CREATE INDEX IF NOT EXISTS idx_user_sentiment_mood ON user_sentiment(mood);
CREATE INDEX IF NOT EXISTS idx_user_sentiment_calmness ON user_sentiment(calmness);

-- Comments for documentation
COMMENT ON TABLE user_sentiment IS
    'Trader psychometric state captured via Telegram before each report scan. '
    'Used to correlate emotional/physical state against betting outcomes over time.';

COMMENT ON COLUMN user_sentiment.calmness IS
    'Self-reported calmness on a 1–10 scale. Below 6 triggers a 0.75x risk multiplier; '
    'below 6 with negative mood keywords triggers 0.5x.';

COMMENT ON COLUMN user_sentiment.risk_multiplier IS
    'Computed multiplier applied to all suggestedStake values in the scan. '
    '1.0 = full size, 0.75 = caution, 0.5 = half size.';

-- ─── Link sentiment to betting opportunities ─────────────────────────────────
-- Add sentiment_id FK to betting_opportunities so every scan row references
-- the emotional state that produced it.

ALTER TABLE betting_opportunities
    ADD COLUMN IF NOT EXISTS sentiment_id UUID REFERENCES user_sentiment(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_betting_opp_sentiment ON betting_opportunities(sentiment_id);

COMMENT ON COLUMN betting_opportunities.sentiment_id IS
    'FK to user_sentiment. Enables correlation queries: '
    'SELECT mood, calmness, win_rate FROM betting_opportunities JOIN user_sentiment ...';
