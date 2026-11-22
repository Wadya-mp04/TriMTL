-- Social: profile settings, boards by period, borough totals, player search (owner: Juan).
-- Runs after 20261121000400_challenge_mode.sql. Never decides a bin: borough and has_brown_bin are only the
-- context the rules engine reads, the same fields scanned_items already stores per scan.
--
-- visibility decides who sees you:
--   public  = anyone signed in: city board, search, your profile row
--   friends = your accepted friends only, plus search so people can still send you a request (default)
--   private = nobody but you: hidden from every board and from search (existing friends still find you)
-- Borough totals are sums, never names, so every player's XP counts for their borough whatever their visibility.

-- ---------- profile settings ----------
alter table public.profiles
  add column visibility text not null default 'friends' check (visibility in ('public', 'friends', 'private')),
  -- A slug from quebecRules.json -> boroughs; null = not set (city default). Only the format is checked here,
  -- so the 19 slugs stay listed in one place (ADR-3). The app ignores a slug it doesn't know.
  add column borough text check (char_length(borough) <= 60 and borough ~ '^[a-z]+(-[a-z]+)*$'),
  add column has_brown_bin boolean not null default true;
grant update (visibility, borough, has_brown_bin) on public.profiles to authenticated;

-- Profile rows used to be readable by every signed-in user; now visibility decides. Anyone who shares a
-- friendship row with you (pending or accepted) can read yours, so a request shows who sent it.
drop policy "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or visibility = 'public'
  or exists (
    select 1 from public.friendships f
    where (f.user_id = (select auth.uid()) and f.friend_id = profiles.id)
       or (f.friend_id = (select auth.uid()) and f.user_id = profiles.id)
  )
);

-- ---------- friendships: one row per pair ----------
-- Without this, A->B and B->A can both be pending and the Friends screen can't tell which to accept.
-- If this fails on an existing project, a pair has rows both ways: delete one, then rerun.
create unique index friendships_pair on public.friendships (least(user_id, friend_id), greatest(user_id, friend_id));
create index friendships_friend on public.friendships (friend_id, user_id);  -- "requests sent to me"
create index game_scores_played on public.game_scores (played_at);            -- boards read one period

-- ---------- periods, in Montréal time ----------
-- 'today' starts at midnight, 'week' on Monday at midnight, both in America/Montreal (not the server's UTC).
create function public.period_start(period text) returns timestamptz
language plpgsql stable set search_path = '' as $$
begin
  if period is null or period not in ('today', 'week') then
    raise exception 'period must be today or week, got %', period using errcode = 'invalid_parameter_value';
  end if;
  return date_trunc(case period when 'today' then 'day' else 'week' end, now() at time zone 'America/Montreal')
         at time zone 'America/Montreal';
end $$;
revoke execute on function public.period_start(text) from public, anon;

-- ---------- board(period): one list of players ----------
-- You, your friends (even at 0 XP, unless they're private) and the top 50 public players who scored in the
-- period. Sorted by XP; is_friend lets the app put friends on top. security definer: game_scores rows are
-- private, so only username + total leave the database.
create function public.board(period text)
returns table (username text, xp int, is_me boolean, is_friend boolean)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id),
  totals as (
    select g.user_id, sum(g.xp)::int as xp
    from public.game_scores g
    where g.played_at >= public.period_start(period)
    group by g.user_id
  ),
  friends as (
    select case when f.user_id = me.id then f.friend_id else f.user_id end as id
    from public.friendships f, me
    where f.status = 'accepted' and me.id in (f.user_id, f.friend_id)
  ),
  visible as (
    select p.username, coalesce(t.xp, 0) as xp, p.id = me.id as is_me,
           p.id in (select id from friends) as is_friend
    from public.profiles p cross join me left join totals t on t.user_id = p.id
    where p.id = me.id
       or (p.id in (select id from friends) and p.visibility <> 'private')
       or (p.visibility = 'public' and t.xp > 0)
  )
  (select username, xp, is_me, is_friend from visible where is_me or is_friend)
  union all
  (select username, xp, false, false from visible where not is_me and not is_friend order by xp desc, username limit 50)
  order by 2 desc, 1;
$$;
revoke execute on function public.board(text) from public, anon;
grant execute on function public.board(text) to authenticated;

-- The old leaderboard keeps its shape (ADR-5) but now reads board(), so it respects visibility too:
-- 'friends' = you + visible friends, 'city' = everyone on your board who scored today, plus you.
create or replace function public.leaderboard(scope text default 'city')
returns table (username text, xp_today int, is_me boolean)
language sql stable security definer set search_path = '' as $$
  select b.username, b.xp, b.is_me
  from public.board('today') b
  where case scope when 'friends' then b.is_me or b.is_friend else b.xp > 0 or b.is_me end
  order by 2 desc, 1
  limit 20;
$$;

-- ---------- borough_board(period): real totals per borough ----------
-- Every player with a borough set counts for it; XP follows the player's current borough (scores don't
-- store one). players = who lives there, active = who scored in the period. Boroughs with no players are
-- left out; the app lists all 19 from the rules and shows 0 for the missing ones.
create function public.borough_board(period text)
returns table (borough text, xp int, players int, active int, is_mine boolean)
language sql stable security definer set search_path = '' as $$
  select p.borough, coalesce(sum(t.xp), 0)::int, count(*)::int, count(t.user_id)::int,
         coalesce(bool_or(p.id = auth.uid()), false)
  from public.profiles p
  left join (
    select g.user_id, sum(g.xp) as xp
    from public.game_scores g
    where g.played_at >= public.period_start(period)
    group by g.user_id
  ) t on t.user_id = p.id
  where p.borough is not null
  group by p.borough
  order by 2 desc, 1;
$$;
revoke execute on function public.borough_board(text) from public, anon;
grant execute on function public.borough_board(text) to authenticated;

-- ---------- find_players(q): search to send a friend request ----------
-- Case-insensitive substring match on username, at least 2 characters, 20 results, best match first.
-- Skips you and private players (unless already your friend). status is from your side:
-- 'none' | 'sent' (you asked) | 'received' (they asked you) | 'friends'.
-- id is returned because sending a request needs it (insert into friendships (user_id, friend_id)).
create function public.find_players(q text)
returns table (id uuid, username text, status text)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id),
  needle as (select lower(btrim(coalesce(q, ''))) as s)
  select p.id, p.username,
         case when f.status = 'accepted' then 'friends'
              when f.user_id = me.id then 'sent'
              when f.user_id is not null then 'received'
              else 'none' end
  from public.profiles p cross join me cross join needle n
  left join public.friendships f
    on least(f.user_id, f.friend_id) = least(me.id, p.id) and greatest(f.user_id, f.friend_id) = greatest(me.id, p.id)
  where char_length(n.s) >= 2
    and p.id <> me.id
    and strpos(lower(p.username), n.s) > 0  -- strpos, not LIKE: '%' and '_' in q are plain characters
    and (p.visibility <> 'private' or f.status = 'accepted')
  order by strpos(lower(p.username), n.s), char_length(p.username), p.username
  limit 20;
$$;
revoke execute on function public.find_players(text) from public, anon;
grant execute on function public.find_players(text) to authenticated;
