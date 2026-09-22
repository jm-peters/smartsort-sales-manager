alter table public.shops
  alter column phone drop not null;

alter table public.shops
  drop constraint if exists shops_phone_key;

alter table public.shops
  add column if not exists avatar_emoji text default '🏪',
  add column if not exists tagline text,
  add column if not exists contact_email text,
  add column if not exists alt_phone text,
  add column if not exists county text,
  add column if not exists sub_county text,
  add column if not exists town text,
  add column if not exists landmark text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_captured_at timestamptz;

alter table public.shop_members
  add column if not exists username text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists onboarding_step text not null default 'account_created'
    check (onboarding_step in ('account_created', 'contact', 'location', 'plan', 'complete')),
  add column if not exists profile_completed_at timestamptz;

create unique index if not exists shop_members_username_idx
  on public.shop_members (lower(username)) where username is not null;

create table if not exists public.usernames (
  username_lower text primary key,
  username_display text not null,
  shop_user_id uuid not null,
  shop_id uuid not null,
  created_at timestamptz not null default now(),
  constraint usernames_member_fk foreign key (shop_id, shop_user_id)
    references public.shop_members(shop_id, user_id) on delete cascade
);

revoke all on public.usernames from anon, authenticated;

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  billing_frequency text not null default 'daily'
    check (billing_frequency in ('daily', 'weekly', 'monthly')),
  amount_kes integer,
  grace_period_days integer not null default 3,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (code, name)
values ('standard_daily', 'Kila Siku')
on conflict (code) do nothing;

create table if not exists public.shop_subscriptions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'trial'
    check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_payment_due_at timestamptz,
  auto_suspend boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  change_seq bigint
);

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  subscription_id uuid not null references public.shop_subscriptions(id),
  amount_kes integer not null,
  method text check (method in ('mpesa', 'cash', 'manual_adjustment')),
  reference text,
  period_covered_start date,
  period_covered_end date,
  recorded_by uuid,
  created_at timestamptz not null default now(),
  change_seq bigint
);

alter table public.subscription_plans enable row level security;
alter table public.shop_subscriptions enable row level security;
alter table public.subscription_payments enable row level security;

create policy subscription_plans_read on public.subscription_plans
  for select to authenticated using (is_active = true);

create policy shop_subscriptions_member_read on public.shop_subscriptions
  for select to authenticated using (public.is_shop_member(shop_id));

create policy subscription_payments_member_read on public.subscription_payments
  for select to authenticated using (public.is_shop_member(shop_id));

create or replace function public.check_username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.usernames where username_lower = lower(trim(p_username)))
$$;

create or replace function public.resolve_username(p_username text)
returns text language sql stable security definer set search_path = public as $$
  select m.email
  from public.usernames u
  join public.shop_members m on m.shop_id = u.shop_id and m.user_id = u.shop_user_id
  where u.username_lower = lower(trim(p_username))
  limit 1
$$;

revoke all on function public.check_username_available(text) from public;
revoke all on function public.resolve_username(text) from public;
grant execute on function public.check_username_available(text) to anon, authenticated;
grant execute on function public.resolve_username(text) to anon;

create or replace function public.create_owner_shop()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_shop_id uuid;
  username_value text := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  shop_name_value text := trim(coalesce(new.raw_user_meta_data ->> 'shopName', ''));
  owner_name_value text := trim(coalesce(new.raw_user_meta_data ->> 'ownerName', ''));
begin
  if username_value = '' or shop_name_value = '' or owner_name_value = '' then
    return new;
  end if;

  insert into public.shops (name, owner_name, phone, contact_email)
  values (shop_name_value, owner_name_value, nullif(trim(new.raw_user_meta_data ->> 'phone'), ''), lower(new.email))
  returning id into new_shop_id;

  insert into public.shop_members (shop_id, user_id, role, username, email, phone)
  values (new_shop_id, new.id, 'owner', username_value, lower(new.email), nullif(trim(new.raw_user_meta_data ->> 'phone'), ''));

  insert into public.usernames (username_lower, username_display, shop_user_id, shop_id)
  values (username_value, new.raw_user_meta_data ->> 'username', new.id, new_shop_id);

  insert into public.shop_subscriptions (shop_id, plan_id, trial_ends_at)
  select new_shop_id, id, now() + interval '30 days'
  from public.subscription_plans where code = 'standard_daily';

  return new;
exception when unique_violation then
  raise exception 'That username or shop already exists.' using errcode = '23505';
end;
$$;

drop trigger if exists on_auth_user_created_create_shop on auth.users;
create trigger on_auth_user_created_create_shop after insert on auth.users
for each row execute function public.create_owner_shop();

create or replace function public.ensure_my_shop()
returns void language plpgsql security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  account auth.users%rowtype;
  new_shop_id uuid;
  username_value text;
  shop_name_value text;
  owner_name_value text;
  phone_value text;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if exists (select 1 from public.shop_members where user_id = current_user_id) then
    return;
  end if;

  select * into account from auth.users where id = current_user_id;
  username_value := lower(trim(coalesce(account.raw_user_meta_data ->> 'username', '')));
  shop_name_value := trim(coalesce(account.raw_user_meta_data ->> 'shopName', ''));
  owner_name_value := trim(coalesce(account.raw_user_meta_data ->> 'ownerName', ''));
  phone_value := nullif(trim(coalesce(account.raw_user_meta_data ->> 'phone', '')), '');

  if username_value = '' or shop_name_value = '' or owner_name_value = '' then
    raise exception 'Your account profile is incomplete.' using errcode = '22023';
  end if;

  insert into public.shops (name, owner_name, phone, contact_email)
  values (shop_name_value, owner_name_value, phone_value, lower(account.email))
  returning id into new_shop_id;

  insert into public.shop_members (shop_id, user_id, role, username, email, phone)
  values (new_shop_id, current_user_id, 'owner', username_value, lower(account.email), phone_value);

  insert into public.usernames (username_lower, username_display, shop_user_id, shop_id)
  values (username_value, account.raw_user_meta_data ->> 'username', current_user_id, new_shop_id);

  insert into public.shop_subscriptions (shop_id, plan_id, trial_ends_at)
  select new_shop_id, id, now() + interval '30 days'
  from public.subscription_plans where code = 'standard_daily';
exception when unique_violation then
  raise exception 'That username or shop already exists.' using errcode = '23505';
end;
$$;

revoke all on function public.ensure_my_shop() from public;
grant execute on function public.ensure_my_shop() to authenticated;

drop function if exists public.get_my_shop_context();
create or replace function public.get_my_shop_context()
returns table (shop_id uuid, shop_name text, owner_name text, phone text, role text, username text, email text, onboarding_step text)
language sql stable security definer set search_path = public as $$
  select shop.id, shop.name, shop.owner_name, coalesce(member.phone, shop.phone), member.role,
    member.username, member.email, member.onboarding_step
  from public.shop_members member join public.shops shop on shop.id = member.shop_id
  where member.user_id = auth.uid() order by member.created_at limit 1
$$;

grant execute on function public.get_my_shop_context() to authenticated;