-- INFRONS Invoice Log and atomic payment register.
-- Additive migration. Run after client_master_invoicing_setup.sql.

alter table public.invoice_payments add column if not exists payment_mode text not null default 'other';
alter table public.invoice_payments add column if not exists reference_number text;
alter table public.invoice_payments add column if not exists note text;
alter table public.invoice_payments add column if not exists is_reversal boolean not null default false;
alter table public.invoice_payments add column if not exists reversed_payment_id uuid references public.invoice_payments(id) on delete restrict;
alter table public.invoice_payments add column if not exists reversal_reason text;

do $$ begin
  alter table public.invoice_payments add constraint invoice_payments_mode_check
    check (payment_mode in ('upi', 'bank_transfer', 'cheque', 'cash', 'other'));
exception when duplicate_object then null; end $$;
alter table public.invoice_payments drop constraint if exists invoice_payments_tds_check;
do $$ begin
  alter table public.invoice_payments add constraint invoice_payments_tds_nonnegative_check check (tds_paise >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.invoice_payments add constraint invoice_payments_reversal_check
    check ((is_reversal = false and reversed_payment_id is null and reversal_reason is null)
      or (is_reversal = true and reversed_payment_id is not null and reversal_reason is not null));
exception when duplicate_object then null; end $$;

create unique index if not exists invoice_payments_one_reversal_idx
  on public.invoice_payments(reversed_payment_id) where is_reversal = true;
create index if not exists invoice_payments_invoice_date_idx
  on public.invoice_payments(tax_invoice_id, received_on desc);
create index if not exists tax_invoices_register_idx
  on public.tax_invoices(practice_id, invoice_date desc, due_date, client_id);
create index if not exists tax_invoices_number_idx on public.tax_invoices(number);
create index if not exists proforma_register_idx
  on public.proforma_invoices(practice_id, issue_date desc, due_date, client_id);
create index if not exists proforma_number_idx on public.proforma_invoices(number);

create or replace view public.invoice_register with (security_invoker = true) as
with payment_totals as (
  select
    tax_invoice_id,
    coalesce(sum(case when is_reversal then -amount_received_paise else amount_received_paise end), 0)::bigint as received_paise,
    coalesce(sum(case when is_reversal then -tds_paise else tds_paise end), 0)::bigint as tds_paise
  from public.invoice_payments
  group by tax_invoice_id
), tax_rows as (
  select
    t.id,
    t.practice_id,
    t.client_id,
    coalesce(c.legal_name, c.name) as client_name,
    'tax'::text as document_type,
    t.number as invoice_number,
    t.invoice_date,
    t.due_date,
    t.financial_year,
    t.subtotal_paise as taxable_value_paise,
    (t.cgst_paise + t.sgst_paise + t.igst_paise)::bigint as gst_paise,
    t.total_paise,
    coalesce(p.tds_paise, 0)::bigint as tds_paise,
    coalesce(p.received_paise, 0)::bigint as received_paise,
    greatest(t.total_paise - coalesce(p.received_paise, 0) - coalesce(p.tds_paise, 0), 0)::bigint as balance_paise,
    t.status as source_status,
    t.created_at
  from public.tax_invoices t
  join public.clients c on c.id = t.client_id
  left join payment_totals p on p.tax_invoice_id = t.id
  where public.can_access_invoice_client(t.client_id)
), proforma_rows as (
  select
    p.id,
    p.practice_id,
    p.client_id,
    coalesce(c.legal_name, c.name) as client_name,
    'proforma'::text as document_type,
    p.number as invoice_number,
    p.issue_date as invoice_date,
    p.due_date,
    p.financial_year,
    p.subtotal_paise as taxable_value_paise,
    p.tax_paise as gst_paise,
    p.total_paise,
    0::bigint as tds_paise,
    0::bigint as received_paise,
    p.total_paise as balance_paise,
    p.status as source_status,
    p.created_at
  from public.proforma_invoices p
  join public.clients c on c.id = p.client_id
  where public.can_access_invoice_client(p.client_id)
)
select
  rows.*,
  case
    when rows.document_type = 'proforma' and rows.source_status in ('draft', 'sent') then case when rows.source_status = 'draft' then 'Draft' else 'Issued' end
    when rows.document_type = 'proforma' then 'Cancelled'
    when rows.source_status = 'cancelled' then 'Cancelled'
    when rows.balance_paise <= 0 and rows.total_paise > 0 then 'Paid'
    when rows.due_date is not null and rows.due_date < current_date and rows.balance_paise > 0 then 'Overdue'
    when rows.received_paise + rows.tds_paise > 0 then 'Part-paid'
    else 'Issued'
  end as status
from (select * from tax_rows union all select * from proforma_rows) rows;

create or replace view public.client_invoice_balances with (security_invoker = true) as
select
  c.id as client_id,
  c.practice_id,
  coalesce(sum(case when r.document_type = 'tax' then r.balance_paise else 0 end), 0)::bigint as outstanding_paise,
  count(*) filter (where r.document_type = 'tax' and r.status = 'Overdue')::integer as overdue_invoice_count
from public.clients c
left join public.invoice_register r on r.client_id = c.id
group by c.id, c.practice_id;

create or replace function public.record_invoice_payment(
  p_tax_invoice_id uuid,
  p_amount_received_paise bigint,
  p_received_on date,
  p_payment_mode text,
  p_reference_number text,
  p_tds_paise bigint,
  p_note text
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_invoice public.tax_invoices%rowtype;
  v_received bigint;
  v_tds bigint;
  v_balance bigint;
  v_id uuid;
begin
  if p_amount_received_paise <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if coalesce(p_tds_paise, 0) < 0 then raise exception 'TDS cannot be negative'; end if;
  if p_payment_mode not in ('upi', 'bank_transfer', 'cheque', 'cash', 'other') then raise exception 'Unsupported payment mode'; end if;

  select * into v_invoice from public.tax_invoices where id = p_tax_invoice_id for update;
  if v_invoice.id is null or not public.can_access_invoice_client(v_invoice.client_id) then raise exception 'Not allowed'; end if;
  if v_invoice.status <> 'issued' then raise exception 'Payments apply only to issued tax invoices'; end if;

  select
    coalesce(sum(case when is_reversal then -amount_received_paise else amount_received_paise end), 0),
    coalesce(sum(case when is_reversal then -tds_paise else tds_paise end), 0)
  into v_received, v_tds
  from public.invoice_payments
  where tax_invoice_id = p_tax_invoice_id;

  v_balance := v_invoice.total_paise - v_received - v_tds;
  if p_amount_received_paise + coalesce(p_tds_paise, 0) > v_balance then
    raise exception 'Payment exceeds the remaining invoice balance of % paise', v_balance;
  end if;

  insert into public.invoice_payments(tax_invoice_id, amount_received_paise, received_on, tds_paise, notes, note, payment_mode, reference_number, created_by)
  values(p_tax_invoice_id, p_amount_received_paise, coalesce(p_received_on, current_date), coalesce(p_tds_paise, 0), p_note, p_note, p_payment_mode, nullif(trim(p_reference_number), ''), auth.uid())
  returning id into v_id;

  insert into public.client_activity_log(client_id, actor_id, action, description, metadata)
  values(v_invoice.client_id, auth.uid(), 'Payment recorded', 'Payment recorded for ' || coalesce(v_invoice.number, 'invoice'), jsonb_build_object('invoice_id', v_invoice.id, 'payment_id', v_id, 'amount_received_paise', p_amount_received_paise, 'tds_paise', coalesce(p_tds_paise, 0)));
  return v_id;
end; $$;
grant execute on function public.record_invoice_payment(uuid,bigint,date,text,text,bigint,text) to authenticated;

create or replace function public.reverse_invoice_payment(p_payment_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_payment public.invoice_payments%rowtype;
  v_invoice public.tax_invoices%rowtype;
  v_id uuid;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'A reversal reason is required'; end if;
  select * into v_payment from public.invoice_payments where id = p_payment_id for update;
  if v_payment.id is null or v_payment.is_reversal then raise exception 'Payment cannot be reversed'; end if;
  if not public.can_access_invoice_client((select client_id from public.tax_invoices where id = v_payment.tax_invoice_id)) then raise exception 'Not allowed'; end if;
  select * into v_invoice from public.tax_invoices where id = v_payment.tax_invoice_id for update;
  if exists(select 1 from public.invoice_payments where reversed_payment_id = v_payment.id) then raise exception 'Payment is already reversed'; end if;

  insert into public.invoice_payments(tax_invoice_id, amount_received_paise, received_on, tds_paise, notes, note, payment_mode, reference_number, created_by, is_reversal, reversed_payment_id, reversal_reason)
  values(v_payment.tax_invoice_id, v_payment.amount_received_paise, current_date, v_payment.tds_paise, p_reason, p_reason, v_payment.payment_mode, v_payment.reference_number, auth.uid(), true, v_payment.id, trim(p_reason))
  returning id into v_id;

  insert into public.client_activity_log(client_id, actor_id, action, description, metadata)
  values(v_invoice.client_id, auth.uid(), 'Payment reversed', 'Payment reversed for ' || coalesce(v_invoice.number, 'invoice'), jsonb_build_object('invoice_id', v_invoice.id, 'payment_id', v_payment.id, 'reversal_id', v_id, 'reason', trim(p_reason)));
  return v_id;
end; $$;
grant execute on function public.reverse_invoice_payment(uuid,text) to authenticated;

create or replace function public.get_invoice_register(
  p_limit integer default 50,
  p_offset integer default 0,
  p_status text default null,
  p_client_id uuid default null,
  p_document_type text default null,
  p_from_date date default null,
  p_to_date date default null,
  p_financial_year text default null,
  p_overdue_only boolean default false,
  p_has_balance boolean default false,
  p_search text default null
)
returns setof public.invoice_register
language sql security definer set search_path=public as $$
  select r.* from public.invoice_register r
  where (p_status is null or r.status = p_status)
    and (p_client_id is null or r.client_id = p_client_id)
    and (p_document_type is null or r.document_type = p_document_type)
    and (p_from_date is null or r.invoice_date >= p_from_date)
    and (p_to_date is null or r.invoice_date <= p_to_date)
    and (p_financial_year is null or r.financial_year = p_financial_year)
    and (not p_overdue_only or r.status = 'Overdue')
    and (not p_has_balance or r.balance_paise > 0)
    and (p_search is null or r.invoice_number ilike '%' || p_search || '%' or r.client_name ilike '%' || p_search || '%')
  order by r.invoice_date desc, r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100)) offset greatest(coalesce(p_offset, 0), 0);
$$;
grant execute on function public.get_invoice_register(integer,integer,text,uuid,text,date,date,text,boolean,boolean,text) to authenticated;

create or replace function public.record_invoice_payments_bulk(p_payments jsonb, p_received_on date, p_payment_mode text)
returns integer language plpgsql security definer set search_path=public as $$
declare
  v_item jsonb;
  v_id uuid;
  v_count integer := 0;
begin
  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then raise exception 'No payments selected'; end if;
  for v_item in select * from jsonb_array_elements(p_payments) loop
    v_id := public.record_invoice_payment(
      (v_item->>'tax_invoice_id')::uuid,
      (v_item->>'amount_received_paise')::bigint,
      coalesce(p_received_on, current_date),
      p_payment_mode,
      nullif(v_item->>'reference_number', ''),
      coalesce((v_item->>'tds_paise')::bigint, 0),
      nullif(v_item->>'note', '')
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;
grant execute on function public.record_invoice_payments_bulk(jsonb,date,text) to authenticated;

create or replace function public.invoice_log_totals(
  p_status text default null,
  p_client_id uuid default null,
  p_document_type text default null,
  p_from_date date default null,
  p_to_date date default null,
  p_financial_year text default null,
  p_overdue_only boolean default false,
  p_has_balance boolean default false,
  p_search text default null
)
returns table(invoice_count bigint, billed_paise bigint, received_paise bigint, tds_paise bigint, outstanding_paise bigint)
language sql security definer set search_path=public as $$
  select count(*)::bigint, coalesce(sum(total_paise),0)::bigint, coalesce(sum(received_paise),0)::bigint, coalesce(sum(tds_paise),0)::bigint, coalesce(sum(balance_paise),0)::bigint
  from public.invoice_register r
  where (p_status is null or r.status = p_status)
    and (p_client_id is null or r.client_id = p_client_id)
    and (p_document_type is null or r.document_type = p_document_type)
    and (p_from_date is null or r.invoice_date >= p_from_date)
    and (p_to_date is null or r.invoice_date <= p_to_date)
    and (p_financial_year is null or r.financial_year = p_financial_year)
    and (not p_overdue_only or r.status = 'Overdue')
    and (not p_has_balance or r.balance_paise > 0)
    and (p_search is null or r.invoice_number ilike '%' || p_search || '%' or r.client_name ilike '%' || p_search || '%');
$$;
grant execute on function public.invoice_log_totals(text,uuid,text,date,date,text,boolean,boolean,text) to authenticated;

create or replace function public.invoice_dashboard_summary()
returns table(receivables_paise bigint, collected_mtd_paise bigint, billed_mtd_paise bigint, ageing_0_30_paise bigint, ageing_31_60_paise bigint, ageing_61_90_paise bigint, ageing_90_plus_paise bigint)
language sql security definer set search_path=public as $$
  with visible as (
    select r.* from public.invoice_register r
    where r.document_type = 'tax' and r.status <> 'Cancelled'
  ), mtd as (
    select coalesce(sum(case when invoice_date >= date_trunc('month', current_date)::date then total_paise else 0 end), 0)::bigint billed,
           coalesce(sum(case when invoice_date >= date_trunc('month', current_date)::date then received_paise + tds_paise else 0 end), 0)::bigint collected
    from visible
  )
  select
    coalesce(sum(balance_paise), 0)::bigint,
    (select collected from mtd),
    (select billed from mtd),
    coalesce(sum(case when due_date >= current_date - 30 and due_date < current_date then balance_paise else 0 end), 0)::bigint,
    coalesce(sum(case when due_date < current_date - 30 and due_date >= current_date - 60 then balance_paise else 0 end), 0)::bigint,
    coalesce(sum(case when due_date < current_date - 60 and due_date >= current_date - 90 then balance_paise else 0 end), 0)::bigint,
    coalesce(sum(case when due_date < current_date - 90 then balance_paise else 0 end), 0)::bigint
  from visible;
$$;
grant execute on function public.invoice_dashboard_summary() to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.invoice_payments;
exception when duplicate_object then null; end $$;
