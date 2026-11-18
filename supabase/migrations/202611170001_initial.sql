create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/Los_Angeles'
);
create table public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  role text not null check (role in ('manager', 'cleaner'))
);
create function public.company_access(target uuid, manager_only boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships where user_id = auth.uid()
    and company_id = target and (not manager_only or role = 'manager'));
$$;
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  external_id text not null,
  name text not null,
  location text not null,
  image_url text,
  facts jsonb not null default '{}',
  unique(company_id, external_id),
  unique(company_id, id)
);
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  property_id uuid not null,
  external_id text not null,
  guest_name text not null,
  check_in date not null,
  check_out date not null,
  status text not null check(status in ('confirmed', 'cancelled')),
  source_version bigint not null check(source_version >= 0),
  early_check_in_paid boolean not null default false,
  unique(company_id, external_id),
  unique(company_id, id),
  unique(company_id, property_id, id),
  check(check_out > check_in),
  foreign key(company_id, property_id) references public.properties(company_id, id)
);
create table public.guest_contacts (
  reservation_id uuid primary key,
  company_id uuid not null,
  email text,
  phone text,
  foreign key(company_id, reservation_id) references public.reservations(company_id, id) on delete cascade
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  property_id uuid not null,
  reservation_id uuid not null,
  external_id text not null,
  body text not null,
  sent_at timestamptz not null,
  source_version bigint not null check(source_version >= 0),
  unique(company_id, external_id),
  foreign key(company_id, property_id, reservation_id) references public.reservations(company_id, property_id, id)
);
create table public.webhook_events (
  company_id uuid not null references public.companies(id),
  event_id text not null,
  received_at timestamptz not null default now(),
  primary key(company_id, event_id)
);
create table public.guest_links (
  token_hash text primary key,
  reservation_id uuid not null unique references public.reservations(id),
  expires_at timestamptz not null,
  checkout_session_id text unique,
  checkout_attempted_at timestamptz
);
create table public.payments (
  reservation_id uuid primary key references public.reservations(id),
  stripe_session_id text unique not null,
  stripe_event_id text unique not null,
  amount integer not null check(amount = 4000),
  currency text not null check(currency = 'usd'),
  paid_at timestamptz not null default now()
);
create index reservations_company_dates on public.reservations(company_id, check_in, check_out);
create index messages_company_reservation on public.messages(company_id, reservation_id);
alter table public.companies enable row level security;
alter table public.memberships enable row level security;
alter table public.properties enable row level security;
alter table public.reservations enable row level security;
alter table public.guest_contacts enable row level security;
alter table public.messages enable row level security;
alter table public.webhook_events enable row level security;
alter table public.guest_links enable row level security;
alter table public.payments enable row level security;
create policy company_read on public.companies for select to authenticated using(public.company_access(id));
create policy membership_read on public.memberships for select to authenticated using(user_id = auth.uid());
create policy reservation_read on public.reservations for select to authenticated using(
  public.company_access(company_id, true) or (
    public.company_access(company_id) and status = 'confirmed' and exists (
      select 1 from public.companies company where company.id = company_id
      and (now() at time zone company.timezone)::date >= check_in
      and (now() at time zone company.timezone)::date <= check_out
    )
  )
);
create policy property_read on public.properties for select to authenticated using(
  public.company_access(company_id, true) or exists(
    select 1 from public.reservations reservation where reservation.property_id = properties.id
  )
);
create policy contacts_manager on public.guest_contacts for select to authenticated using(public.company_access(company_id, true));
create policy messages_manager on public.messages for select to authenticated using(public.company_access(company_id, true));
revoke all on public.companies, public.memberships, public.properties, public.reservations, public.guest_contacts, public.messages from anon, authenticated;
grant select on public.companies, public.memberships, public.properties, public.reservations, public.guest_contacts, public.messages to authenticated;
revoke all on public.webhook_events, public.guest_links, public.payments from anon, authenticated;
grant all on all tables in schema public to service_role;
revoke all on function public.company_access(uuid, boolean) from public;
grant execute on function public.company_access(uuid, boolean) to authenticated, service_role;

create function public.ingest_pms(target_company uuid, event jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  property_uuid uuid;
  reservation_uuid uuid;
  inserted_count integer;
  payload jsonb := event->'data';
begin
  insert into public.webhook_events(company_id,event_id) values(target_company,event->>'id') on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return 'duplicate'; end if;
  select id into strict property_uuid from public.properties
    where company_id = target_company and external_id = payload->>'property_id';
  if event->>'type' = 'reservation.updated' then
    insert into public.reservations(company_id,property_id,external_id,guest_name,check_in,check_out,status,source_version)
    values(target_company,property_uuid,payload->>'id',payload->>'guest_name',(payload->>'check_in')::date,
      (payload->>'check_out')::date,payload->>'status',(event->>'version')::bigint)
    on conflict(company_id,external_id) do update set
      guest_name=excluded.guest_name, check_in=excluded.check_in, check_out=excluded.check_out,
      status=excluded.status, source_version=excluded.source_version
    where public.reservations.source_version < excluded.source_version
      and public.reservations.property_id = excluded.property_id
    returning id into reservation_uuid;
    if reservation_uuid is null then return 'stale'; end if;
    insert into public.guest_contacts(company_id,reservation_id,email,phone)
      values(target_company,reservation_uuid,payload->>'email',payload->>'phone')
      on conflict(reservation_id) do update set email=excluded.email,phone=excluded.phone;
  elsif event->>'type' = 'message.updated' then
    select id into strict reservation_uuid from public.reservations where company_id=target_company
      and external_id=payload->>'reservation_id' and property_id=property_uuid;
    insert into public.messages(company_id,property_id,reservation_id,external_id,body,sent_at,source_version)
      values(target_company,property_uuid,reservation_uuid,payload->>'id',payload->>'body',
        (payload->>'sent_at')::timestamptz,(event->>'version')::bigint)
    on conflict(company_id,external_id) do update set body=excluded.body,sent_at=excluded.sent_at,source_version=excluded.source_version
      where public.messages.source_version < excluded.source_version
        and public.messages.reservation_id = excluded.reservation_id;
    get diagnostics inserted_count = row_count;
    if inserted_count = 0 then return 'stale'; end if;
  else
    raise exception 'unsupported event';
  end if;
  return 'applied';
end;
$$;
revoke all on function public.ingest_pms(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.ingest_pms(uuid,jsonb) to service_role;

create function public.confirm_payment(reservation_uuid uuid, session_id text, event_id text, amount integer, currency_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare inserted_count integer;
begin
  perform 1 from public.guest_links where reservation_id=reservation_uuid and checkout_session_id=session_id for update;
  if not found then raise exception 'Unknown checkout session'; end if;
  insert into public.payments(reservation_id,stripe_session_id,stripe_event_id,amount,currency)
    values(reservation_uuid,session_id,event_id,amount,currency_code) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 1 then
    update public.reservations set early_check_in_paid=true where id=reservation_uuid;
  end if;
  return inserted_count = 1;
end;
$$;
revoke all on function public.confirm_payment(uuid,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid,text,text,integer,text) to service_role;

create function public.claim_checkout(reservation_uuid uuid)
returns timestamptz language sql security definer set search_path = '' as $$
  update public.guest_links set checkout_attempted_at=coalesce(checkout_attempted_at,now())
    where reservation_id=reservation_uuid returning checkout_attempted_at;
$$;
revoke all on function public.claim_checkout(uuid) from public, anon, authenticated;
grant execute on function public.claim_checkout(uuid) to service_role;