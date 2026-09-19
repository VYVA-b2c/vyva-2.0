CREATE TABLE IF NOT EXISTS benefits_finder_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  country text,
  category text NOT NULL,
  finding_summary text NOT NULL,
  source_name text,
  source_url text,
  accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS benefits_finder_findings_user_created_idx
  ON benefits_finder_findings (user_id, created_at DESC);
