-- Migration: Add user_preferences table
-- Description: This migration adds a user_preferences table to store user-specific settings
-- Date: 2026-01-15

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES teachers(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  weekly_report BOOLEAN DEFAULT true,
  theme VARCHAR(20) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for service role
CREATE POLICY "Allow service role full access" ON user_preferences FOR ALL USING (true) WITH CHECK (true);

-- Add phone field to teachers table if it doesn't exist
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
