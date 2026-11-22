-- Social, matched to the contract in docs/PLAN.md (owner: Juan). Runs after 20261121000500_social.sql,
-- which shipped three differences from what the team agreed; nothing in the app called these yet.
--   board          -> friends (and you) first, then everyone else, each part by XP
--   borough_board  -> the total is called points, as agreed (players, active, is_mine stay as extras)
--   find_players   -> the column is called friendship_status, and private players can be found:
--                     "private" hides scores from every board, never the username from search

-- Same columns as before, so create or replace keeps the grants.
create or replace function public.board(period text)
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
  select * from (
    (select username, xp, is_me, is_friend from visible where is_me or is_friend)
    union all
    (select username, xp, false, false from visible where not is_me and not is_friend order by xp desc, username limit 50)
  ) b
  order by (b.is_me or b.is_friend) desc, b.xp desc, b.username;
$$;

-- Output columns change, so these two are dropped and recreated (and re-granted).
drop function public.borough_board(text);
create function public.borough_board(period text)
returns table (borough text, points int, players int, active int, is_mine boolean)
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

-- friendship_status: 'none' | 'sent' (you asked) | 'received' (they asked you) | 'friends'.
drop function public.find_players(text);
create function public.find_players(q text)
returns table (id uuid, username text, friendship_status text)
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
  order by strpos(lower(p.username), n.s), char_length(p.username), p.username
  limit 20;
$$;
revoke execute on function public.find_players(text) from public, anon;
grant execute on function public.find_players(text) to authenticated;
