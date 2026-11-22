-- Boards rank the daily challenge (owner: Juan). Runs after 20261121000600_social_contract.sql.
-- Each player's FIRST 'daily' round per Montréal day counts, scored 0–100 (correct × 100 / items).
-- Today = today's score; This week = the sum of daily scores since Monday (max 700). Practice rounds
-- ('mine', 'challenge') never count, and a second daily round on the same day is ignored, so playing more
-- can't climb the board. Return columns are unchanged (`xp`, `points`), so the app needs no change.

-- Daily points per player for a period. Admin-only helper, called by the boards below.
create function public.daily_points(period text)
returns table (user_id uuid, xp int)
language sql stable security definer set search_path = '' as $$
  select d.user_id, sum(d.score)::int
  from (
    select distinct on (g.user_id, (g.played_at at time zone 'America/Montreal')::date)
           g.user_id, round(g.correct * 100.0 / greatest(g.items, 1))::int as score
    from public.game_scores g
    where g.mode = 'daily' and g.played_at >= public.period_start(period)
    order by g.user_id, (g.played_at at time zone 'America/Montreal')::date, g.played_at
  ) d
  group by d.user_id;
$$;
revoke execute on function public.daily_points(text) from public, anon;

-- Same board as 20261121000600, with `totals` from daily_points. A public stranger is listed once they've
-- played the period's challenge (even with 0), not only when they scored.
create or replace function public.board(period text)
returns table (username text, xp int, is_me boolean, is_friend boolean)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id),
  totals as (select * from public.daily_points(period)),
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
       or (p.visibility = 'public' and t.user_id is not null)
  )
  select * from (
    (select username, xp, is_me, is_friend from visible where is_me or is_friend)
    union all
    (select username, xp, false, false from visible where not is_me and not is_friend order by xp desc, username limit 50)
  ) b
  order by (b.is_me or b.is_friend) desc, b.xp desc, b.username;
$$;

-- Borough points = the AVERAGE daily points of its players who played in the period (0 if nobody did), so a
-- borough with more players doesn't win just by numbers. Everyone with a borough counts, private players too.
create or replace function public.borough_board(period text)
returns table (borough text, points int, players int, active int, is_mine boolean)
language sql stable security definer set search_path = '' as $$
  select p.borough, coalesce(round(avg(t.xp)), 0)::int, count(*)::int, count(t.user_id)::int,
         coalesce(bool_or(p.id = auth.uid()), false)
  from public.profiles p
  left join public.daily_points(period) t on t.user_id = p.id
  where p.borough is not null
  group by p.borough
  order by 2 desc, 1;
$$;
