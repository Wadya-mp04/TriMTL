-- Table privileges for signed-in users (owner: Waddah). Runs after the init and leaderboard migrations.
-- Newer Supabase projects don't grant new tables to the API roles automatically, so without this the
-- app gets "permission denied for table" before row-level security is even checked.
-- Grants say WHICH actions are possible; the RLS policies in init still decide WHOSE rows.
-- Signed-out users (anon) get nothing. Never grant to anon here.
grant select, update (username) on public.profiles to authenticated;
grant select, insert, delete on public.scanned_items to authenticated;
grant select, insert on public.game_scores to authenticated;
grant select, insert, delete on public.friendships to authenticated;  -- update (status) granted in init
