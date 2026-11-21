# TriMTL API

Base URL: `http://<laptop-LAN-IP>:3001` in development, the HTTPS deploy URL for the demo.
All bodies are JSON. The TypeScript contract is [`server/src/types.ts`](../server/src/types.ts); its
runtime mirror, used by the tests, is [`server/src/schemas.ts`](../server/src/schemas.ts).

- [POST /api/scan](#post-apiscan): a photo becomes game pieces
- [POST /api/classify](#post-apiclassify): the user corrects an item's name
- [POST /api/score](#post-apiscore): answers become a score out of 100
- [GET /health](#get-health)
- [Gemini → server](#gemini--server-internal) (internal)
- [Errors](#errors)
- [Contract changes](#contract-changes)

---

## POST /api/scan

### Request: `ScanRequest`

```json
{
  "imageBase64": "<base64, with or without a data: prefix>",
  "mimeType": "image/jpeg",
  "lang": "en",
  "borough": "plateau-mont-royal",
  "hasBrownBin": false
}
```

| Field | Type | Default | Rule |
|---|---|---|---|
| `imageBase64` | string | required | 100 to 10,000,000 characters (about 7.5 MB of image). Resize to about 1280 px first. |
| `mimeType` | `image/jpeg` \| `image/png` \| `image/webp` \| `image/heic` | `image/jpeg` | |
| `lang` | `fr` \| `en` | `fr` | Language of every text field in the response. |
| `borough` | one of the 19 slugs in `quebecRules.json` → `boroughs`, or `null` | `null` | `null` means the city-wide default. Use it for "Other" and for independent municipalities (Westmount, Côte-Saint-Luc, Pointe-Claire…), which are not boroughs. An unknown slug returns 400, so typos can't silently fall back to the default. |
| `hasBrownBin` | boolean | `true` | Many apartment buildings have no brown bin. |

### Response 200: `ScanResponse`

This is the canonical example, [`server/src/tests/fixtures/scanResponse.example.json`](../server/src/tests/fixtures/scanResponse.example.json). A test checks that it validates against the schema and matches the engine's real output.

```json
{
  "scanId": "demo-001",
  "rulesVersion": 3,
  "checkedOn": "2026-11-21",
  "context": { "lang": "en", "borough": "plateau-mont-royal", "hasBrownBin": false },
  "total": 3,
  "isEstimate": false,
  "items": [
    {
      "id": "item-1",
      "ruleId": "drink_bottle",
      "category": "drink_container",
      "name": "Plastic water bottle",
      "kind": "PET plastic bottle",
      "count": 1,
      "icon": "bottle",
      "confidence": "high",
      "correctBin": "special",
      "dropoff": "deposit",
      "dropoffName": "Deposit return",
      "explanation": "Drink containers from 100 ml to 2 L go back for the deposit.",
      "specialInstruction": "Bring it back to get your deposit.",
      "links": [],
      "mapsUrl": "https://www.google.com/maps/search/?api=1&query=deposit%20return%20Montr%C3%A9al",
      "needsVerification": false,
      "contextApplied": false,
      "sourceUrl": "https://montreal.ca/articles/quoi-mettre-dans-le-bac-des-matieres-recyclables-83068"
    },
    {
      "id": "item-2",
      "ruleId": "battery",
      "category": "battery",
      "name": "Household battery",
      "kind": "Alkaline AA battery",
      "count": 1,
      "icon": "battery",
      "confidence": "high",
      "correctBin": "special",
      "dropoff": "ecocentre",
      "dropoffName": "Écocentre",
      "explanation": "Batteries never go in the garbage or the recycling.",
      "specialInstruction": "Cover the terminals of lithium batteries with tape.",
      "links": [
        { "label": "City battery drop-off points", "url": "https://montreal.ca/lieux?mtl_content.lieux.tags.code=PR004" },
        { "label": "Official list of écocentres", "url": "https://montreal.ca/lieux?mtl_content.lieux.type.code=ECOC&orderBy=dc_title" }
      ],
      "mapsUrl": "https://www.google.com/maps/search/?api=1&query=battery%20drop-off%20Montr%C3%A9al",
      "needsVerification": false,
      "contextApplied": false,
      "sourceUrl": "https://montreal.ca/services/recuperation-des-piles-usagees"
    },
    {
      "id": "item-3",
      "ruleId": "food_scraps",
      "category": "food",
      "name": "Banana peel",
      "kind": "Food scrap",
      "count": 1,
      "icon": "food",
      "confidence": "high",
      "correctBin": "garbage",
      "dropoff": null,
      "dropoffName": null,
      "explanation": "Without a brown bin, food waste goes in the garbage.",
      "specialInstruction": null,
      "links": [{ "label": "Collection day (Info-collectes)", "url": "https://montreal.ca/services/horaire-des-collectes" }],
      "mapsUrl": null,
      "needsVerification": true,
      "contextApplied": true,
      "sourceUrl": "https://montreal.ca/articles/quoi-deposer-dans-le-bac-brun-44580"
    }
  ]
}
```

The live server also sends three **legacy fields** with the same values: `sessionId` (= `scanId`),
`totalCount` (= `total`) and `countIsEstimate` (= `isEstimate`). They exist because contract changes are
additive only, and `/api/score` and `/api/classify` still take `sessionId`. New code should read the new names.

### Top-level fields

| Field | Meaning |
|---|---|
| `scanId` | Id of this scan's server session. Pass it as `sessionId` to `/api/score` and `/api/classify`. |
| `rulesVersion` | `version` from `quebecRules.json`. If it is higher than the app's bundled copy, the offline answers are stale: run `npm run sync-shared` and rebuild. |
| `checkedOn` | Date the rules were last checked on montreal.ca. |
| `context` | The context the answers were computed for, defaults filled in (`borough: null`, `hasBrownBin: true`). Show it ("Answers for Le Plateau, no brown bin"). |
| `total` | Every object in the photo, merged counts included. Exact below 20. |
| `isEstimate` | `true` at 20 or more objects: show "about 25 items". At most 8 game pieces are returned. |
| `items` | Game pieces. An empty list means nothing to sort was found: show "No items found, try again" (not an error). |

### `ScanItem` fields

Every bin-related field comes from the rules engine, never from Gemini.

| Field | Meaning |
|---|---|
| `id` | `item-1`, `item-2`… unique within the scan. |
| `ruleId` | Matched rule, or `null` when no rule matched. |
| `category` | The rule's category. When no rule matched, Gemini's category, for display only. **Never decides a bin.** |
| `name` | What Gemini saw ("Canette de Red Bull"), in `lang`. Display only: never used to look up a rule. |
| `kind` | Material description ("Canette en aluminium"). Show it under the name. |
| `count` | Identical objects merged into one piece. |
| `icon` | One of `quebecRules.json` → `icons`; `generic` when unmatched. |
| `confidence` | `high` (≥ 0.8), `medium` (≥ 0.5) or `low`. |
| `correctBin` | `recycling`, `compost`, `garbage` or `special`. **`null` means not playable**: list it under "Needs verification" and leave it out of the game. |
| `dropoff` / `dropoffName` | Only on `special`: where it really goes (`deposit`, `ecocentre`, `pharmacy`, `donation`, `tree_collection`, `bulky_collection`, `yard_collection`) and its name in `lang`. |
| `explanation` | One sentence: why this bin. |
| `specialInstruction` | Extra advice ("Flatten boxes"), or `null`. |
| `links` | Official pages (`label` in `lang`, `url`). |
| `mapsUrl` | Google Maps search for the nearest drop-off, when relevant. |
| `needsVerification` | `true` means show a confirm-or-edit step before the game. Set for: no rule, an unverified rule or override, low confidence, or Gemini's category disagreeing with the rule's. |
| `contextApplied` | `true` when the borough or brown-bin setting changed the answer from the city-wide default. Worth a badge ("Different in your borough"). |
| `sourceUrl` | montreal.ca page the rule comes from. |

---

## POST /api/classify

The user corrects a wrong detection by typing a name. This is the only endpoint that matches a **name**
to a rule (`findRule`, text synonyms). The scan path uses Gemini's `ruleId`.

```json
{ "name": "pile AA", "lang": "fr", "sessionId": "74028c3d-…", "itemId": "item-3" }
```

| Field | Rule |
|---|---|
| `name` | 1–80 characters. |
| `lang` | `fr` or `en` (default `fr`). |
| `sessionId` + `itemId` | Optional. Send both to **replace that item in the scan session**, so `/api/score` scores the corrected answer. |
| `borough`, `hasBrownBin` | Optional. If omitted, the session's context is used, otherwise the city-wide default. A corrected item always agrees with the rest of its scan. |

Response 200: `{ "item": <ScanItem> }`. An unknown name still returns 200, with `correctBin: null` and
`needsVerification: true`. Returns 404 `session_not_found` if the session expired (6 h) or the server restarted.

---

## POST /api/score

```json
{ "sessionId": "74028c3d-…", "answers": [ { "itemId": "item-1", "chosenBin": "special" } ] }
```

Response 200: `ScoreResponse`

```json
{
  "sessionId": "74028c3d-…",
  "score": 34, "correct": 1, "total": 3,
  "results": [
    { "itemId": "item-1", "name": "Canette", "chosenBin": "special", "correctBin": "special",
      "isCorrect": true, "points": 34, "explanation": "…", "specialInstruction": "…" }
  ],
  "unplayable": ["item-4"]
}
```

- Each playable item is worth an equal share, and the shares always add up to 100 (3 items = 34 + 33 + 33).
- Unanswered items count as wrong (`chosenBin: null`).
- Answers are checked against the `correctBin` stored in the session, which was already resolved for the scan's context.
- `results` feeds the results screen. `unplayable` lists items with `correctBin: null`.

---

## GET /health

```json
{ "ok": true, "model": "gemini-3.1-flash-lite", "hasKey": true, "rules": 50, "rulesVersion": 3, "rulesCheckedOn": "2026-11-21" }
```

Check it from the presentation phone's browser before the demo.

---

## Gemini → server (internal)

The app never sees this. The server sends Gemini the image plus a **text catalogue** built by
`catalogue()`, one line per rule: `- id [category]: English name / Nom français (synonyms)`. It never
sends the whole rules JSON, so the model never sees bins it could repeat.

Gemini must answer with this JSON schema (`SCHEMA` in `gemini.ts`). `category` and `ruleId` are enums
from `CATEGORIES` and `RULE_IDS` + `"none"`. `category` comes before `ruleId` so the model decides what
the object is before choosing a rule. A test enforces both.

```json
{
  "items": [
    { "name": "Canette de Red Bull", "kind": "Canette en aluminium", "category": "drink_container",
      "ruleId": "drink_can", "count": 3, "confidence": 0.93, "closedBag": false }
  ],
  "totalObjects": 3,
  "isEstimate": false
}
```

Zod (`Detected`) validates and clamps it: count 1–99, confidence 0–1, an unknown category becomes `null`,
and at most 8 items are kept. There is no bin, explanation or disposal field. If the model wrote one
anyway, nothing reads it.

---

## Errors

Every error body is `ApiError`:

```json
{ "error": "rate_limited", "message": "Gemini quota reached; try again in a minute" }
```

`error` is a flat code string. The app was written against this shape, so it stays (additive-only rule).

| HTTP | `error` | When | What the app shows |
|---|---|---|---|
| 400 | `bad_request` | Missing or short image, bad `lang`, unknown `borough`, non-boolean `hasBrownBin`, bad JSON. `message` names the field, e.g. `borough: borough must be one of the 19 borough slugs, or null…` | "Couldn't read that photo" plus a retake button |
| 400 / 413 | `bad_request` | Image over the limit | Resize to 1280 px before sending |
| 404 | `session_not_found` | `/api/score` or `/api/classify` after the server restarted or 6 h passed | "Scan again" |
| 429 | `rate_limited` | Gemini free-tier quota | "Busy, try again in a minute" plus the typed-name fallback |
| 504 | `timeout` | Gemini took more than 20 s | Retry button |
| 502 | `ai_failed` | Gemini error or bad JSON, twice (one retry) | Retry button |
| 500 | `no_key` | `GEMINI_API_KEY` missing on the server | (dev only) |

Only `ai_failed` is retried, once. A quota error would fail again and use up more quota. A timeout retry
would make the user wait 40 s, longer than the app's 25 s client timeout.

---

## Contract changes

`types.ts` is read by the server, the app, the game and the offline engine. To keep a teammate's screen
from breaking mid-hackathon:

1. **Additive only.** Add fields; never rename, remove or change the type of a field the app may read.
   If a name is wrong, add the right one next to it, send both, and mark the old one `@deprecated`
   (as with `sessionId` / `scanId`).
2. Update `types.ts` **and** `schemas.ts`. `tsc` fails if they disagree.
3. Update this file and, if the scan shape changed, `scanResponse.example.json`.
4. Run `npm run sync-shared`, then `npm run check`.
5. Post the change in the team chat.
