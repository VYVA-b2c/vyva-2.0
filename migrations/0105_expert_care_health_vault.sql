create table if not exists public.expert_care_documents (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  case_id uuid not null references public.concierge_task_drafts(id) on delete cascade,
  file_name text not null,
  media_type text not null,
  byte_size integer not null,
  sha256 text not null,
  encrypted_payload jsonb,
  malware_status text not null,
  ocr_status text not null,
  ocr_confidence numeric(5,4),
  retention_consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint expert_care_documents_media_type_check check (media_type in ('application/pdf', 'image/jpeg', 'image/png')),
  constraint expert_care_documents_malware_status_check check (malware_status = 'clean'),
  constraint expert_care_documents_ocr_status_check check (ocr_status in ('complete', 'needs_review', 'failed')),
  constraint expert_care_documents_size_check check (byte_size > 0 and byte_size <= 10485760),
  constraint expert_care_documents_confidence_check check (ocr_confidence is null or (ocr_confidence >= 0 and ocr_confidence <= 1))
);

create unique index if not exists expert_care_documents_active_hash_idx
  on public.expert_care_documents (user_id, case_id, sha256)
  where deleted_at is null;

create index if not exists expert_care_documents_case_idx
  on public.expert_care_documents (user_id, case_id, created_at desc)
  where deleted_at is null;

create table if not exists public.expert_care_document_sharing (
  document_id uuid primary key references public.expert_care_documents(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  case_id uuid not null references public.concierge_task_drafts(id) on delete cascade,
  approved boolean not null default false,
  approved_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.expert_care_vault_audit (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  case_id uuid not null references public.concierge_task_drafts(id) on delete cascade,
  document_id uuid references public.expert_care_documents(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint expert_care_vault_audit_event_check check (event_type in ('uploaded', 'listed', 'viewed', 'sharing_approved', 'sharing_revoked', 'deleted'))
);

create index if not exists expert_care_vault_audit_case_idx
  on public.expert_care_vault_audit (user_id, case_id, created_at desc);
