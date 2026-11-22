-- Database tests for supabase/migrations (owner: Waddah). Every check raises an error when it fails,
-- so psql exits non-zero. Never point this at a real project: it creates and deletes users.
\set ON_ERROR_STOP 1
\set alice '11111111-1111-1111-1111-111111111111'
\set bob   '22222222-2222-2222-2222-222222222222'
\set carol '33333333-3333-3333-3333-333333333333'

-- Assert helper: fails the run with a message.
create function pg_temp.ok(cond boolean, what text) returns void language plpgsql as
  $$ begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; end $$;
-- Runs a statement that must be refused (RLS, permission, check or unique violation).
create function pg_temp.refused(stmt text, what text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'NOT BLOCKED: %', what;
exception when insufficient_privilege or check_violation or unique_violation or invalid_parameter_value then null;
end $$;

-- Sign-up creates profiles from the username metadata (or a fallback name).
insert into auth.users values (:'alice', '{"username":"alice"}'), (:'bob', '{"username":"bob"}'), (:'carol', '{}');
select pg_temp.ok((select count(*) = 3 from public.profiles), 'profiles created on sign-up');
select pg_temp.ok(exists (select 1 from public.profiles where id = :'carol' and username like 'user_%'), 'fallback username');
select pg_temp.refused($$insert into auth.users values ('44444444-4444-4444-4444-444444444444', '{"username":"alice"}')$$, 'duplicate username');

set role authenticated;

-- Alice plays two rounds today, scans an item, and asks Bob to be friends.
select set_config('request.jwt.claim.sub', :'alice', false);
insert into public.scanned_items (rule_id, category, name, count) values ('drink_can', 'drink_container', 'Canette', 3);
insert into public.game_scores (mode, items, correct, xp) values ('mine', 4, 3, 45), ('daily', 4, 4, 60);
insert into public.friendships (user_id, friend_id) values (:'alice', :'bob');
select pg_temp.ok((select games = 2 and answered = 8 and correct = 7 and xp = 105 from public.player_stats), 'alice scoreboard');
select pg_temp.ok((select items = 3 from public.category_stats where category = 'drink_container'), 'category stats');
-- A retried save with the same client_key is ignored, so a round or scan is never counted twice.
insert into public.game_scores (mode, items, correct, xp, client_key) values ('mine', 2, 2, 30, 'round-1')
  on conflict (user_id, client_key) do nothing;
insert into public.game_scores (mode, items, correct, xp, client_key) values ('mine', 2, 2, 30, 'round-1')
  on conflict (user_id, client_key) do nothing;
insert into public.scanned_items (name, client_key) values ('Pile', 'scan-1:item-1'), ('Pile', 'scan-1:item-1')
  on conflict (user_id, client_key) do nothing;
select pg_temp.ok((select count(*) = 1 from public.game_scores where client_key = 'round-1'), 'retried score stored once');
select pg_temp.ok((select count(*) = 1 from public.scanned_items where client_key = 'scan-1:item-1'), 'retried scan stored once');

-- Bob plays once and accepts Alice's request; Carol plays once and has no friends.
select set_config('request.jwt.claim.sub', :'bob', false);
insert into public.game_scores (mode, items, correct, xp) values ('challenge', 4, 2, 30);
select pg_temp.ok((select count(*) = 0 from public.scanned_items), 'bob cannot see alice scans');
select pg_temp.ok((select count(*) = 1 from public.game_scores), 'bob sees only his own scores');
select pg_temp.ok((select xp = 30 from public.player_stats), 'bob scoreboard is his own');
select pg_temp.ok((select count(*) = 0 from public.category_stats), 'bob cannot see alice analytics');
update public.friendships set status = 'accepted' where friend_id = auth.uid();
select pg_temp.ok((select status = 'accepted' from public.friendships), 'bob accepts');

select set_config('request.jwt.claim.sub', :'carol', false);
insert into public.game_scores (mode, items, correct, xp) values ('mine', 2, 1, 15);

-- Leaderboard: friends = me + accepted friends; city = public players who played today, plus me.
-- Everyone is friends-only by default, so Carol (no friends) sees only herself on both.
select pg_temp.ok((select array_agg(username order by xp_today desc) = '{user_33333333}' from public.leaderboard('friends')), 'carol friends board is just her');
select pg_temp.ok((select array_agg(username order by xp_today desc) = '{user_33333333}' from public.leaderboard('city')), 'friends-only players stay off the city board');
select pg_temp.ok((select is_me from public.leaderboard('city') where username = 'user_33333333'), 'is_me flag');
select set_config('request.jwt.claim.sub', :'bob', false);
select pg_temp.ok((select array_agg(username order by xp_today desc) = '{alice,bob}' from public.leaderboard('friends')), 'bob friends board');
select pg_temp.ok((select xp_today = 135 from public.leaderboard('friends') where username = 'alice'), 'today xp summed');

-- ---------- Social (20261121000500_social.sql, owner: Juan) ----------
-- Settings: friends-only, no borough, brown bin by default; each user edits only their own.
select pg_temp.ok((select visibility = 'friends' and borough is null and has_brown_bin from public.profiles where id = auth.uid()), 'profile setting defaults');
update public.profiles set borough = 'verdun', has_brown_bin = false where id = auth.uid();
select pg_temp.ok((select borough = 'verdun' and not has_brown_bin from public.profiles where id = auth.uid()), 'bob saves his settings');
update public.profiles set visibility = 'private' where id = :'alice';  -- RLS: matches no row for bob
select pg_temp.refused($$update public.profiles set visibility = 'everyone' where id = auth.uid()$$, 'unknown visibility');
select pg_temp.refused($$update public.profiles set borough = 'Verdun; drop' where id = auth.uid()$$, 'borough must be a slug');
select pg_temp.refused($$update public.profiles set id = gen_random_uuid() where id = auth.uid()$$, 'profile id is not editable');
select pg_temp.refused($$select * from public.board('month')$$, 'unknown period');

-- Profile rows: Bob sees himself and his friend Alice, not Carol (friends-only, no friendship).
select pg_temp.ok((select array_agg(username order by username) = '{alice,bob}' from public.profiles), 'bob sees only friends profiles');

-- Board: Bob's friends are on it with is_friend; Carol isn't (not a friend, not public).
select pg_temp.ok((select array_agg(username || ':' || xp || ':' || is_friend order by xp desc) = '{alice:135:true,bob:30:false}' from public.board('today')), 'bob today board');
select pg_temp.ok((select is_me from public.board('today') where username = 'bob'), 'board is_me');

-- Dave: Bob's friend with no rounds (still listed at 0), and has a pending request to Carol.
reset role;
insert into auth.users values ('44444444-4444-4444-4444-444444444444', '{"username":"dave"}');
insert into public.friendships values ('44444444-4444-4444-4444-444444444444', :'bob', 'accepted'), ('44444444-4444-4444-4444-444444444444', :'carol', 'pending');
-- Bob: one round at the start of this week, one 8 days ago (in no period). Deleted at the end of this section.
insert into public.game_scores (user_id, mode, items, correct, xp, played_at, client_key) values
  (:'bob', 'mine', 2, 2, 20, public.period_start('week') + interval '1 second', 'j1-week'),
  (:'bob', 'mine', 2, 2, 50, now() - interval '8 days', 'j1-old');
-- On a Monday this week's first round is also today's. period_start is admin-only, so read it here.
select public.period_start('today') = public.period_start('week') as monday \gset
set role authenticated;

select pg_temp.ok((select xp = 0 and is_friend from public.board('today') where username = 'dave'), 'friend with no rounds listed at 0');
-- Week includes this week's round; today includes it only on a Monday. The 8-day-old round is in neither.
select pg_temp.ok((
  select w.xp - t.xp = case when :'monday' then 0 else 20 end and t.xp >= 30
  from public.board('week') w, public.board('today') t where w.username = 'bob' and t.username = 'bob'
), 'week vs today totals');

-- Search: substring, case-insensitive, 2+ characters, never yourself, status from your side.
select pg_temp.ok((select array_agg(username || ':' || status order by username) = '{alice:friends}' from public.find_players('ALI')), 'bob finds his friend');
select pg_temp.ok((select count(*) = 0 from public.find_players('b')), 'one letter finds nothing');
select pg_temp.ok((select count(*) = 0 from public.find_players('bob')), 'search skips yourself');
select pg_temp.ok((select count(*) = 0 from public.find_players('%%')), 'wildcards are plain text');
select set_config('request.jwt.claim.sub', :'carol', false);
select pg_temp.ok((select status = 'none' from public.find_players('alice')), 'carol finds friends-only alice');
select pg_temp.ok((select status = 'received' from public.find_players('dave')), 'carol sees dave asked her');
-- Carol can read Dave's profile because of the request, but not Alice's or Bob's.
select pg_temp.ok((select array_agg(username order by username) = '{dave,user_33333333}' from public.profiles), 'request makes the sender visible');
select pg_temp.refused(format($$insert into public.friendships (user_id, friend_id) values (%L, '44444444-4444-4444-4444-444444444444')$$, :'carol'), 'second request for the same pair');
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select pg_temp.ok((select status = 'sent' from public.find_players('user_3')), 'dave sees his request sent');

-- Alice goes public: on Carol's board and city leaderboard, and her profile is readable.
select set_config('request.jwt.claim.sub', :'alice', false);
update public.profiles set visibility = 'public', borough = 'plateau-mont-royal' where id = auth.uid();
select set_config('request.jwt.claim.sub', :'carol', false);
update public.profiles set borough = 'verdun' where id = auth.uid();
select pg_temp.ok((select array_agg(username || ':' || is_friend order by xp desc) = '{alice:false,user_33333333:false}' from public.board('today')), 'public player on a stranger board');
select pg_temp.ok((select array_agg(username order by xp_today desc) = '{alice,user_33333333}' from public.leaderboard('city')), 'public player on the city leaderboard');
select pg_temp.ok(exists (select 1 from public.profiles where username = 'alice'), 'public profile readable');

-- Private: Carol vanishes from search; Dave (private) vanishes from his friend Bob's board but Bob can still find him.
update public.profiles set visibility = 'private' where id = auth.uid();
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select pg_temp.ok((select count(*) = 0 from public.find_players('user_3')), 'private player hidden from search');
update public.profiles set visibility = 'private' where id = auth.uid();
select set_config('request.jwt.claim.sub', :'bob', false);
select pg_temp.ok(not exists (select 1 from public.board('today') where username = 'dave'), 'private friend off the board');
select pg_temp.ok((select status = 'friends' from public.find_players('dave')), 'private friend still found by friends');

-- Borough totals count everyone with a borough, private players too. Today: Verdun = Bob 30 (+20 on Mondays)
-- + private Carol 15; Plateau = Alice 135.
select pg_temp.ok((
  select array_agg(borough || ':' || players || ':' || active || ':' || is_mine order by borough)
       = '{plateau-mont-royal:1:1:false,verdun:2:2:true}' from public.borough_board('today')
), 'borough players and is_mine');
select pg_temp.ok((select xp = 135 from public.borough_board('today') where borough = 'plateau-mont-royal'), 'plateau total');
select pg_temp.ok((select xp - 45 = case when :'monday' then 20 else 0 end from public.borough_board('today') where borough = 'verdun'), 'verdun total today');
select pg_temp.ok((select xp = 65 from public.borough_board('week') where borough = 'verdun'), 'verdun total this week');

reset role;
delete from public.game_scores where client_key in ('j1-week', 'j1-old');
delete from auth.users where id = '44444444-4444-4444-4444-444444444444';
set role authenticated;
select set_config('request.jwt.claim.sub', :'bob', false);
-- ---------- end Social ----------

-- Things that must be refused.
select pg_temp.refused(format($$insert into public.scanned_items (user_id, name) values (%L, 'x')$$, :'alice'), 'bob writes a scan as alice');
select pg_temp.refused(format($$insert into public.game_scores (user_id, mode, items, correct, xp) values (%L, 'mine', 4, 4, 60)$$, :'alice'), 'bob writes a score as alice');
select pg_temp.refused($$insert into public.game_scores (mode, items, correct, xp) values ('mine', 4, 9, 60)$$, 'more correct than items');
select pg_temp.refused($$insert into public.game_scores (mode, items, correct, xp) values ('bogus', 4, 2, 30)$$, 'unknown round type');
select pg_temp.refused($$insert into public.game_scores (mode, items, correct, xp) values ('mine', 4, 4, 99999)$$, 'absurd xp');
select pg_temp.refused(format($$insert into public.friendships (user_id, friend_id) values (%L, %L)$$, :'carol', :'bob'), 'bob sends a request as carol');
select pg_temp.refused(format($$insert into public.friendships (user_id, friend_id, status) values (%L, %L, 'accepted')$$, :'bob', :'carol'), 'self-accept on insert');
select pg_temp.refused(format($$update public.friendships set user_id = %L$$, :'carol'), 'rewrite who a friendship is between');
update public.profiles set username = 'hacked' where id = :'alice';
select set_config('request.jwt.claim.sub', :'carol', false);
insert into public.friendships (user_id, friend_id) values (:'carol', :'alice');
update public.friendships set status = 'accepted' where user_id = auth.uid();

reset role;
select pg_temp.ok((select username = 'alice' from public.profiles where id = :'alice'), 'bob cannot rename alice');
select pg_temp.ok((select status = 'pending' from public.friendships where user_id = :'carol'), 'requester cannot accept own request');
select pg_temp.ok(not has_function_privilege('anon', 'public.leaderboard(text)', 'execute'), 'signed-out users cannot read the leaderboard');
select pg_temp.ok(not exists (
  select 1 from unnest(array['board(text)', 'borough_board(text)', 'find_players(text)', 'period_start(text)']) f
  where has_function_privilege('anon', 'public.' || f, 'execute')
), 'signed-out users cannot call the social functions');
select pg_temp.ok(not exists (
  select 1 from unnest(array['profiles', 'scanned_items', 'game_scores', 'friendships']) t
  where has_table_privilege('anon', 'public.' || t, 'select, insert, update, delete')
), 'signed-out users cannot touch any table');

-- Deleting an account removes everything that belongs to it.
delete from auth.users where id = :'alice';
select pg_temp.ok((select count(*) = 0 from public.scanned_items) and (select count(*) = 2 from public.game_scores), 'delete cascades');

\echo 'db tests ok'
