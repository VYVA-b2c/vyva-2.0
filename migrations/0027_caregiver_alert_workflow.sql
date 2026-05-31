ALTER TABLE public.caregiver_alerts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by text,
  ADD COLUMN IF NOT EXISTS contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS caregiver_note text;

UPDATE public.caregiver_alerts
SET status = 'resolved'
WHERE resolved_at IS NOT NULL
  AND status <> 'resolved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'caregiver_alerts_status_check'
  ) THEN
    ALTER TABLE public.caregiver_alerts
      ADD CONSTRAINT caregiver_alerts_status_check
      CHECK (status IN ('new', 'reviewed', 'contacted', 'resolved'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS caregiver_alerts_workflow_status_idx
  ON public.caregiver_alerts(user_id, status, created_at DESC);
