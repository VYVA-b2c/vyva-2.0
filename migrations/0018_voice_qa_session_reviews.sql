CREATE TABLE IF NOT EXISTS voice_qa_session_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'unreviewed',
  note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_qa_session_reviews_status_idx
ON voice_qa_session_reviews (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS voice_qa_session_reviews_updated_idx
ON voice_qa_session_reviews (updated_at DESC);
