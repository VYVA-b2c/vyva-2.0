ALTER TABLE public.caregiver_alerts
  ADD COLUMN IF NOT EXISTS contacted_by text,
  ADD COLUMN IF NOT EXISTS workflow_version integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'caregiver_alerts_workflow_version_check'
  ) THEN
    ALTER TABLE public.caregiver_alerts
      ADD CONSTRAINT caregiver_alerts_workflow_version_check
      CHECK (workflow_version >= 1);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.caregiver_alert_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.caregiver_alerts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  actor_user_id text NOT NULL,
  actor_role text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  from_caregiver_note text,
  to_caregiver_note text,
  from_workflow_version integer NOT NULL,
  to_workflow_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS caregiver_alert_workflow_events_alert_idx
  ON public.caregiver_alert_workflow_events(alert_id, created_at DESC);

CREATE INDEX IF NOT EXISTS caregiver_alert_workflow_events_user_idx
  ON public.caregiver_alert_workflow_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS caregiver_alerts_workflow_version_idx
  ON public.caregiver_alerts(id, user_id, workflow_version);

ALTER TABLE public.caregiver_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregiver_alert_workflow_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS caregiver_alerts_select_authorized ON public.caregiver_alerts;
DROP POLICY IF EXISTS caregiver_alerts_insert_authorized ON public.caregiver_alerts;
DROP POLICY IF EXISTS caregiver_alerts_update_workflow_authorized ON public.caregiver_alerts;
DROP POLICY IF EXISTS caregiver_alert_workflow_events_select_authorized ON public.caregiver_alert_workflow_events;
DROP POLICY IF EXISTS caregiver_alert_workflow_events_insert_authorized ON public.caregiver_alert_workflow_events;

CREATE POLICY caregiver_alerts_select_authorized
  ON public.caregiver_alerts
  FOR SELECT
  USING (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1
      FROM public.profile_memberships pm
      WHERE pm.profile_id = caregiver_alerts.user_id
        AND pm.user_id = auth.uid()::text
        AND pm.status = 'active'::profile_member_status
    )
  );

CREATE POLICY caregiver_alerts_insert_authorized
  ON public.caregiver_alerts
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1
      FROM public.profile_memberships pm
      WHERE pm.profile_id = caregiver_alerts.user_id
        AND pm.user_id = auth.uid()::text
        AND pm.status = 'active'::profile_member_status
    )
  );

CREATE POLICY caregiver_alerts_update_workflow_authorized
  ON public.caregiver_alerts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profile_memberships pm
      WHERE pm.profile_id = caregiver_alerts.user_id
        AND pm.user_id = auth.uid()::text
        AND pm.status = 'active'::profile_member_status
        AND pm.role IN ('caregiver'::profile_member_role, 'family'::profile_member_role, 'admin'::profile_member_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profile_memberships pm
      WHERE pm.profile_id = caregiver_alerts.user_id
        AND pm.user_id = auth.uid()::text
        AND pm.status = 'active'::profile_member_status
        AND pm.role IN ('caregiver'::profile_member_role, 'family'::profile_member_role, 'admin'::profile_member_role)
    )
  );

CREATE POLICY caregiver_alert_workflow_events_select_authorized
  ON public.caregiver_alert_workflow_events
  FOR SELECT
  USING (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1
      FROM public.profile_memberships pm
      WHERE pm.profile_id = caregiver_alert_workflow_events.user_id
        AND pm.user_id = auth.uid()::text
        AND pm.status = 'active'::profile_member_status
    )
  );

CREATE POLICY caregiver_alert_workflow_events_insert_authorized
  ON public.caregiver_alert_workflow_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profile_memberships pm
      WHERE pm.profile_id = caregiver_alert_workflow_events.user_id
        AND pm.user_id = auth.uid()::text
        AND pm.status = 'active'::profile_member_status
        AND pm.role IN ('caregiver'::profile_member_role, 'family'::profile_member_role, 'admin'::profile_member_role)
    )
  );
