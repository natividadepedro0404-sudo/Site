-- Supabase schema for Hypex store

-- users
create table if not exists public.users (
  id uuid default uuid_generate_v4() primary key,
  email text unique not null,
  password_hash text not null,
  name text,
  address jsonb,
  role text default 'customer',
  created_at timestamptz default now()
);

-- products
create table if not exists public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  price numeric(10,2) default 0,
  stock int default 0,
  images text[] default array[]::text[],
  created_at timestamptz default now()
);

-- coupons
create table if not exists public.coupons (
  id uuid default uuid_generate_v4() primary key,
  code text unique not null,
  type text check (type in ('percentage','fixed')) not null,
  value numeric not null,
  active boolean default true,
  expires_at timestamptz
);

-- orders
create table if not exists public.orders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id),
  items jsonb not null,
  total numeric(10,2) not null,
  address jsonb,
  payment jsonb,
  status text default 'pedido feito',
  delivery_estimate timestamptz,
  payment_confirmed_at timestamptz,
  created_at timestamptz default now()
);

-- storage bucket: product_images (create in Supabase storage UI)