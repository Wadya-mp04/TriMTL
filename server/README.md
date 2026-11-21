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
| `src/data/quebecRules.json` | Waddah | The 49 verified Montréal rules (bin, icon, text, source) |
| `src/services/sortingRules.ts` | Waddah | Loads and validates the rules file, text lookup, rule to game piece |
| `src/routes/classify.ts` | Waddah | `POST /api/classify`: the user corrects an item name |
| `src/services/scoring.ts`, `src/routes/score.ts` | Waddah | `POST /api/score`: answers in, score out of 100 |
| `src/services/sessions.ts` | Waddah | Keeps each scan so scoring checks real answers |
| `src/types.ts` | both | The contract. Melik and Zayaan copy it into `mobile/services/api.ts` |

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
npm test                    # 7 tests, must stay green
npm run typecheck
```

Check it is alive: `curl http://localhost:3001/health` should return `{"ok":true,"hasKey":true,"rules":49,...}`.

Requires Node 20.6 or newer (for `--env-file`). `tsx` runs TypeScript directly, so there is no build step.

---

## 2. API contract

All bodies are JSON. Every error has this shape: `{ "error": "<code>", "message": "<human text>" }`.

### `POST /api/scan`: a photo becomes game pieces

Request:

```json
{ "imageBase64": "<base64, with or without a data: prefix>", "mimeType": "image/jpeg", "lang": "fr" }
```

`mimeType` is one of `image/jpeg`, `image/png`, `image/webp` or `image/heic` (default `image/jpeg`). `lang` is `fr` or `en` (default `fr`).

Response 200. This is a real response to a photo of a sink full of recyclables, trimmed:

```json
{
  "sessionId": "74028c3d-…",
  "totalCount": 12,
  "countIsEstimate": false,
  "items": [
    {
      "id": "item-1",
      "ruleId": "drink_can",
      "name": "Canettes de bière et de boisson gazeuse",
      "kind": "Canette en aluminium",
      "count": 7,
      "icon": "can",
      "confidence": "high",
      "correctBin": "special",
      "dropoff": "deposit",
      "explanation": "Les canettes de boisson en aluminium vont à la consigne.",
      "specialInstruction": "Rapportez-la pour récupérer votre dépôt.",
      "needsVerification": false,
      "sourceUrl": "https://montreal.ca/articles/quoi-mettre-dans-le-bac-des-matieres-recyclables-83068",
      "mapsUrl": "https://www.google.com/maps/search/?api=1&query=retour%20de%20la%20consigne%20Montr%C3%A9al"
    },
    {
      "id": "item-4",
      "ruleId": "chip_bag",
      "name": "Sac de chips",
      "kind": "Emballage souple multicouche",
      "count": 2,
      "icon": "wrapper",
      "confidence": "high",
      "correctBin": "recycling",
      "dropoff": null,
      "explanation": "Tous les emballages vont maintenant dans le bac de récupération.",
      "specialInstruction": null,
      "needsVerification": false,
      "sourceUrl": "https://montreal.ca/demarches/connaitre-les-modalites-de-la-collecte-des-ordures-menageres",
      "mapsUrl": null
    }
  ]
}
```

Field rules the frontend can rely on:

| Field | Meaning |
|---|---|
| `correctBin` | `recycling`, `compost`, `garbage` or `special`. **`null` = not playable**: list it under "Needs verification", leave it out of the game. |
| `needsVerification` | `true` = show a confirm or edit step before the game (low confidence, unverified rule, or no rule). |
| `confidence` | `high` (≥ 0.8), `medium` (≥ 0.5), `low`. |
| `dropoff` | For `special` and a few others: `ecocentre`, `deposit`, `pharmacy`, `donation`, `tree_collection`, `bulky_collection`. |
| `icon` | Always one of the 43 names in `quebecRules.json` → `icons`; unmatched objects get `generic`. Melik maps each name to an asset in `mobile/assets/icons/`. |
| `count` | Identical objects are merged ("7 canettes" = one game piece with `count: 7`). |
| `kind` | What the object physically is, material included ("Canette en aluminium", "Sachet souple en plastique"). Show it under the name. |
| `totalCount` | Every object in the photo, merged counts included. Exact below 20. |
| `countIsEstimate` | `true` with 20 or more objects: display "environ 25 objets" / "about 25 items". Only up to 8 game pieces are returned even then. |
| Empty `items` | Nothing to sort was found. Show "No items found, try again" (not an error). |

Errors:

| HTTP | `error` | When | What the app shows |
|---|---|---|---|
| 400 | `bad_request` | No or short image, bad JSON | "Couldn't read that photo" plus retake |
| 413/400 | `bad_request` | Image over 10 MB | Resize to 1280 px before sending (see §5) |
| 429 | `rate_limited` | Gemini free-tier quota | "Busy, try again in a minute" plus a typed-name fallback |
| 504 | `timeout` | Gemini took more than 20 s | Retake or retry button |
| 502 | `ai_failed` | Gemini error or bad JSON twice | Retry button |
| 500 | `no_key` | `GEMINI_API_KEY` missing on the server | (dev only) |

### `POST /api/classify`: the user corrects a name

```json
{ "name": "pile AA", "lang": "fr", "sessionId": "74028c3d-…", "itemId": "item-3" }
```

Returns `{ "item": <ScanItem> }`. With both `sessionId` and `itemId` set, it **replaces that item in
the session**, so scoring uses the corrected answer. An unknown name still returns 200 with
`correctBin: null`. It returns 404 `session_not_found` if the server restarted.

### `POST /api/score`: answers become a score out of 100

```json
{ "sessionId": "74028c3d-…", "answers": [ { "itemId": "item-1", "chosenBin": "special" } ] }
```

Response:

```json
{ "sessionId": "…", "score": 34, "correct": 1, "total": 3,
  "results": [ { "itemId": "item-1", "name": "…", "chosenBin": "special", "correctBin": "special",
                 "isCorrect": true, "points": 34, "explanation": "…", "specialInstruction": "…" } ],
  "unplayable": ["item-4"] }
```

- Each playable item is worth an equal share, and the shares always add up to 100 (3 items = 34 + 33 + 33).
- Unanswered items count as wrong.
- `results` is the "real-world sorting guide" for the Results screen.

### `GET /health`

`{ ok, model, hasKey, rules, rulesCheckedOn }`. Check it from the presentation phone before the demo.

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
   | Pharmacy, donation, tree or bulky collection | `special` + matching `dropoff` |

2. **Drink cans and plastic drink bottles (100 mL to 2 L) are `special` / `deposit`, not `recycling`.** Montréal's own page says they "doivent aller à la consigne". The ChatGPT plan's example put a water bottle in `recycling`, which is wrong for Montréal. A judge who drops a can in Recycling gets it wrong and learns about the deposit. That is the point of the game.
3. **Since 2025, all packaging goes in recycling**: coffee cups, chip bags, granola bar wrappers, plastic film, foam food trays. Many people, judges included, believe otherwise. Expect "that's wrong!" moments in the demo and point to `sourceUrl`.
4. **Up to 8 objects per photo** (the plan said 1–5; 8 costs nothing). Identical objects are merged.
5. **Gemini never decides a bin.** If there's no rule, the item is unplayable, never guessed.
6. **Model: `gemini-3.1-flash-lite`.** It took 2–4 s per photo in testing. `gemini-3.5-flash` took 22 s and was no more accurate on the same pile.

---

## 4. Juan: hour-by-hour (Gemini API + Express)

**Hours 0–2: running and reachable**
- [ ] `npm install`, `.env`, `npm run dev`, `npm test` all pass on your laptop.
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
- [ ] Read `src/data/quebecRules.json`. It has 49 items, each with `sourceUrl` on montreal.ca, checked 21 Nov 2026. Items with `"verified": false` (Christmas lights, wrapping paper) force a confirm step. Verify them if you can.
- [ ] Run `npm test`. The server **refuses to start** if the JSON is malformed or uses an unknown icon. That's deliberate.

**Hours 2–6: cover the demo objects**
- [ ] Make sure every object the team will physically bring to the demo has a rule.
- [ ] To add an item, copy an existing entry and give it a new `id` (lowercase_with_underscores), a `bin`, an `icon` from `icons`, `name`, `names` (both languages, lots of synonyms, brand names welcome), `explanation`, `sourceUrl`.
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
- Rules vary slightly by borough: yard waste goes in the brown bin in 5 boroughs. The game uses the island-wide rule. The verified web version, `tri-montreal.vercel.app`, has the borough detail if a judge asks.
- Free-tier quota is shared by everyone using the same key. One key ran out during a single day of testing on another project. Have a backup key.
