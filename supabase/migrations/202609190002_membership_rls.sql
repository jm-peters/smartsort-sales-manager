create table if not exists public.shop_members (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'cashier')),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create index if not exists shop_members_user_id_idx on public.shop_members(user_id);

alter table public.shop_members enable row level security;

create or replace function public.is_shop_member(target_shop_id uuid)
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
  );
$$;

create or replace function public.is_shop_owner(target_shop_id uuid)
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
      and role = 'owner'
  );
$$;

create policy shop_members_select_own on public.shop_members
  for select using (user_id = auth.uid());

create policy shops_select_member on public.shops
  for select using (public.is_shop_member(id));

create policy shops_update_owner on public.shops
  for update using (public.is_shop_owner(id));

create policy products_member_access on public.products
  for all using (public.is_shop_member(shop_id))
  with check (public.is_shop_member(shop_id));

create policy sales_member_access on public.sales
  for all using (public.is_shop_member(shop_id))
  with check (public.is_shop_member(shop_id));

create policy sale_items_member_access on public.sale_items
  for all using (public.is_shop_member(shop_id))
  with check (public.is_shop_member(shop_id));

create policy stock_movements_member_access on public.stock_movements
  for all using (public.is_shop_member(shop_id))
  with check (public.is_shop_member(shop_id));

revoke all on function public.is_shop_member(uuid) from public;
grant execute on function public.is_shop_member(uuid) to authenticated;
revoke all on function public.is_shop_owner(uuid) from public;
grant execute on function public.is_shop_owner(uuid) to authenticated;
