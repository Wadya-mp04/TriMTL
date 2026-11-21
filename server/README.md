# TriMTL backend: plan and API contract (Juan + Waddah)

This is the `server/` half of the TriMTL plan: Node + Express, Gemini for recognition, and a verified
Québec rules file that decides every bin. **A working first version already exists in this folder**,
so the hours below are for testing, extending and hardening it, not starting from zero.

Who owns what:

| File | Owner | Job |
|---|---|---|
| `src/index.ts` | Juan | Express app, CORS, JSON limit, `/health`, error handler |
| `src/routes/scan.ts` | Juan | `POST /api/scan`: photo in, game pieces out |
| `src/services/gemini.ts` | Juan | Gemini call, prompt, JSON schema, Zod validation, timeout, retry |
| `src/data/quebecRules.json` | Waddah | Rules v4: 50 Montréal rules, 19 boroughs, dropoffs, links (see [docs/RULES.md](../docs/RULES.md)) |
| `src/services/rulesEngine.ts` | Waddah | Pure rules engine, the ONLY bin decider; bundled by the app for offline |
| `src/services/sortingRules.ts` | Waddah | Loads the rules file into the engine (server side) |
| `src/routes/classify.ts` | Waddah | `POST /api/classify`: the user corrects an item name |
| `src/services/scoring.ts`, `src/routes/score.ts` | Waddah | `POST /api/score`: answers in, score out of 100 |
| `src/services/sessions.ts` | Waddah | Keeps each scan so scoring checks real answers |
| `src/types.ts` | both | The contract. The app gets an identical copy in `mobile/shared/` via `npm run sync-shared` |

The one rule that makes this trustworthy: **Gemini only names objects and picks a `ruleId` from our
catalogue. It never chooses a bin.** The bin always comes from `quebecRules.json`. An object with no
matching rule comes back with `correctBin: null` and `needsVerification: true`. It is never guessed.

---

## 1. Run it (5 minutes)

```bash
cd server
npm install
cp .env.example .env        # paste GEMINI_API_KEY from aistudio.google.com -> Get API key
npm run dev                 # prints http://<your-LAN-IP>:3001 : that is the URL Expo Go uses
npm run check               # typecheck + rules validation + tests + docs lint + shared copies + secrets
```

Check it is alive: `curl http://localhost:3001/health` should return `{"ok":true,"hasKey":true,"rules":50,"rulesVersion":3,...}`.

Requires Node 20.6 or newer (for `--env-file`). `tsx` runs TypeScript directly, so there is no build step.

---

## 2. API contract

The full contract, with request/response examples and error codes, is in **[docs/API.md](../docs/API.md)**.
In short:

- `POST /api/scan` takes `{ imageBase64, mimeType, lang, borough?, hasBrownBin? }` and returns
  `ScanResponse { scanId, rulesVersion, checkedOn, context, total, isEstimate, items, subject, notWaste, message }`.
  The legacy `sessionId`, `totalCount` and `countIsEstimate` are still sent. Empty `items` is not an
  error: show `message` ("That's not something to sort (a cat)…" when `notWaste`, else "No items found…").
- `POST /api/classify` takes `{ name, lang, sessionId?, itemId? }` and returns `{ item }` (the user corrects a name).
- `POST /api/score` takes `{ sessionId, answers }` and returns a score out of 100.
- Errors: `{ "error": "<code>", "message": "…" }`. `rate_limited` 429, `timeout` 504, `ai_failed` 502, `no_key` 500, `bad_request` 400, `session_not_found` 404.
- Contract changes are **additive only**.

---

## 3. Decisions already made (raise objections now, not at hour 18)

1. **Four game bins: `recycling`, `compost`, `garbage`, `special`.** Our verified data has 7 destinations. This is how they map:

   | Verified destination | Game bin |
   |---|---|
   | Blue or green recycling bin | `recycling` |
   | Brown bin, plus yard waste | `compost` |
   | Garbage | `garbage` |
   | Écocentre | `special` + `dropoff: ecocentre` |
   | Deposit return (consigne) | `special` + `dropoff: deposit` |
   | Pharmacy, donation, tree, bulky or yard-waste collection | `special` + matching `dropoff` |

2. **Drink cans and plastic drink bottles (100 mL to 2 L) are `recycling` (since rules v7).** They also carry a 10¢ deposit, so `specialInstruction` says returning them is even better. (Before v7 they were `special` / `deposit`.)
3. **Since 2025, all packaging goes in recycling**: coffee cups, chip bags, granola bar wrappers, plastic film, foam food trays. Many people, judges included, believe otherwise. Expect "that's wrong!" moments in the demo and point to `sourceUrl`.
4. **Up to 8 objects per photo** (the plan said 1–5; 8 costs nothing). Identical objects are merged.
5. **Gemini never decides a bin.** If there's no rule, the item is unplayable, never guessed.
6. **Model: `gemini-3.1-flash-lite`.** It took 2–4 s per photo in testing. `gemini-3.5-flash` took 22 s and was no more accurate on the same pile.

---

## 4. Juan: hour-by-hour (Gemini API + Express)

**Hours 0–2: running and reachable**
- [ ] `npm install`, `.env`, `npm run dev`, `npm run check` all pass on your laptop.
- [ ] From a teammate's phone on the same Wi-Fi, open `http://<your-LAN-IP>:3001/health` in Safari or Chrome. If it doesn't load, the Wi-Fi isolates devices: see §6.
- [ ] Send Zayaan the base URL. Agree that `src/types.ts` is the contract; any change to it gets posted in the group chat.
- Done when the health check opens on a phone.

**Hours 2–6: real photos**
- [ ] Scan 10 real photos of 2–6 items each (water bottle, Red Bull can, chip bag, granola bar, apple sauce pouch, battery, coffee cup, banana peel, pizza box). Save the server log lines (`scan drink_can:high …`) into a `testing.md`.
- [ ] For every wrong detection, decide: prompt problem (fix `SYSTEM` in `gemini.ts`) or missing rule (tell Waddah). **Don't add bins to the prompt.**
- Done when 8 out of 10 photos list every visible item.

**Hours 6–10: hardening**
- [ ] Measure response time on mobile data. If it's over 5 s, ask Melik to resize to 1024 px.
- [ ] Simulate failures: wrong key (→ 502), no key (→ 500 `no_key`), a 1-pixel image, a 12 MB body (→ 413). The app must show a message for each.
- [ ] Optional: fall back to a second model on 429 (`gemini-flash-lite-latest`). Only add it if quota is hit in testing.

**Hours 10–18: deploy for the demo**
- [ ] Put the server on a public HTTPS URL so the demo doesn't depend on venue Wi-Fi. Use Render or Railway (free, Node supported), or keep it on the laptop behind `npx cloudflared tunnel --url http://localhost:3001`.
- [ ] Put `GEMINI_API_KEY` in the host's environment settings, never in the repo or the app.
- [ ] Change the app's base URL to the HTTPS one. Re-run `/health` from the presentation phone.

**Hours 18–24: freeze**
- [ ] No code changes after the freeze except fixes. Keep the server running and check `/health` every hour.
- [ ] Keep a second Gemini key from another teammate's account ready in case the first runs out of quota.

## 5. Waddah: hour-by-hour (rules, scoring, data)

**Hours 0–2: own the rules file**
- [ ] Read `src/data/quebecRules.json` and [docs/RULES.md](../docs/RULES.md). It has 50 items, each with `sourceUrl` on montreal.ca, checked 21 Nov 2026. Items with `"verified": false` (Christmas lights, wrapping paper) force a confirm step. Verify them if you can.
- [ ] Run `npm run check`. The server **refuses to start** if the JSON is malformed or uses an unknown icon. That's deliberate.

**Hours 2–6: cover the demo objects**
- [ ] Make sure every object the team will physically bring to the demo has a rule.
- [ ] To add an item, copy an existing entry and give it a new `id` (lowercase_with_underscores), a `category`, a `bin`, an `icon` from `icons`, `name`, `names` (both languages, lots of synonyms, brand names welcome), `explanation`, `sourceUrl`. Full steps: [docs/RULES.md](../docs/RULES.md#how-to-add-an-item).
- [ ] Add one line per new item to the "typed names" test in `src/tests/rules.test.ts`.
- [ ] Sources for new items: [recycling list](https://montreal.ca/articles/quoi-mettre-dans-le-bac-des-matieres-recyclables-83068), [brown bin](https://montreal.ca/articles/quoi-deposer-dans-le-bac-brun-44580), [garbage](https://montreal.ca/demarches/connaitre-les-modalites-de-la-collecte-des-ordures-menageres), [écocentres](https://montreal.ca/deposer-des-objets-lecocentre), [hazardous](https://montreal.ca/sujets/residus-domestiques-dangereux).

**Hours 6–10: scoring with the frontend**
- [ ] Walk Zayaan through `/api/score` with a real session. Confirm the Results screen uses `results[].correctBin`, `explanation` and `specialInstruction`.
- [ ] Confirm the edit flow: the user taps a wrong item, types a name, the app calls `/api/classify` with `sessionId` + `itemId`, and the corrected item is scored.

**Hours 10–18: progress (only if the core flow works)**
- [ ] The plan says XP and session history are stored **locally in the app first** (AsyncStorage). No server work is needed for that. Only build a Supabase table if the team wants a friends leaderboard. That is on the plan's cut list at hour 18.
- [ ] If the server restarts, sessions are lost (`session_not_found`). The app should then say "scan again". Supabase sessions are the upgrade path, not needed for the demo.

**Hours 18–24: verify the answers**
- [ ] For each demo object, open its `sourceUrl` and confirm the bin one last time. Be the person who can answer "why is a coffee cup recycling?" in the Q&A.

---

## 6. Networking with Expo Go (read this before hour 2)

- Expo Go only hosts the **app**. The phone must reach the **server** separately: `http://<laptop-LAN-IP>:3001`, with the phone and the laptop on the same Wi-Fi.
- Campus and event Wi-Fi often isolate devices. On a phone **hotspot**, the phone sharing the hotspot usually **can't** reach the laptop connected to it. This happened to us earlier. Use a second phone, or a tunnel (`npx cloudflared tunnel --url http://localhost:3001`), or deploy.
- For the demo, use HTTPS (§4, hours 10–18). Never rely on venue Wi-Fi.

## 7. What the frontend sends (for Melik and Zayaan)

```ts
// expo-image-picker: ask for base64 directly
const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.5, base64: true });
if (shot.canceled) return;
const asset = shot.assets[0];
const res = await fetch(`${API_URL}/api/scan`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ imageBase64: asset.base64, mimeType: asset.mimeType ?? "image/jpeg", lang: "fr" }),
});
const data = await res.json(); // ScanResponse, or ApiError when !res.ok
```

- Resize to about 1280 px wide before sending, using `expo-image-manipulator` (check the API for your Expo SDK version). A full-size iPhone photo works but uploads slowly on mobile data.
- Show a spinner straight away; a scan takes 2–5 s. Use a 25 s client timeout.
- Pieces with `correctBin: null` go in a "Needs verification" list and stay out of the game.
- Spread the items out on a table and take the photo from about 50 cm. Clutter and overlap cause missed items.

## 8. Known limits

- A closed opaque bag returns one unplayable item that says to empty it. The model can't see through plastic.
- Small objects behind bigger ones get missed. The prompt asks the model to look behind objects, but spreading items out works better.
- Rules vary slightly by borough: yard waste goes in the brown bin in 5 boroughs. Send `borough` (and `hasBrownBin`) in the scan request to get the borough's answer; without it the city-wide default applies.
- Free-tier quota is shared by everyone using the same key. One key ran out during a single day of testing on another project. Have a backup key.
