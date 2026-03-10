-- Migration: Add External ID and Platform to Bets for Synchronization
-- Enables tracking of bets from Polymarket and SxBet platforms.

ALTER TABLE public.bets 
ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'manual';

-- Index for fast lookup during synchronization
CREATE INDEX IF NOT EXISTS idx_bets_external_id ON public.bets(external_id);
CREATE INDEX IF NOT EXISTS idx_bets_platform ON public.bets(platform);

-- Add platform enum check if desired (optional, keeping as TEXT for flexibility)
-- ALTER TABLE public.bets ADD CONSTRAINT platform_check CHECK (platform IN ('manual', 'polymarket', 'sx', 'agent'));
