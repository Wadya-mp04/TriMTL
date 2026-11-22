-- Leaderboard, scoreboard and analytics scaffolding (owner: Waddah). Runs after 20261121000000_init.sql.
-- Never decides a bin: only sums scores the game already recorded.

-- Today's XP per player, today counted in Montréal time (not the server's UTC day).
-- security definer: game_scores rows are private (RLS), so totals are computed here and only
-- username + total leave the database, never individual rounds.
create function public.leaderboard(scope text default 'city')
returns table (username text, xp_today int, is_me boolean)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id),
  today as (
    select g.user_id, sum(g.xp)::int as xp
    from public.game_scores g
    where g.played_at >= (date_trunc('day', now() at time zone 'America/Montreal') at time zone 'America/Montreal')
    group by g.user_id
  ),
  circle as (  -- me + accepted friends
    select id from me
    union
    select case when f.user_id = me.id then f.friend_id else f.user_id end
    from public.friendships f, me
    where f.status = 'accepted' and me.id in (f.user_id, f.friend_id)
  )
  select p.username, coalesce(t.xp, 0), p.id = me.id
  from public.profiles p cross join me left join today t on t.user_id = p.id
  where case scope
    when 'friends' then p.id in (select id from circle)
    else t.xp > 0 or p.id = me.id
  end
  order by 2 desc, 1
  limit 20;
$$;
revoke execute on function public.leaderboard(text) from public, anon;
grant execute on function public.leaderboard(text) to authenticated;

-- Scoreboard: one row of totals per player. security_invoker keeps RLS, so you only see your own.
create view public.player_stats with (security_invoker = true) as
  select user_id, count(*)::int as games, sum(items)::int as answered, sum(correct)::int as correct, sum(xp)::int as xp
  from public.game_scores
  group by user_id;
grant select on public.player_stats to authenticated;

-- Analytics scaffolding (future feature, no screen reads it yet): what each player scans, by category.
create view public.category_stats with (security_invoker = true) as
  select user_id, coalesce(category, 'unknown') as category, count(*)::int as scans, sum(count)::int as items
  from public.scanned_items
  group by user_id, coalesce(category, 'unknown');
grant select on public.category_stats to authenticated;
