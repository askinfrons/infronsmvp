-- INFRONS Client Master v2. Additive migration only.
-- Existing clients remain valid; new fields are nullable or have safe defaults.

alter table public.clients add column if not exists date_of_birth_or_incorporation date;
alter table public.clients add column if not exists financial_year_end text default '31 March';
alter table public.clients add column if not exists client_status text not null default 'Active' check (client_status in ('Prospect','Active','Inactive'));
alter table public.clients add column if not exists source text;
alter table public.clients add column if not exists onboarded_date date;
alter table public.clients add column if not exists tags text[] not null default '{}';
alter table public.clients add column if not exists group_id uuid;

alter table public.client_services add column if not exists service_key text;
alter table public.client_services add column if not exists billing_frequency text not null default 'per filing' check (billing_frequency in ('monthly','quarterly','annual','per filing'));

create table if not exists public.client_groups (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.client_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.client_groups(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(group_id, client_id)
);

create table if not exists public.client_registrations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  registration_type text not null check (registration_type in ('PAN','GSTIN','TAN','CIN','LLPIN','Udyam','IEC','PF','ESI','Professional Tax')),
  registration_number text not null,
  gst_scheme text check (gst_scheme is null or gst_scheme in ('regular','composition','QRMP')),
  state_code text,
  filing_frequency text check (filing_frequency is null or filing_frequency in ('monthly','quarterly','annual','per filing')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  address_type text not null check (address_type in ('registered','billing','branch')),
  label text,
  address text not null,
  state_code text,
  pincode text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.compliance_due_dates (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references public.practices(id) on delete cascade,
  filing_key text not null,
  filing_name text not null,
  description text,
  applicable_constitutions text[] not null default '{}',
  required_registration text,
  required_service text,
  due_month integer check (due_month between 1 and 12),
  due_day integer check (due_day between 1 and 31),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(practice_id, filing_key)
);

create table if not exists public.client_compliance_instances (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  due_date_id uuid not null references public.compliance_due_dates(id) on delete restrict,
  period_label text not null,
  due_date date not null,
  status text not null default 'Not started' check (status in ('Not started','Documents pending','In progress','Filed')),
  assignee uuid references auth.users(id),
  filed_date date,
  acknowledgement_number text,
  notes text,
  created_at timestamptz not null default now(),
  unique(client_id, due_date_id, period_label)
);

create table if not exists public.client_document_checklists (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  compliance_instance_id uuid references public.client_compliance_instances(id) on delete cascade,
  document_name text not null,
  period_label text,
  is_required boolean not null default true,
  received boolean not null default false,
  document_id uuid references public.client_documents(id) on delete set null,
  received_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.client_saved_views (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.client_activity_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.clients drop constraint if exists clients_group_id_fkey;
alter table public.clients add constraint clients_group_id_fkey foreign key (group_id) references public.client_groups(id) on delete set null;

create index if not exists clients_v2_status_idx on public.clients(practice_id, client_status);
create index if not exists clients_v2_pan_idx on public.clients(pan);
create index if not exists clients_v2_gstin_idx on public.clients(gstin);
create index if not exists clients_v2_tags_idx on public.clients using gin(tags);
create index if not exists client_registrations_client_idx on public.client_registrations(client_id);
create index if not exists client_addresses_client_idx on public.client_addresses(client_id);
create index if not exists compliance_due_dates_practice_idx on public.compliance_due_dates(practice_id, is_active);
create index if not exists compliance_instances_client_due_idx on public.client_compliance_instances(client_id, due_date);
create index if not exists document_checklists_client_idx on public.client_document_checklists(client_id, received);
create index if not exists client_activity_log_client_idx on public.client_activity_log(client_id, created_at desc);

alter table public.client_groups enable row level security;
alter table public.client_group_members enable row level security;
alter table public.client_registrations enable row level security;
alter table public.client_addresses enable row level security;
alter table public.compliance_due_dates enable row level security;
alter table public.client_compliance_instances enable row level security;
alter table public.client_document_checklists enable row level security;
alter table public.client_saved_views enable row level security;
alter table public.client_activity_log enable row level security;

create or replace function public.can_access_client_v2(p_client_id uuid)
returns boolean language sql security definer set search_path=public as $$
  select exists (
    select 1 from public.clients c join public.users u on u.practice_id = c.practice_id
    where c.id = p_client_id and u.id = auth.uid()
      and (u.role = 'principal' or c.assigned_to = auth.uid())
  );
$$;

do $$ begin
  create policy "Client v2 groups access" on public.client_groups for all to authenticated
    using (exists(select 1 from public.users u where u.practice_id = client_groups.practice_id and u.id = auth.uid()))
    with check (exists(select 1 from public.users u where u.practice_id = client_groups.practice_id and u.id = auth.uid()));
  create policy "Client v2 group members access" on public.client_group_members for all to authenticated
    using (public.can_access_client_v2(client_id)) with check (public.can_access_client_v2(client_id));
  create policy "Client v2 registrations access" on public.client_registrations for all to authenticated
    using (public.can_access_client_v2(client_id)) with check (public.can_access_client_v2(client_id));
  create policy "Client v2 addresses access" on public.client_addresses for all to authenticated
    using (public.can_access_client_v2(client_id)) with check (public.can_access_client_v2(client_id));
  create policy "Client v2 due dates access" on public.compliance_due_dates for all to authenticated
    using (practice_id is null or exists(select 1 from public.users u where u.practice_id = compliance_due_dates.practice_id and u.id = auth.uid()))
    with check (practice_id is null or exists(select 1 from public.users u where u.practice_id = compliance_due_dates.practice_id and u.id = auth.uid()));
  create policy "Client v2 compliance access" on public.client_compliance_instances for all to authenticated
    using (public.can_access_client_v2(client_id)) with check (public.can_access_client_v2(client_id));
  create policy "Client v2 checklist access" on public.client_document_checklists for all to authenticated
    using (public.can_access_client_v2(client_id)) with check (public.can_access_client_v2(client_id));
  create policy "Client v2 saved views access" on public.client_saved_views for all to authenticated
    using (exists(select 1 from public.users u where u.practice_id = client_saved_views.practice_id and u.id = auth.uid()))
    with check (exists(select 1 from public.users u where u.practice_id = client_saved_views.practice_id and u.id = auth.uid()));
  create policy "Client v2 activity access" on public.client_activity_log for all to authenticated
    using (public.can_access_client_v2(client_id)) with check (public.can_access_client_v2(client_id));
exception when duplicate_object then null; end $$;

insert into public.compliance_due_dates (practice_id, filing_key, filing_name, description, due_month, due_day)
select null, seed.filing_key, seed.filing_name, seed.description, seed.due_month, seed.due_day
from (values
  ('gstr1_monthly', 'GSTR-1', 'Monthly outward supplies return', null::integer, 11),
  ('gstr3b_monthly', 'GSTR-3B', 'Monthly summary return', null::integer, 20),
  ('tds_quarterly', 'TDS return', 'Quarterly TDS statement', null::integer, 31),
  ('advance_tax_q1', 'Advance tax Q1', 'First advance tax instalment', 6, 15),
  ('advance_tax_q2', 'Advance tax Q2', 'Second advance tax instalment', 9, 15),
  ('advance_tax_q3', 'Advance tax Q3', 'Third advance tax instalment', 12, 15),
  ('advance_tax_q4', 'Advance tax Q4', 'Final advance tax instalment', 3, 15),
  ('itr_individual', 'ITR individual', 'Income-tax return for individuals', 7, 31),
  ('itr_company', 'ITR company', 'Income-tax return for companies', 9, 30),
  ('roc_aoc4', 'AOC-4', 'Annual accounts filing', null::integer, 30),
  ('roc_mgt7', 'MGT-7', 'Annual return filing; adjust the due date for the AGM-based deadline', null::integer, 30)
) as seed(filing_key, filing_name, description, due_month, due_day)
where not exists (select 1 from public.compliance_due_dates d where d.practice_id is null and d.filing_key = seed.filing_key);

create or replace function public.generate_client_compliance(p_client_id uuid, p_period_label text default null)
returns integer language plpgsql security definer set search_path=public as $$
declare v_client public.clients%rowtype; v_period text := coalesce(p_period_label, to_char(current_date, 'YYYY')); v_count integer := 0; v_rule record; v_due_date date;
begin
  if not public.can_access_client_v2(p_client_id) then raise exception 'Not allowed'; end if;
  select * into v_client from public.clients where id = p_client_id;
  for v_rule in
    select d.* from public.compliance_due_dates d
    where d.is_active and (d.practice_id is null or d.practice_id = v_client.practice_id)
      and (cardinality(d.applicable_constitutions) = 0 or v_client.constitution_type = any(d.applicable_constitutions))
      and (d.required_registration is null or exists(select 1 from public.client_registrations r where r.client_id = p_client_id and r.registration_type = d.required_registration))
      and (d.required_service is null or exists(select 1 from public.client_services s where s.client_id = p_client_id and (s.service_key = d.required_service or s.service_name = d.required_service)))
  loop
    v_due_date := case when v_rule.due_month is null then make_date(extract(year from current_date)::integer, extract(month from current_date)::integer, least(v_rule.due_day, 28)) else make_date(extract(year from current_date)::integer, v_rule.due_month, least(v_rule.due_day, 28)) end;
    insert into public.client_compliance_instances(client_id, due_date_id, period_label, due_date)
    values(p_client_id, v_rule.id, v_period, v_due_date)
    on conflict(client_id, due_date_id, period_label) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end; $$;
grant execute on function public.generate_client_compliance(uuid, text) to authenticated;

create or replace function public.log_client_v2_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_client_id uuid; v_label text;
begin
  v_client_id := case when tg_table_name = 'clients' then coalesce(new.id, old.id) else coalesce(new.client_id, old.client_id) end;
  v_label := replace(tg_table_name, '_', ' ');
  insert into public.client_activity_log(client_id, actor_id, action, description, metadata)
  values(v_client_id, auth.uid(), initcap(tg_op || ' ' || v_label), initcap(v_label) || ' was ' || lower(tg_op), jsonb_build_object('table', tg_table_name, 'operation', tg_op));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

drop trigger if exists clients_v2_activity_log on public.clients;
create trigger clients_v2_activity_log after insert or update on public.clients for each row execute function public.log_client_v2_change();
drop trigger if exists client_registrations_v2_activity_log on public.client_registrations;
create trigger client_registrations_v2_activity_log after insert or update or delete on public.client_registrations for each row execute function public.log_client_v2_change();
drop trigger if exists client_contacts_v2_activity_log on public.client_contacts;
create trigger client_contacts_v2_activity_log after insert or update or delete on public.client_contacts for each row execute function public.log_client_v2_change();
drop trigger if exists client_addresses_v2_activity_log on public.client_addresses;
create trigger client_addresses_v2_activity_log after insert or update or delete on public.client_addresses for each row execute function public.log_client_v2_change();
drop trigger if exists client_services_v2_activity_log on public.client_services;
create trigger client_services_v2_activity_log after insert or update or delete on public.client_services for each row execute function public.log_client_v2_change();
drop trigger if exists client_compliance_v2_activity_log on public.client_compliance_instances;
create trigger client_compliance_v2_activity_log after insert or update or delete on public.client_compliance_instances for each row execute function public.log_client_v2_change();
drop trigger if exists client_checklist_v2_activity_log on public.client_document_checklists;
create trigger client_checklist_v2_activity_log after insert or update or delete on public.client_document_checklists for each row execute function public.log_client_v2_change();

do $$ begin
  alter publication supabase_realtime add table public.clients;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.client_registrations;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.client_contacts;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.client_addresses;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.client_services;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.client_compliance_instances;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.client_document_checklists;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.client_activity_log;
exception when duplicate_object then null; end $$;
