ALTER TABLE ride_requests
  ADD COLUMN IF NOT EXISTS ride_purpose text;

CREATE INDEX IF NOT EXISTS ride_requests_user_purpose_created_idx
  ON ride_requests (user_id, ride_purpose, created_at DESC)
  WHERE ride_purpose IS NOT NULL;
