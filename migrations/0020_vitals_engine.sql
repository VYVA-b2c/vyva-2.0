-- VITALS ENGINE: Signal Readings
-- Every measurement from any source lands here.

CREATE TABLE IF NOT EXISTS vyva_signal_readings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signal_type     TEXT NOT NULL,
  value           NUMERIC(8,2) NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          TEXT NOT NULL DEFAULT 'manual',
  context_tag     TEXT DEFAULT 'general',
  baseline_ref    NUMERIC(8,2),
  deviation_pct   NUMERIC(6,2),
  quality_flag    TEXT NOT NULL DEFAULT 'clean',
  condition_tags  TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- VITALS ENGINE: Personal Baselines
-- Rolling 14-day "personal normal" per signal per user.

CREATE TABLE IF NOT EXISTS vyva_user_baselines (
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  signal_type      TEXT NOT NULL,
  context_tag      TEXT NOT NULL DEFAULT 'general',
  baseline_mean    NUMERIC(8,2) NOT NULL,
  baseline_stddev  NUMERIC(8,2),
  baseline_p25     NUMERIC(8,2),
  baseline_p75     NUMERIC(8,2),
  sample_count     INTEGER DEFAULT 0,
  window_days      INTEGER DEFAULT 14,
  is_established   BOOLEAN DEFAULT FALSE,
  computed_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, signal_type, context_tag)
);

-- VITALS ENGINE: Analysis Results
-- Written after every engine API call.

CREATE TABLE IF NOT EXISTS vyva_pattern_windows (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES profiles(id) ON DELETE CASCADE,
  analysed_at           TIMESTAMPTZ DEFAULT NOW(),
  risk_score            INTEGER CHECK (risk_score BETWEEN 0 AND 100),
  risk_tier             TEXT NOT NULL DEFAULT 'none',
  contributing_signals  JSONB DEFAULT '{}',
  pattern_labels        TEXT[] DEFAULT '{}',
  senior_message        TEXT,
  caregiver_note        TEXT,
  recommended_action    TEXT,
  alert_fired           BOOLEAN DEFAULT FALSE,
  alert_channel         TEXT,
  model_version         TEXT DEFAULT 'v1'
);

-- VITALS ENGINE: Device Connections
-- Tracks which external sources a user has linked.

CREATE TABLE IF NOT EXISTS user_device_connections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,
  is_active        BOOLEAN DEFAULT TRUE,
  connected_at     TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at   TIMESTAMPTZ,
  UNIQUE (user_id, provider)
);

ALTER TABLE vyva_signal_readings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vyva_user_baselines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vyva_pattern_windows    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_device_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_own_signals" ON vyva_signal_readings;
DROP POLICY IF EXISTS "user_own_baselines" ON vyva_user_baselines;
DROP POLICY IF EXISTS "user_own_patterns" ON vyva_pattern_windows;
DROP POLICY IF EXISTS "user_own_devices" ON user_device_connections;

CREATE POLICY "user_own_signals"    ON vyva_signal_readings    FOR ALL USING (true);
CREATE POLICY "user_own_baselines"  ON vyva_user_baselines     FOR ALL USING (true);
CREATE POLICY "user_own_patterns"   ON vyva_pattern_windows    FOR ALL USING (true);
CREATE POLICY "user_own_devices"    ON user_device_connections FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_vsr_user_signal_time
  ON vyva_signal_readings (user_id, signal_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_vpw_user_time
  ON vyva_pattern_windows (user_id, analysed_at DESC);
