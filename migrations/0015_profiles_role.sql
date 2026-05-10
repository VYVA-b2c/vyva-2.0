-- Add role column to profiles for admin/user distinction
-- Uses IF NOT EXISTS so it is safe to re-apply on databases where the
-- column was already added via db:push without a tracked migration.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';
