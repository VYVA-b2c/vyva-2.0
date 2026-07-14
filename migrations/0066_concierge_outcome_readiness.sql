alter table if exists public.concierge_sessions
  drop constraint if exists concierge_sessions_outcome_check;

alter table if exists public.concierge_sessions
  add constraint concierge_sessions_outcome_check
  check (outcome in (
    'pending',
    'completed',
    'confirmed',
    'no_answer',
    'unavailable',
    'cant_fulfil',
    'needs_more_info',
    'user_cancelled',
    'cancelled',
    'error'
  ));
