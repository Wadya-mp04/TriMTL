## What and why

<!-- One or two sentences. Link the issue or chat message if there is one. -->

## Checklist

- [ ] `cd server && npm run check` passes (paste the last lines below if anything was skipped)
- [ ] Contracts unchanged, or changed **additively only** (no field renamed or removed in `types.ts` / responses); `schemas.ts` and `docs/API.md` updated to match
- [ ] Bins still come only from the rules engine: no item→bin maps, `switch` on bins, or `includes("bottle")`-style logic added anywhere (server or mobile)
- [ ] If `types.ts`, `rulesEngine.ts` or `quebecRules.json` changed: `npm run sync-shared` run and `mobile/shared/` committed
- [ ] If rule data changed: `version` bumped, `sourceUrl` on montreal.ca, `verified: false` unless checked, test added
- [ ] Docs updated (file header, JSDoc on new exports, README / docs/ if behaviour changed)
- [ ] No secrets: no API key in code, commits, logs or `mobile/`; `.env` not committed

## How I tested it

<!-- Commands run, photos scanned, screens checked. -->
