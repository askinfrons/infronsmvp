-- INFRONS client capacity tiers and 300+ client readiness.
-- Run this once in the Supabase SQL editor.

alter table public.practices
  add column if not exists client_capacity_tier text not null default '0-50',
  add column if not exists client_capacity_limit integer not null default 50;

alter table public.practices
  drop constraint if exists practices_client_capacity_tier_check;

alter table public.practices
  add constraint practices_client_capacity_tier_check
  check (client_capacity_tier in ('0-50', '51-100', '101-150', '151-200', '201-300', '300+'));

alter table public.practices
  drop constraint if exists practices_client_capacity_limit_check;

alter table public.practices
  add constraint practices_client_capacity_limit_check
  check (
    (client_capacity_tier = '0-50' and client_capacity_limit = 50)
    or (client_capacity_tier = '51-100' and client_capacity_limit = 100)
    or (client_capacity_tier = '101-150' and client_capacity_limit = 150)
    or (client_capacity_tier = '151-200' and client_capacity_limit = 200)
    or (client_capacity_tier = '201-300' and client_capacity_limit = 300)
    or (client_capacity_tier = '300+' and client_capacity_limit = 0)
  );

create index if not exists clients_practice_id_idx
  on public.clients (practice_id);

create index if not exists clients_practice_assigned_idx
  on public.clients (practice_id, assigned_to);

create index if not exists clients_practice_last_reply_idx
  on public.clients (practice_id, last_client_reply);

create index if not exists clients_practice_follow_up_idx
  on public.clients (practice_id, follow_up_date);

create index if not exists clients_practice_created_idx
  on public.clients (practice_id, created_at desc);

create index if not exists clients_practice_name_lower_idx
  on public.clients (practice_id, lower(name));

create index if not exists clients_practice_company_lower_idx
  on public.clients (practice_id, lower(company));

create index if not exists clients_practice_phone_idx
  on public.clients (practice_id, phone);

comment on column public.practices.client_capacity_tier is
  'Selected INFRONS client database size tier.';

comment on column public.practices.client_capacity_limit is
  'Numeric client capacity limit for selected tier. 0 means 300+ / custom.';
