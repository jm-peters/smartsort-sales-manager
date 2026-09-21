create table if not exists public.shop_invitations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  email text not null,
  role text not null default 'cashier' check (role = 'cashier'),
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index if not exists shop_invitations_pending_email_idx
  on public.shop_invitations (shop_id, lower(email))
  where status = 'pending';

alter table public.shop_invitations enable row level security;

create or replace function public.create_owner_shop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_shop_id uuid;
  shop_phone text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
begin
  if new.raw_user_meta_data ->> 'shopName' is null
    or new.raw_user_meta_data ->> 'ownerName' is null
    or shop_phone is null then
    return new;
  end if;

  insert into public.shops (name, owner_name, phone)
  values (
    trim(new.raw_user_meta_data ->> 'shopName'),
    trim(new.raw_user_meta_data ->> 'ownerName'),
    shop_phone
  )
  returning id into new_shop_id;

  insert into public.shop_members (shop_id, user_id, role)
  values (new_shop_id, new.id, 'owner');

  return new;
exception
  when unique_violation then
    raise exception 'A shop with this phone number already exists.' using errcode = '23505';
end;
$$;

drop trigger if exists on_auth_user_created_create_shop on auth.users;
create trigger on_auth_user_created_create_shop
  after insert on auth.users
  for each row execute function public.create_owner_shop();

create or replace function public.claim_cashier_invitation()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.shop_members (shop_id, user_id, role)
  select invitation.shop_id, auth.uid(), 'cashier'
  from public.shop_invitations invitation
  where lower(invitation.email) = lower((select email from auth.users where id = auth.uid()))
    and invitation.status = 'pending'
    and invitation.expires_at > now()
  on conflict (shop_id, user_id) do nothing;

  update public.shop_invitations
  set status = 'accepted', accepted_at = now()
  where lower(email) = lower((select email from auth.users where id = auth.uid()))
    and status = 'pending'
    and expires_at > now();
end;
$$;

create or replace function public.get_my_shop_context()
returns table (shop_id uuid, shop_name text, owner_name text, phone text, role text)
language sql
security definer
stable
set search_path = public
as $$
  select shop.id, shop.name, shop.owner_name, shop.phone, member.role
  from public.shop_members member
  join public.shops shop on shop.id = member.shop_id
  where member.user_id = auth.uid()
  order by member.created_at
  limit 1;
$$;

create or replace function public.is_shop_cashier(target_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_members
    where shop_id = target_shop_id
      and user_id = auth.uid()
      and role = 'cashier'
  );
$$;

create or replace function public.invite_cashier(cashier_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_shop_id uuid;
  invitation_id uuid;
  normalized_email text := lower(trim(cashier_email));
begin
  if auth.uid() is null or normalized_email = '' then
    raise exception 'A valid cashier email is required.' using errcode = '22023';
  end if;

  select shop_id into owner_shop_id
  from public.shop_members
  where user_id = auth.uid() and role = 'owner'
  order by created_at
  limit 1;

  if owner_shop_id is null then
    raise exception 'Only shop owners can invite cashiers.' using errcode = '42501';
  end if;

  insert into public.shop_invitations (shop_id, email, invited_by)
  values (owner_shop_id, normalized_email, auth.uid())
  on conflict (shop_id, lower(email)) where status = 'pending'
  do update set expires_at = now() + interval '7 days', invited_by = auth.uid()
  returning id into invitation_id;

  return invitation_id;
end;
$$;

create policy shop_invitations_owner_access on public.shop_invitations
  for select using (public.is_shop_owner(shop_id));

drop policy if exists products_member_access on public.products;
create policy products_member_select on public.products
  for select using (public.is_shop_member(shop_id));

create policy products_owner_write on public.products
  for insert with check (public.is_shop_owner(shop_id));

create policy products_owner_update on public.products
  for update using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

create policy products_owner_delete on public.products
  for delete using (public.is_shop_owner(shop_id));

create policy products_cashier_stock_update on public.products
  for update using (public.is_shop_cashier(shop_id))
  with check (public.is_shop_cashier(shop_id));

create or replace function public.protect_cashier_product_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_shop_cashier(old.shop_id) and (
    new.shop_id <> old.shop_id
    or new.name <> old.name
    or new.search_key <> old.search_key
    or new.buying_price <> old.buying_price
    or new.selling_price <> old.selling_price
    or new.low_limit <> old.low_limit
    or new.unit <> old.unit
    or new.barcode is distinct from old.barcode
    or new.image_emoji is distinct from old.image_emoji
    or new.is_active <> old.is_active
  ) then
    raise exception 'Cashiers may only update stock quantities.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_cashier_product_update on public.products;
create trigger protect_cashier_product_update
  before update on public.products
  for each row execute function public.protect_cashier_product_update();

revoke all on function public.create_owner_shop() from public;
revoke all on function public.claim_cashier_invitation() from public;
revoke all on function public.get_my_shop_context() from public;
revoke all on function public.invite_cashier(text) from public;
revoke all on function public.is_shop_cashier(uuid) from public;
revoke all on function public.protect_cashier_product_update() from public;
grant execute on function public.claim_cashier_invitation() to authenticated;
grant execute on function public.get_my_shop_context() to authenticated;
grant execute on function public.invite_cashier(text) to authenticated;
grant execute on function public.is_shop_cashier(uuid) to authenticated;