-- Migration: Add sleep score and daily steps to body_metrics
-- Run this in your Supabase SQL editor

ALTER TABLE body_metrics
  ADD COLUMN IF NOT EXISTS sleep_score smallint CHECK (sleep_score BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS steps integer CHECK (steps >= 0);
