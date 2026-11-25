-- INFRONS Client Master and India GST invoicing.
-- Additive migration. Run after the existing client/practice migrations.

alter table public.practices add column if not exists legal_name text;
alter table public.practices add column if not exists gstin text;
alter table public.practices add column if not exists state_code text;
alter table public.practices add column if not exists address text;
alter table public.practices add column if not exists logo_url text;
alter table public.practices add column if not exists invoice_prefix text not null default 'INV';

alter table public.clients add column if not exists legal_name text;
alter table public.clients add column if not exists trade_name text;
alter table public.clients add column if not exists constitution_type text;
alter table public.clients add column if not exists pan text;
alter table public.clients add column if not exists gstin text;
alter table public.clients add column if not exists state_code text;
alter table public.clients add column if not exists address text;
alter table public.clients add column if not exists default_fee_paise bigint;
alter table public.clients add column if not exists default_sac_code text;
alter table public.clients add column if not exists default_gst_rate numeric(5,2);

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete cascade,
  name text not null, designation text, email text, phone text, is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.client_services (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete cascade,
  service_name text not null, sac_code text, gst_rate numeric(5,2) not null default 18,
  default_fee_paise bigint, created_at timestamptz not null default now()
);

create table if not exists public.invoice_sequences (
  id uuid primary key default gen_random_uuid(), practice_id uuid not null references public.practices(id) on delete cascade,
  financial_year text not null, document_type text not null check (document_type in ('proforma','tax')),
  next_number integer not null default 1, unique(practice_id, financial_year, document_type)
);

create table if not exists public.proforma_invoices (
  id uuid primary key default gen_random_uuid(), practice_id uuid not null references public.practices(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict, number text, financial_year text not null,
  status text not null default 'draft' check (status in ('draft','sent','converted','expired')),
  issue_date date not null default current_date, due_date date, notes text,
  subtotal_paise bigint not null default 0, tax_paise bigint not null default 0, total_paise bigint not null default 0,
  converted_invoice_id uuid, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.proforma_invoice_items (
  id uuid primary key default gen_random_uuid(), proforma_id uuid not null references public.proforma_invoices(id) on delete cascade,
  description text not null, sac_code text, quantity numeric(12,3) not null default 1, rate_paise bigint not null default 0,
  taxable boolean not null default true, gst_rate numeric(5,2) not null default 18, amount_paise bigint not null default 0
);

create table if not exists public.tax_invoices (
  id uuid primary key default gen_random_uuid(), practice_id uuid not null references public.practices(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict, number text, financial_year text not null,
  invoice_date date not null default current_date, due_date date, supplier_gstin text, recipient_gstin text,
  place_of_supply text, reverse_charge boolean not null default false,
  status text not null default 'issued' check (status in ('issued','cancelled')),
  subtotal_paise bigint not null default 0, cgst_paise bigint not null default 0, sgst_paise bigint not null default 0,
  igst_paise bigint not null default 0, total_paise bigint not null default 0, notes text,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.tax_invoice_items (
  id uuid primary key default gen_random_uuid(), tax_invoice_id uuid not null references public.tax_invoices(id) on delete restrict,
  description text not null, sac_code text, quantity numeric(12,3) not null default 1, rate_paise bigint not null default 0,
  taxable boolean not null default true, pure_agent boolean not null default false, gst_rate numeric(5,2) not null default 18,
  amount_paise bigint not null default 0
);
create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(), tax_invoice_id uuid not null references public.tax_invoices(id) on delete restrict,
  amount_received_paise bigint not null check (amount_received_paise > 0), received_on date not null default current_date,
  tds_paise bigint not null default 0, notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create index if not exists client_contacts_client_idx on public.client_contacts(client_id);
create index if not exists client_services_client_idx on public.client_services(client_id);
create index if not exists proforma_practice_created_idx on public.proforma_invoices(practice_id, created_at desc);
create index if not exists tax_invoice_practice_created_idx on public.tax_invoices(practice_id, created_at desc);

alter table public.proforma_invoices drop constraint if exists proforma_invoice_number_length;
alter table public.proforma_invoices add constraint proforma_invoice_number_length check (number is null or length(number) <= 16);
alter table public.tax_invoices drop constraint if exists tax_invoice_number_length;
alter table public.tax_invoices add constraint tax_invoice_number_length check (number is null or length(number) <= 16);

alter table public.client_contacts enable row level security;
alter table public.client_services enable row level security;
alter table public.invoice_sequences enable row level security;
alter table public.proforma_invoices enable row level security;
alter table public.proforma_invoice_items enable row level security;
alter table public.tax_invoices enable row level security;
alter table public.tax_invoice_items enable row level security;
alter table public.invoice_payments enable row level security;

create or replace function public.can_access_invoice_client(p_client_id uuid)
returns boolean language sql security definer set search_path=public as $$
  select exists(select 1 from public.clients c join public.users u on u.practice_id=c.practice_id
    where c.id=p_client_id and u.id=auth.uid() and (u.role='principal' or c.assigned_to=auth.uid()));
$$;
grant execute on function public.can_access_invoice_client(uuid) to authenticated;

drop policy if exists "Practice members manage client contacts" on public.client_contacts;
create policy "Practice members manage client contacts" on public.client_contacts for all to authenticated
using (public.can_access_invoice_client(client_id)) with check (public.can_access_invoice_client(client_id));
drop policy if exists "Practice members manage client services" on public.client_services;
create policy "Practice members manage client services" on public.client_services for all to authenticated
using (public.can_access_invoice_client(client_id)) with check (public.can_access_invoice_client(client_id));

do $$ begin
  create policy "Practice members manage proformas" on public.proforma_invoices for all to authenticated
  using (public.can_access_invoice_client(client_id)) with check (public.can_access_invoice_client(client_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Practice members view proforma items" on public.proforma_invoice_items for select to authenticated
  using (exists(select 1 from public.proforma_invoices p where p.id=proforma_id and public.can_access_invoice_client(p.client_id)));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Practice members manage tax invoices" on public.tax_invoices for all to authenticated
  using (public.can_access_invoice_client(client_id)) with check (public.can_access_invoice_client(client_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Practice members view tax items" on public.tax_invoice_items for select to authenticated
  using (exists(select 1 from public.tax_invoices t where t.id=tax_invoice_id and public.can_access_invoice_client(t.client_id)));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Practice members manage payments" on public.invoice_payments for all to authenticated
  using (exists(select 1 from public.tax_invoices t where t.id=tax_invoice_id and public.can_access_invoice_client(t.client_id)))
  with check (exists(select 1 from public.tax_invoices t where t.id=tax_invoice_id and public.can_access_invoice_client(t.client_id)));
exception when duplicate_object then null; end $$;

create or replace function public.issue_tax_invoice(
  p_client_id uuid, p_supplier_gstin text, p_recipient_gstin text, p_place_of_supply text,
  p_reverse_charge boolean, p_invoice_date date, p_due_date date, p_notes text,
  p_items jsonb
)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_practice uuid; v_fy text; v_seq integer; v_invoice_id uuid; v_subtotal bigint:=0; v_cgst bigint:=0; v_sgst bigint:=0; v_igst bigint:=0; v_item jsonb; v_rate numeric; v_amount bigint; v_same_state boolean;
begin
  if not public.can_access_invoice_client(p_client_id) then raise exception 'Not allowed'; end if;
  select practice_id into v_practice from public.clients where id=p_client_id;
  v_fy=case when extract(month from coalesce(p_invoice_date,current_date))>=4 then right(extract(year from coalesce(p_invoice_date,current_date))::text,2)||'-'||right((extract(year from coalesce(p_invoice_date,current_date))+1)::text,2) else right((extract(year from coalesce(p_invoice_date,current_date))-1)::text,2)||'-'||right(extract(year from coalesce(p_invoice_date,current_date))::text,2) end;
  insert into public.invoice_sequences(practice_id,financial_year,document_type) values(v_practice,v_fy,'tax') on conflict(practice_id,financial_year,document_type) do nothing;
  select next_number into v_seq from public.invoice_sequences where practice_id=v_practice and financial_year=v_fy and document_type='tax' for update;
  update public.invoice_sequences set next_number=next_number+1 where practice_id=v_practice and financial_year=v_fy and document_type='tax';
  v_same_state = left(coalesce(p_supplier_gstin,''),2) <> '' and left(coalesce(p_supplier_gstin,''),2)=coalesce(nullif(left(coalesce(p_recipient_gstin,''),2),''), p_place_of_supply);
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_amount=round((v_item->>'quantity')::numeric*(v_item->>'rate_paise')::numeric);
    v_rate=coalesce((v_item->>'gst_rate')::numeric,0);
    v_subtotal=v_subtotal+v_amount;
    if coalesce((v_item->>'taxable')::boolean,true) and not coalesce((v_item->>'pure_agent')::boolean,false) then
      if v_same_state then v_cgst=v_cgst+round(v_amount*v_rate/200); v_sgst=v_sgst+round(v_amount*v_rate/200); else v_igst=v_igst+round(v_amount*v_rate/100); end if;
    end if;
  end loop;
  insert into public.tax_invoices(practice_id,client_id,number,financial_year,invoice_date,due_date,supplier_gstin,recipient_gstin,place_of_supply,reverse_charge,notes,created_by,subtotal_paise,cgst_paise,sgst_paise,igst_paise,total_paise)
  values(v_practice,p_client_id,'INV/'||v_fy||'/'||lpad(v_seq::text,3,'0'),v_fy,coalesce(p_invoice_date,current_date),p_due_date,p_supplier_gstin,p_recipient_gstin,p_place_of_supply,p_reverse_charge,p_notes,auth.uid(),v_subtotal,v_cgst,v_sgst,v_igst,v_subtotal+v_cgst+v_sgst+v_igst) returning id into v_invoice_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_amount=round((v_item->>'quantity')::numeric*(v_item->>'rate_paise')::numeric);
    v_rate=coalesce((v_item->>'gst_rate')::numeric,0);
    insert into public.tax_invoice_items(tax_invoice_id,description,sac_code,quantity,rate_paise,taxable,pure_agent,gst_rate,amount_paise)
    values(v_invoice_id,v_item->>'description',v_item->>'sac_code',(v_item->>'quantity')::numeric,(v_item->>'rate_paise')::bigint,coalesce((v_item->>'taxable')::boolean,true),coalesce((v_item->>'pure_agent')::boolean,false),v_rate,v_amount);
  end loop;
  return v_invoice_id;
end; $$;
grant execute on function public.issue_tax_invoice(uuid,text,text,text,boolean,date,date,text,jsonb) to authenticated;

create or replace function public.create_proforma_invoice(
  p_client_id uuid, p_issue_date date, p_due_date date, p_items jsonb
)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_practice uuid; v_fy text; v_seq integer; v_id uuid; v_subtotal bigint:=0; v_tax bigint:=0; v_item jsonb; v_amount bigint;
begin
  if not public.can_access_invoice_client(p_client_id) then raise exception 'Not allowed'; end if;
  select practice_id into v_practice from public.clients where id=p_client_id;
  v_fy=case when extract(month from coalesce(p_issue_date,current_date))>=4 then right(extract(year from coalesce(p_issue_date,current_date))::text,2)||'-'||right((extract(year from coalesce(p_issue_date,current_date))+1)::text,2) else right((extract(year from coalesce(p_issue_date,current_date))-1)::text,2)||'-'||right(extract(year from coalesce(p_issue_date,current_date))::text,2) end;
  insert into public.invoice_sequences(practice_id,financial_year,document_type) values(v_practice,v_fy,'proforma') on conflict(practice_id,financial_year,document_type) do nothing;
  select next_number into v_seq from public.invoice_sequences where practice_id=v_practice and financial_year=v_fy and document_type='proforma' for update;
  update public.invoice_sequences set next_number=next_number+1 where practice_id=v_practice and financial_year=v_fy and document_type='proforma';
  insert into public.proforma_invoices(practice_id,client_id,number,financial_year,issue_date,due_date,subtotal_paise,total_paise,created_by)
  values(v_practice,p_client_id,'PI/'||v_fy||'/'||lpad(v_seq::text,3,'0'),v_fy,coalesce(p_issue_date,current_date),p_due_date,0,0,auth.uid()) returning id into v_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_amount=round((v_item->>'quantity')::numeric*(v_item->>'rate_paise')::numeric); v_subtotal=v_subtotal+v_amount;
    if coalesce((v_item->>'taxable')::boolean,true) and not coalesce((v_item->>'pure_agent')::boolean,false) then v_tax=v_tax+round(v_amount*coalesce((v_item->>'gst_rate')::numeric,0)/100); end if;
    insert into public.proforma_invoice_items(proforma_id,description,sac_code,quantity,rate_paise,taxable,gst_rate,amount_paise)
    values(v_id,v_item->>'description',v_item->>'sac_code',(v_item->>'quantity')::numeric,(v_item->>'rate_paise')::bigint,coalesce((v_item->>'taxable')::boolean,true),coalesce((v_item->>'gst_rate')::numeric,0),v_amount);
  end loop;
  update public.proforma_invoices set subtotal_paise=v_subtotal,tax_paise=v_tax,total_paise=v_subtotal+v_tax where id=v_id;
  return v_id;
end; $$;
grant execute on function public.create_proforma_invoice(uuid,date,date,jsonb) to authenticated;

create or replace function public.convert_proforma_to_tax(p_proforma_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_proforma public.proforma_invoices%rowtype; v_practice public.practices%rowtype; v_client public.clients%rowtype; v_tax_id uuid; v_items jsonb;
begin
  select * into v_proforma from public.proforma_invoices where id=p_proforma_id;
  if v_proforma.id is null or not public.can_access_invoice_client(v_proforma.client_id) then raise exception 'Not allowed'; end if;
  if v_proforma.status='converted' and v_proforma.converted_invoice_id is not null then return v_proforma.converted_invoice_id; end if;
  select * into v_practice from public.practices where id=v_proforma.practice_id;
  select * into v_client from public.clients where id=v_proforma.client_id;
  select coalesce(jsonb_agg(jsonb_build_object('description',description,'sac_code',sac_code,'quantity',quantity,'rate_paise',rate_paise,'taxable',taxable,'pure_agent',false,'gst_rate',gst_rate)),'[]'::jsonb) into v_items from public.proforma_invoice_items where proforma_id=p_proforma_id;
  v_tax_id := public.issue_tax_invoice(v_proforma.client_id,v_practice.gstin,v_client.gstin,coalesce(v_client.state_code,''),false,v_proforma.issue_date,v_proforma.due_date,v_proforma.notes,v_items);
  update public.proforma_invoices set status='converted', converted_invoice_id=v_tax_id where id=p_proforma_id;
  return v_tax_id;
end; $$;
grant execute on function public.convert_proforma_to_tax(uuid) to authenticated;

create or replace function public.prevent_issued_tax_invoice_mutation()
returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='DELETE' then raise exception 'Issued invoices cannot be deleted'; end if;
  if old.status='issued' and (new.status <> 'cancelled' or new.number <> old.number or new.client_id <> old.client_id or new.total_paise <> old.total_paise) then
    raise exception 'Issued invoices are locked. Cancel or issue a credit note.';
  end if;
  return new;
end; $$;
drop trigger if exists lock_issued_tax_invoice on public.tax_invoices;
create trigger lock_issued_tax_invoice before update or delete on public.tax_invoices for each row execute function public.prevent_issued_tax_invoice_mutation();
