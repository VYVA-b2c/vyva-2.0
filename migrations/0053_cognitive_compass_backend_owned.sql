-- Cognitive Compass data is accessed through the VYVA backend in this deployment.
-- Keep user_id as uuid, but do not depend on a Supabase auth schema.

alter table if exists public.cc_sessions
  drop constraint if exists cc_sessions_user_id_fkey;

alter table if exists public.cc_user_consents
  drop constraint if exists cc_user_consents_user_id_fkey;

drop policy if exists cc_task_definitions_read on public.cc_task_definitions;
create policy cc_task_definitions_read on public.cc_task_definitions
  for select using (true);

drop policy if exists cc_item_bank_read on public.cc_item_bank;
create policy cc_item_bank_read on public.cc_item_bank
  for select using (is_active = true);

drop policy if exists cc_item_bank_admin_all on public.cc_item_bank;
create policy cc_item_bank_admin_all on public.cc_item_bank
  for all using (true)
  with check (true);

drop policy if exists cc_rotation_forms_read on public.cc_rotation_forms;
create policy cc_rotation_forms_read on public.cc_rotation_forms
  for select using (is_active = true);

drop policy if exists cc_sessions_user_all on public.cc_sessions;
create policy cc_sessions_user_all on public.cc_sessions
  for all using (true)
  with check (true);

drop policy if exists cc_task_responses_user_all on public.cc_task_responses;
create policy cc_task_responses_user_all on public.cc_task_responses
  for all using (true)
  with check (true);

drop policy if exists cc_user_consents_user_all on public.cc_user_consents;
create policy cc_user_consents_user_all on public.cc_user_consents
  for all using (true)
  with check (true);

drop function if exists public.is_curious_minds_admin();
