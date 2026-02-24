-- Notifications System Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Notifications Table
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('risk', 'trade', 'system', 'market', 'challenge')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- Additional data (e.g., trade_id, market_id, etc.)
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- ============================================
-- 2. User Notification Preferences (Optional)
-- ============================================
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  risk_alerts BOOLEAN NOT NULL DEFAULT true,
  trade_confirmations BOOLEAN NOT NULL DEFAULT true,
  market_resolutions BOOLEAN NOT NULL DEFAULT true,
  challenge_updates BOOLEAN NOT NULL DEFAULT true,
  system_announcements BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
