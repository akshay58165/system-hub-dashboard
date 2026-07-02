create table if not exists public.youtube_oauth_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  channel_id text,
  channel_title text,
  updated_at timestamptz not null default now()
);

alter table public.youtube_oauth_tokens enable row level security;

revoke all on public.youtube_oauth_tokens from anon;
grant select, insert, update, delete on public.youtube_oauth_tokens to authenticated;

drop policy if exists "Users manage only their own youtube token" on public.youtube_oauth_tokens;
create policy "Users manage only their own youtube token"
on public.youtube_oauth_tokens
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

comment on table public.youtube_oauth_tokens is
  'Per-user Google OAuth refresh/access tokens for the real YouTube Analytics revenue integration.';
