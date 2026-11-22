-- Safe retries (owner: Waddah). When the network drops after a save reached the database but before the
-- reply reached the phone, the app retries; a client_key per row lets the database ignore the second copy
-- (ON CONFLICT DO NOTHING) instead of counting a round or a scan twice. Never reuse a key for new data.
alter table public.scanned_items add column client_key text check (char_length(client_key) <= 120);
alter table public.game_scores add column client_key text check (char_length(client_key) <= 120);
-- Unique per user; rows saved before this migration have no key (nulls never conflict).
create unique index scanned_items_client_key on public.scanned_items (user_id, client_key);
create unique index game_scores_client_key on public.game_scores (user_id, client_key);
