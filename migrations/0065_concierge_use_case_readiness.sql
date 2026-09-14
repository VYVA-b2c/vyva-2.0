alter table if exists public.user_providers
  drop constraint if exists user_providers_category_check;

alter table if exists public.user_providers
  add constraint user_providers_category_check
  check (category in (
    'pharmacy',
    'doctor_clinic',
    'transport',
    'home_service',
    'personal_care',
    'food',
    'other',
    'taxi',
    'gp',
    'hospital',
    'dentist',
    'physio',
    'clinic',
    'restaurant',
    'cafe',
    'takeaway',
    'supermarket',
    'convenience',
    'shopping',
    'beauty_salon',
    'hair_care',
    'spa',
    'gym',
    'home_repair',
    'electrician',
    'plumber',
    'cleaner'
  ));

alter table if exists public.concierge_pending
  drop constraint if exists concierge_pending_use_case_check;

alter table if exists public.concierge_pending
  add constraint concierge_pending_use_case_check
  check (use_case in (
    'book_ride',
    'order_medicine',
    'book_appointment',
    'home_service',
    'find_provider',
    'find_offers',
    'paperwork',
    'admin_task',
    'scam_check',
    'shopping_request',
    'insurance_admin',
    'travel',
    'send_message',
    'order_food'
  ));

alter table if exists public.concierge_sessions
  drop constraint if exists concierge_sessions_use_case_check;

alter table if exists public.concierge_sessions
  add constraint concierge_sessions_use_case_check
  check (use_case in (
    'book_ride',
    'order_medicine',
    'book_appointment',
    'home_service',
    'find_provider',
    'find_offers',
    'paperwork',
    'admin_task',
    'scam_check',
    'shopping_request',
    'insurance_admin',
    'travel',
    'send_message',
    'order_food'
  ));
