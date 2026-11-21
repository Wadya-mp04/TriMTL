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
exception when insufficient_privilege or check_violation or unique_violation then null;
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

-- Bob plays once and accepts Alice's request; Carol plays once and has no friends.
select set_config('request.jwt.claim.sub', :'bob', false);
insert into public.game_scores (mode, items, correct, xp) values ('daily', 4, 2, 30);
select pg_temp.ok((select count(*) = 0 from public.scanned_items), 'bob cannot see alice scans');
select pg_temp.ok((select count(*) = 1 from public.game_scores), 'bob sees only his own scores');
select pg_temp.ok((select xp = 30 from public.player_stats), 'bob scoreboard is his own');
select pg_temp.ok((select count(*) = 0 from public.category_stats), 'bob cannot see alice analytics');
update public.friendships set status = 'accepted' where friend_id = auth.uid();
select pg_temp.ok((select status = 'accepted' from public.friendships), 'bob accepts');

select set_config('request.jwt.claim.sub', :'carol', false);
insert into public.game_scores (mode, items, correct, xp) values ('mine', 2, 1, 15);

-- Leaderboard: friends = me + accepted friends; city = everyone who played today.
select pg_temp.ok((select array_agg(username order by xp_today desc) = '{user_33333333}' from public.leaderboard('friends')), 'carol friends board is just her');
select pg_temp.ok((select array_agg(username order by xp_today desc) = '{alice,bob,user_33333333}' from public.leaderboard('city')), 'city board order');
select pg_temp.ok((select is_me from public.leaderboard('city') where username = 'user_33333333'), 'is_me flag');
select set_config('request.jwt.claim.sub', :'bob', false);
select pg_temp.ok((select array_agg(username order by xp_today desc) = '{alice,bob}' from public.leaderboard('friends')), 'bob friends board');
select pg_temp.ok((select xp_today = 105 from public.leaderboard('friends') where username = 'alice'), 'today xp summed');

-- Things that must be refused.
select pg_temp.refused(format($$insert into public.scanned_items (user_id, name) values (%L, 'x')$$, :'alice'), 'bob writes a scan as alice');
select pg_temp.refused(format($$insert into public.game_scores (user_id, mode, items, correct, xp) values (%L, 'mine', 4, 4, 60)$$, :'alice'), 'bob writes a score as alice');
select pg_temp.refused($$insert into public.game_scores (mode, items, correct, xp) values ('mine', 4, 9, 60)$$, 'more correct than items');
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
  select 1 from unnest(array['profiles', 'scanned_items', 'game_scores', 'friendships']) t
  where has_table_privilege('anon', 'public.' || t, 'select, insert, update, delete')
), 'signed-out users cannot touch any table');

-- Deleting an account removes everything that belongs to it.
delete from auth.users where id = :'alice';
select pg_temp.ok((select count(*) = 0 from public.scanned_items) and (select count(*) = 2 from public.game_scores), 'delete cascades');

\echo 'db tests ok'
