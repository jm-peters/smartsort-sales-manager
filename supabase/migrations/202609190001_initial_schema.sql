create extension if not exists pgcrypto;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text not null,
  phone text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  search_key text not null,
  buying_price integer not null default 0 check (buying_price >= 0),
  selling_price integer not null check (selling_price > 0),
  low_limit integer not null default 5 check (low_limit >= 0),
  unit text not null default 'pcs',
  barcode text,
  image_emoji text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  device_id text
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  sale_no integer not null,
  total integer not null check (total >= 0),
  total_profit integer not null default 0,
  item_count integer not null default 0 check (item_count >= 0),
  payment_method text not null check (payment_method in ('cash', 'mpesa', 'deni')),
  status text not null default 'completed' check (status in ('completed', 'void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  device_id text,
  created_by uuid,
  cash_session_id uuid
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  qty integer not null check (qty > 0),
  unit_price integer not null check (unit_price >= 0),
  unit_cost integer not null default 0 check (unit_cost >= 0),
  cost_unknown boolean not null default false,
  line_total integer not null check (line_total >= 0),
  line_profit integer not null default 0
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id),
  delta integer not null,
  reason text not null check (reason in ('opening', 'purchase', 'sale', 'void', 'adjustment', 'damage', 'return')),
  ref_type text,
  ref_id uuid,
  unit_cost integer,
  note text,
  created_at timestamptz not null default now(),
  device_id text,
  created_by uuid
);

create index if not exists products_shop_id_idx on public.products(shop_id);
create index if not exists sales_shop_created_idx on public.sales(shop_id, created_at);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id, created_at);

alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;