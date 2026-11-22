-- Allow "challenge" rounds (owner: Waddah). The Play screen now has "Your items" rounds (mode 'mine')
-- and "Challenge" rounds of items you never scanned. Never relabel one as the other: stats split by mode.
alter table public.game_scores drop constraint game_scores_mode_check;
alter table public.game_scores add constraint game_scores_mode_check check (mode in ('daily', 'mine', 'challenge'));
