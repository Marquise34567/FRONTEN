create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null check (plan in ('free','starter','creator','studio')),
  status text not null check (status in ('active','canceled','past_due','trialing')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists subscriptions_user_id_key on public.subscriptions(user_id);
create unique index if not exists subscriptions_stripe_customer_id_key on public.subscriptions(stripe_customer_id);
create unique index if not exists subscriptions_stripe_subscription_id_key on public.subscriptions(stripe_subscription_id);

alter table public.subscriptions enable row level security;

create policy "subscriptions_read_own" on public.subscriptions
for select using (auth.uid() = user_id);

create policy "subscriptions_service_role_insert" on public.subscriptions
for insert with check (auth.role() = 'service_role');

create policy "subscriptions_service_role_update" on public.subscriptions
for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create table if not exists public.usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null,
  renders_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.usage enable row level security;

create policy "usage_read_own" on public.usage
for select using (auth.uid() = user_id);

create policy "usage_service_role_insert" on public.usage
for insert with check (auth.role() = 'service_role');

create policy "usage_service_role_update" on public.usage
for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
