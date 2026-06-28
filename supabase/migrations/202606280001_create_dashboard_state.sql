create table if not exists public.dashboard_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_state enable row level security;

revoke all on public.dashboard_state from anon;
grant select, insert, update, delete on public.dashboard_state to authenticated;

drop policy if exists "Users manage only their own dashboard" on public.dashboard_state;
create policy "Users manage only their own dashboard"
on public.dashboard_state
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

comment on table public.dashboard_state is
  'One private, row-level-secured dashboard state document per authenticated user.';
