-- Migration: Add Odds Tracking for Steam Chasing (v3.0)

CREATE TABLE IF NOT EXISTS public.odds_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id TEXT NOT NULL,          -- e.g. "mlb_810239" or espn unique ID
    sport TEXT NOT NULL,            -- e.g. "baseball_mlb"
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_odds DECIMAL,              -- Decimal format (e.g. 1.91)
    away_odds DECIMAL,
    home_run_line DECIMAL,          -- Expected spread points (e.g. -1.5)
    home_run_line_odds DECIMAL,
    away_run_line DECIMAL,
    away_run_line_odds DECIMAL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by game and time
CREATE INDEX IF NOT EXISTS idx_odds_history_game_id ON public.odds_history(game_id, recorded_at DESC);

-- RLS Policies
ALTER TABLE public.odds_history ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users (or anon if public)
CREATE POLICY "Allow public read access to odds history"
    ON public.odds_history FOR SELECT
    USING (true);

-- Allow insert from service role only
CREATE POLICY "Allow service role insert into odds history"
    ON public.odds_history FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
