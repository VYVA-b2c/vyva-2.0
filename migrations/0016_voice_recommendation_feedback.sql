CREATE TABLE IF NOT EXISTS voice_recommendation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  session_id text,
  recommendation_id text NOT NULL,
  action text NOT NULL,
  domain text,
  title text,
  reason text,
  source text NOT NULL DEFAULT 'voice',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_recommendation_feedback_user_created_idx
ON voice_recommendation_feedback (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS voice_recommendation_feedback_user_recommendation_idx
ON voice_recommendation_feedback (user_id, recommendation_id, created_at DESC);
