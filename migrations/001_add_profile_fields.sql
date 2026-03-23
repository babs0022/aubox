-- Migration: Add profile fields to users table
-- This migration adds name and profileIcon columns to support full user profiles

-- Add profile fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS "profileIcon" TEXT;

-- Create index for faster lookups by email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users("createdAt");

-- Create index for updated_at for pagination
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users("updatedAt");

-- Add UNIQUE constraint on email if not exists
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE(email);

-- Add default timestamps if needed
ALTER TABLE users ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
