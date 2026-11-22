# Plan: Sat 20:00 → demo Sun 14:00 (Waddah + Juan)

Agreed on Sat 21 Nov. Melik and Zayaan keep their own UI and game work.
Split by files so we never edit the same file: no merge conflicts.

## What we're building

- **Friends:** search a username, send a request, accept/decline, list, remove.
- **Privacy:** each player picks `public`, `friends` (default) or `private`.
  `private` hides scores from every leaderboard, but the username can still be found to add as a friend.
- **Leaderboard:** one list, friends on top, everyone else below; Today (default) or This week
  (week starts Monday, Montréal time). Demo list when fewer than 3 players.
- **Borough board:** real totals. Everyone's points count, private players too, but only totals are
  shown, never names.
- **Brown bin / borough:** changing it re-sorts everything at once (saved items, game, demo items, tip),
  and the setting is saved to the account.
- **Demo extras:** Impact card on the profile, FR/EN switch for scan and rule text.

## Contract (agree before coding)

| Name | Shape | Owner |
|---|---|---|
| `profiles.visibility` | `'public' \| 'friends' \| 'private'`, default `'friends'` | Juan |
| `profiles.borough`, `profiles.has_brown_bin` | slug or null; boolean, default true | Juan |
| `board(period text)` | returns `(username, xp, is_me, is_friend)`, friends first | Juan |
| `borough_board(period text)` | returns `(borough, points)` | Juan |
| `find_players(q text)` | returns `(id, username, friendship_status)` | Juan |

`period` is `'today'` or `'week'`. New SQL goes in a new file in `supabase/migrations/` (never edit one
that has already run) and gets tests in `supabase/tests/db_test.sql` (`supabase/tests/run.sh`, needs Docker).

## Waddah: rules, app state, profile

| # | Task | Files |
|---|---|---|
| W2 | Live re-sort on brown-bin/borough change; load saved scans on sign-in | `AppState.tsx`, `items.ts`, `rules.ts` |
| W3 | Save area + visibility to the account; visibility picker (needs J1) | `profile.tsx`, `AreaSheet.tsx` |
| W4 | Impact card ("You kept 23 items out of the landfill") | `profile.tsx` |
| W5 | FR/EN switch for scan and rule text | `AppState.tsx`, `api/scan.ts` |
| W6 | Seed 3–4 demo accounts; check every demo object against its `sourceUrl` | Supabase, data |

## Juan: database, social, Community, Gemini

| # | Task | Files |
|---|---|---|
| J1 | One migration + tests: profile settings, `board`, `borough_board`, `find_players` | `supabase/migrations/…_social.sql` |
| J2 | Friends screen | new `mobile/src/app/friends.tsx` |
| J3 | Community: Players = friends on top + Today/Week; Boroughs = real totals | `community.tsx` |
| J4 | Photo tests against rules v7, prompt fixes; report missing rules to Waddah | `server/src/services/gemini.ts` |

## Timeline

| When | Waddah | Juan | Handoff |
|---|---|---|---|
| Sat 20:00–22:00 | W2 | J1 | Juan merges J1 by 22:00 |
| 22:00–00:30 | W3, then W4 | J2, then J3 | |
| 00:30–08:00 | Sleep in shifts | | |
| Sun 08:00–10:00 | W5, then W6 | J4 | Missing rules go to Waddah: add, then `npm run sync-shared` + `npm run check` |
| 10:00 | **Freeze**: fixes only, test end to end on the demo phone | | |
| 12:00–14:00 | Rehearse | Rehearse | |

**Cut first if late:** W5, then W4, then the Week switch.

**Risk:** the server runs on a laptop over a phone hotspot. Before the freeze, test a tunnel
(`npx cloudflared tunnel --url http://localhost:3001`) in case the venue network blocks it.
