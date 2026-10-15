-- Tracks email-confirmation state so the browser that started signup can
-- sign in after the email is confirmed on another device.
create table if not exists public.signup_verification_sessions (
  challenge_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verified_at timestamptz
);

alter table public.signup_verification_sessions enable row level security;

grant insert (challenge_id, user_id, expires_at)
  on public.signup_verification_sessions to anon, authenticated;
grant select (challenge_id, verified_at, expires_at)
  on public.signup_verification_sessions to anon;
grant select (challenge_id, user_id, verified_at, expires_at)
  on public.signup_verification_sessions to authenticated;
grant update (verified_at)
  on public.signup_verification_sessions to authenticated;

drop policy if exists "Signup clients can create verification challenges"
  on public.signup_verification_sessions;
create policy "Signup clients can create verification challenges"
  on public.signup_verification_sessions
  for insert
  to anon, authenticated
  with check (
    expires_at > now()
    and expires_at <= now() + interval '25 hours'
  );

drop policy if exists "Public can read completed signup challenges"
  on public.signup_verification_sessions;
create policy "Public can read completed signup challenges"
  on public.signup_verification_sessions
  for select
  to anon
  using (verified_at is not null and expires_at > now());

drop policy if exists "Users can read their own signup challenges"
  on public.signup_verification_sessions;
create policy "Users can read their own signup challenges"
  on public.signup_verification_sessions
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (verified_at is not null and expires_at > now())
  );

drop policy if exists "Verified users can complete their own signup challenge"
  on public.signup_verification_sessions;
create policy "Verified users can complete their own signup challenge"
  on public.signup_verification_sessions
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and verified_at is null
    and expires_at > now()
  )
  with check (
    (select auth.uid()) = user_id
    and verified_at is not null
  );
