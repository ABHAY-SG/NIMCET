-- Account registration marker used to distinguish OAuth login from OAuth signup.
-- RLS intentionally limits reads/inserts to the signed-in user's own row.
create table if not exists public.oauth_account_registry (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.oauth_account_registry enable row level security;

grant select, insert on public.oauth_account_registry to authenticated;

drop policy if exists "Users can view their own account registry entry" on public.oauth_account_registry;
create policy "Users can view their own account registry entry"
  on public.oauth_account_registry
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can register their own account" on public.oauth_account_registry;
create policy "Users can register their own account"
  on public.oauth_account_registry
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
