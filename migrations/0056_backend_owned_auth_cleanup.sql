-- Backend-owned deployments do not expose the Supabase auth schema helpers.
-- Keep existing data, but remove auth schema dependencies from game and coach tables.

do $$
begin
  if to_regclass('public.spatial_nav_sessions') is not null then
    execute 'alter table public.spatial_nav_sessions drop constraint if exists spatial_nav_sessions_user_id_fkey';
    execute 'drop policy if exists user_own_sn_sessions on public.spatial_nav_sessions';
    execute 'create policy user_own_sn_sessions on public.spatial_nav_sessions for all using (true) with check (true)';
  end if;

  if to_regclass('public.spatial_nav_user_state') is not null then
    execute 'alter table public.spatial_nav_user_state drop constraint if exists spatial_nav_user_state_user_id_fkey';
    execute 'drop policy if exists user_own_sn_state on public.spatial_nav_user_state';
    execute 'create policy user_own_sn_state on public.spatial_nav_user_state for all using (true) with check (true)';
  end if;

  if to_regclass('public.spatial_nav_maps') is not null then
    execute 'drop policy if exists sn_maps_read on public.spatial_nav_maps';
    execute 'create policy sn_maps_read on public.spatial_nav_maps for select using (true)';
  end if;

  if to_regclass('public.dual_task_sessions') is not null then
    execute 'alter table public.dual_task_sessions drop constraint if exists dual_task_sessions_user_id_fkey';
    execute 'drop policy if exists user_own_dt_sessions on public.dual_task_sessions';
    execute 'create policy user_own_dt_sessions on public.dual_task_sessions for all using (true) with check (true)';
  end if;

  if to_regclass('public.dual_task_user_state') is not null then
    execute 'alter table public.dual_task_user_state drop constraint if exists dual_task_user_state_user_id_fkey';
    execute 'drop policy if exists user_own_dt_state on public.dual_task_user_state';
    execute 'create policy user_own_dt_state on public.dual_task_user_state for all using (true) with check (true)';
  end if;

  if to_regclass('public.dual_task_sequences') is not null then
    execute 'drop policy if exists dt_sequences_read on public.dual_task_sequences';
    execute 'create policy dt_sequences_read on public.dual_task_sequences for select using (true)';
  end if;

  if to_regclass('public.face_name_sessions') is not null then
    execute 'alter table public.face_name_sessions drop constraint if exists face_name_sessions_user_id_fkey';
    execute 'drop policy if exists user_own_fn_sessions on public.face_name_sessions';
    execute 'create policy user_own_fn_sessions on public.face_name_sessions for all using (true) with check (true)';
  end if;

  if to_regclass('public.face_name_user_state') is not null then
    execute 'alter table public.face_name_user_state drop constraint if exists face_name_user_state_user_id_fkey';
    execute 'drop policy if exists user_own_fn_state on public.face_name_user_state';
    execute 'create policy user_own_fn_state on public.face_name_user_state for all using (true) with check (true)';
  end if;

  if to_regclass('public.face_name_sets') is not null then
    execute 'drop policy if exists fn_sets_read on public.face_name_sets';
    execute 'create policy fn_sets_read on public.face_name_sets for select using (true)';
  end if;

  if to_regclass('public.face_name_personas') is not null then
    execute 'drop policy if exists fn_personas_read on public.face_name_personas';
    execute 'create policy fn_personas_read on public.face_name_personas for select using (true)';
  end if;

  if to_regclass('public.category_sort_sessions') is not null then
    execute 'alter table public.category_sort_sessions drop constraint if exists category_sort_sessions_user_id_fkey';
    execute 'drop policy if exists user_own_cs_sessions on public.category_sort_sessions';
    execute 'create policy user_own_cs_sessions on public.category_sort_sessions for all using (true) with check (true)';
  end if;

  if to_regclass('public.category_sort_user_state') is not null then
    execute 'alter table public.category_sort_user_state drop constraint if exists category_sort_user_state_user_id_fkey';
    execute 'drop policy if exists user_own_cs_state on public.category_sort_user_state';
    execute 'create policy user_own_cs_state on public.category_sort_user_state for all using (true) with check (true)';
  end if;

  if to_regclass('public.category_sort_sequences') is not null then
    execute 'drop policy if exists cs_sequences_read on public.category_sort_sequences';
    execute 'create policy cs_sequences_read on public.category_sort_sequences for select using (true)';
  end if;

  if to_regclass('public.category_sort_cards') is not null then
    execute 'drop policy if exists cs_cards_read on public.category_sort_cards';
    execute 'create policy cs_cards_read on public.category_sort_cards for select using (true)';
  end if;

  if to_regclass('public.number_trails_sessions') is not null then
    execute 'alter table public.number_trails_sessions drop constraint if exists number_trails_sessions_user_id_fkey';
    execute 'drop policy if exists user_own_nt_sessions on public.number_trails_sessions';
    execute 'create policy user_own_nt_sessions on public.number_trails_sessions for all using (true) with check (true)';
  end if;

  if to_regclass('public.number_trails_user_state') is not null then
    execute 'alter table public.number_trails_user_state drop constraint if exists number_trails_user_state_user_id_fkey';
    execute 'drop policy if exists user_own_nt_state on public.number_trails_user_state';
    execute 'create policy user_own_nt_state on public.number_trails_user_state for all using (true) with check (true)';
  end if;

  if to_regclass('public.number_trails_configs') is not null then
    execute 'drop policy if exists nt_configs_read on public.number_trails_configs';
    execute 'create policy nt_configs_read on public.number_trails_configs for select using (true)';
  end if;

  if to_regclass('public.vyva_signal_readings') is not null then
    execute 'drop policy if exists user_own_signals on public.vyva_signal_readings';
    execute 'create policy user_own_signals on public.vyva_signal_readings for all using (true) with check (true)';
  end if;

  if to_regclass('public.vyva_user_baselines') is not null then
    execute 'drop policy if exists user_own_baselines on public.vyva_user_baselines';
    execute 'create policy user_own_baselines on public.vyva_user_baselines for all using (true) with check (true)';
  end if;

  if to_regclass('public.vyva_pattern_windows') is not null then
    execute 'drop policy if exists user_own_patterns on public.vyva_pattern_windows';
    execute 'create policy user_own_patterns on public.vyva_pattern_windows for all using (true) with check (true)';
  end if;

  if to_regclass('public.user_device_connections') is not null then
    execute 'drop policy if exists user_own_devices on public.user_device_connections';
    execute 'create policy user_own_devices on public.user_device_connections for all using (true) with check (true)';
  end if;

  if to_regclass('public.cognitive_session_index') is not null then
    execute 'drop policy if exists cognitive_session_index_user_select on public.cognitive_session_index';
    execute 'drop policy if exists cognitive_session_index_user_insert on public.cognitive_session_index';
    execute 'drop policy if exists cognitive_session_index_user_update on public.cognitive_session_index';
    execute 'drop policy if exists cognitive_session_index_user_delete on public.cognitive_session_index';
    execute 'create policy cognitive_session_index_user_select on public.cognitive_session_index for select using (true)';
    execute 'create policy cognitive_session_index_user_insert on public.cognitive_session_index for insert with check (true)';
    execute 'create policy cognitive_session_index_user_update on public.cognitive_session_index for update using (true) with check (true)';
    execute 'create policy cognitive_session_index_user_delete on public.cognitive_session_index for delete using (true)';
  end if;

  if to_regclass('public.cognitive_daily_plans') is not null then
    execute 'drop policy if exists cognitive_daily_plans_user_select on public.cognitive_daily_plans';
    execute 'drop policy if exists cognitive_daily_plans_user_insert on public.cognitive_daily_plans';
    execute 'drop policy if exists cognitive_daily_plans_user_update on public.cognitive_daily_plans';
    execute 'create policy cognitive_daily_plans_user_select on public.cognitive_daily_plans for select using (true)';
    execute 'create policy cognitive_daily_plans_user_insert on public.cognitive_daily_plans for insert with check (true)';
    execute 'create policy cognitive_daily_plans_user_update on public.cognitive_daily_plans for update using (true) with check (true)';
  end if;

  if to_regclass('public.cognitive_daily_plan_items') is not null then
    execute 'drop policy if exists cognitive_daily_plan_items_user_select on public.cognitive_daily_plan_items';
    execute 'drop policy if exists cognitive_daily_plan_items_user_insert on public.cognitive_daily_plan_items';
    execute 'drop policy if exists cognitive_daily_plan_items_user_update on public.cognitive_daily_plan_items';
    execute 'create policy cognitive_daily_plan_items_user_select on public.cognitive_daily_plan_items for select using (true)';
    execute 'create policy cognitive_daily_plan_items_user_insert on public.cognitive_daily_plan_items for insert with check (true)';
    execute 'create policy cognitive_daily_plan_items_user_update on public.cognitive_daily_plan_items for update using (true) with check (true)';
  end if;

  if to_regclass('public.cognitive_daily_plan_events') is not null then
    execute 'drop policy if exists cognitive_daily_plan_events_user_select on public.cognitive_daily_plan_events';
    execute 'drop policy if exists cognitive_daily_plan_events_user_insert on public.cognitive_daily_plan_events';
    execute 'create policy cognitive_daily_plan_events_user_select on public.cognitive_daily_plan_events for select using (true)';
    execute 'create policy cognitive_daily_plan_events_user_insert on public.cognitive_daily_plan_events for insert with check (true)';
  end if;

  if to_regclass('public.cognitive_caregiver_settings') is not null then
    execute 'drop policy if exists cognitive_caregiver_settings_isolation on public.cognitive_caregiver_settings';
    execute 'create policy cognitive_caregiver_settings_isolation on public.cognitive_caregiver_settings for all using (true) with check (true)';
  end if;

  if to_regclass('public.remember_later_sessions') is not null then
    execute 'alter table public.remember_later_sessions drop constraint if exists remember_later_sessions_user_id_fkey';
    execute 'drop policy if exists remember_later_sessions_user_all on public.remember_later_sessions';
    execute 'create policy remember_later_sessions_user_all on public.remember_later_sessions for all using (true) with check (true)';
  end if;

  if to_regclass('public.remember_later_user_state') is not null then
    execute 'alter table public.remember_later_user_state drop constraint if exists remember_later_user_state_user_id_fkey';
    execute 'drop policy if exists remember_later_state_user_all on public.remember_later_user_state';
    execute 'create policy remember_later_state_user_all on public.remember_later_user_state for all using (true) with check (true)';
  end if;

  if to_regclass('public.remember_later_rounds') is not null then
    execute 'drop policy if exists remember_later_rounds_read on public.remember_later_rounds';
    execute 'create policy remember_later_rounds_read on public.remember_later_rounds for select using (true)';
  end if;

  if to_regclass('public.scent_memory_sessions') is not null then
    execute 'alter table public.scent_memory_sessions drop constraint if exists scent_memory_sessions_user_id_fkey';
    execute 'drop policy if exists scent_memory_sessions_user_all on public.scent_memory_sessions';
    execute 'create policy scent_memory_sessions_user_all on public.scent_memory_sessions for all using (true) with check (true)';
  end if;

  if to_regclass('public.scent_memory_user_state') is not null then
    execute 'alter table public.scent_memory_user_state drop constraint if exists scent_memory_user_state_user_id_fkey';
    execute 'drop policy if exists scent_memory_state_user_all on public.scent_memory_user_state';
    execute 'create policy scent_memory_state_user_all on public.scent_memory_user_state for all using (true) with check (true)';
  end if;

  if to_regclass('public.scent_memory_prompts') is not null then
    execute 'drop policy if exists scent_memory_prompts_read on public.scent_memory_prompts';
    execute 'create policy scent_memory_prompts_read on public.scent_memory_prompts for select using (is_active = true and rejected = false)';
  end if;

  if to_regclass('public.listen_closely_sessions') is not null then
    execute 'alter table public.listen_closely_sessions drop constraint if exists listen_closely_sessions_user_id_fkey';
    execute 'drop policy if exists listen_closely_sessions_user_all on public.listen_closely_sessions';
    execute 'create policy listen_closely_sessions_user_all on public.listen_closely_sessions for all using (true) with check (true)';
  end if;

  if to_regclass('public.listen_closely_user_state') is not null then
    execute 'alter table public.listen_closely_user_state drop constraint if exists listen_closely_user_state_user_id_fkey';
    execute 'drop policy if exists listen_closely_state_user_all on public.listen_closely_user_state';
    execute 'create policy listen_closely_state_user_all on public.listen_closely_user_state for all using (true) with check (true)';
  end if;

  if to_regclass('public.listen_closely_soundscapes') is not null then
    execute 'drop policy if exists listen_closely_soundscapes_read on public.listen_closely_soundscapes';
    execute 'create policy listen_closely_soundscapes_read on public.listen_closely_soundscapes for select using (is_active = true)';
  end if;

  if to_regclass('public.breath_garden_sessions') is not null then
    execute 'alter table public.breath_garden_sessions drop constraint if exists breath_garden_sessions_user_id_fkey';
    execute 'drop policy if exists breath_garden_sessions_user_all on public.breath_garden_sessions';
    execute 'create policy breath_garden_sessions_user_all on public.breath_garden_sessions for all using (true) with check (true)';
  end if;

  if to_regclass('public.breath_garden_user_state') is not null then
    execute 'alter table public.breath_garden_user_state drop constraint if exists breath_garden_user_state_user_id_fkey';
    execute 'drop policy if exists breath_garden_state_user_all on public.breath_garden_user_state';
    execute 'create policy breath_garden_state_user_all on public.breath_garden_user_state for all using (true) with check (true)';
  end if;
end $$;
