create table if not exists public.expert_care_clinical_safety_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_user_id text references public.profiles(id) on delete restrict,
  reviewer_name text not null,
  policy_version text not null,
  verdict text not null,
  source_policy_reviewed boolean not null default false,
  emergency_boundaries_reviewed boolean not null default false,
  prompts_reviewed boolean not null default false,
  sampled_outputs_reviewed boolean not null default false,
  notes text not null,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  constraint expert_care_clinical_safety_reviews_verdict_check
    check (verdict in ('approved', 'rejected')),
  constraint expert_care_clinical_safety_reviews_approval_scope_check
    check (
      verdict <> 'approved'
      or (
        source_policy_reviewed
        and emergency_boundaries_reviewed
        and prompts_reviewed
        and sampled_outputs_reviewed
      )
    )
);

create index if not exists expert_care_clinical_safety_reviews_created_idx
  on public.expert_care_clinical_safety_reviews (created_at desc);

-- Reviews are append-only evidence. A new rejection supersedes an older approval;
-- records are never edited into an approval after the fact.
