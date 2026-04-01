-- Migration: Add Payout column to Bets
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS payout NUMERIC DEFAULT 0;
