alter table if exists public.user_providers
  add column if not exists is_trusted boolean not null default true;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, category
      order by last_used_at desc nulls last, updated_at desc nulls last, created_at desc nulls last, id
    ) as category_rank
  from public.user_providers
  where is_active = true and is_trusted = true
)
update public.user_providers as provider
set is_primary = ranked.category_rank = 1
from ranked
where provider.id = ranked.id;

update public.user_providers
set is_primary = false
where is_active = false or is_trusted = false;

create unique index if not exists user_providers_one_primary_per_category_idx
  on public.user_providers (user_id, category)
  where is_primary = true and is_active = true and is_trusted = true;
