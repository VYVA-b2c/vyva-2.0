alter table public.cc_item_bank
  add column if not exists item_family_id text null;

comment on column public.cc_item_bank.item_family_id is
  'Groups equivalent items across languages. Null when no cross-language item pairing applies.';

create index if not exists idx_cc_item_bank_family
  on public.cc_item_bank (task_definition_id, item_family_id, language)
  where item_family_id is not null;
