-- TriMTL: accounts, scanned items, game scores, friends (owner: Waddah).
-- Run once: Supabase dashboard -> SQL Editor -> paste and run, or `npx supabase db push`.
-- Every table has row-level security (RLS): a signed-in user can only touch their own rows.
-- Never store a bin here: store the rule id + context and let the rules engine decide the bin,
-- so stored items follow rule updates (v7 moved cans from "special" to "recycling").

-- ---------- profiles: one per auth user ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_.-]{3,24}$'),
  created_at timestamptz not null default now()
);

-- Created by the server on sign-up from the username the app passes as user metadata,
-- so a profile can't be missing or created for someone else.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'user_' || left(new.id::text, 8)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- scanned_items: every item a user scanned and saved (feeds the game and analytics) ----------
create table public.scanned_items (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  rule_id text,                                  -- null = no rule matched ("Needs verification")
  category text,                                 -- rule's category, or Gemini's guess when no rule
  name text not null check (char_length(name) between 1 and 120),
  count int not null default 1 check (count between 1 and 99),
  borough text,                                  -- context the item was scanned in; null = city default
  has_brown_bin boolean not null default true,
  scanned_at timestamptz not null default now()
);
create index scanned_items_user on public.scanned_items (user_id, scanned_at desc);

-- ---------- game_scores: one row per finished round ----------
-- shortcut: scores are reported by the app, so a modified client could fake them;
-- move scoring into a database function before the leaderboard matters for prizes.
create table public.game_scores (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  mode text not null check (mode in ('daily', 'mine')),
  items int not null check (items between 1 and 50),
  correct int not null check (correct between 0 and items),
  xp int not null check (xp between 0 and 1000),
  played_at timestamptz not null default now()
);
create index game_scores_user on public.game_scores (user_id, played_at desc);

-- ---------- friendships: one row per request; the receiver accepts it ----------
create table public.friendships (
  user_id uuid not null references public.profiles on delete cascade,    -- who asked
  friend_id uuid not null references public.profiles on delete cascade,  -- who was asked
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- ---------- row-level security ----------
alter table public.profiles enable row level security;
alter table public.scanned_items enable row level security;
alter table public.game_scores enable row level security;
alter table public.friendships enable row level security;

-- Usernames are visible to signed-in users so people can find friends.
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own scans" on public.scanned_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Own scores only for now; a leaderboard needs a security-definer function that returns totals.
create policy "own scores read" on public.game_scores for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own scores insert" on public.game_scores for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "see my friendships" on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_id, friend_id));
create policy "send request" on public.friendships for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy "accept request" on public.friendships for update to authenticated
  using (friend_id = (select auth.uid())) with check (friend_id = (select auth.uid()));
create policy "remove friendship" on public.friendships for delete to authenticated
  using ((select auth.uid()) in (user_id, friend_id));
-- Accepting may only change the status, never who the friendship is between.
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;
