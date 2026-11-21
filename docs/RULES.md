# Rules data: `server/src/data/quebecRules.json`

Owner: Waddah. This file is the **only** source of bins in TriMTL. Gemini picks a `ruleId`; this file
(through `rulesEngine.ts`) says what that id means. The JSON is validated by Zod plus integrity checks
when the server starts and on every `npm run check`, so a typo stops the server instead of teaching a
wrong answer.

Current state: **version 4**, 50 rules, 19 boroughs, every rule and override verified, checked on montreal.ca and Recyc-Québec on 2026-11-21.

## Top-level fields

| Field | Type | Meaning |
|---|---|---|
| `version` | integer | Bump on every data change. Sent to the app as `rulesVersion`, so it knows its bundled copy is stale. |
| `checkedOn` | `YYYY-MM-DD` | Last date the rules were checked against montreal.ca. |
| `bins` | `["recycling","compost","garbage","special"]` | The four game bins. Don't add bins: add a `dropoff` instead. |
| `categories` | `{ <category>: { fr, en } }` | Display name of every category in `CATEGORIES` (types.ts). All 19 are required. |
| `dropoffs` | `{ <dropoff>: { name, mapsQuery, note, links } }` | Where a `special` item goes. `note` fills `specialInstruction` when the item has none; otherwise it is sent separately as `dropoffNote` (never both with the same text). `mapsQuery` is the fallback map search, and `links` keys go into `links`. |
| `links` | `{ <key>: { label: { fr, en }, url } }` | Reusable official links, referenced by key from items and dropoffs. |
| `icons` | string[] | Icon names the app has assets for. An item with an unknown icon fails the check. |
| `boroughs` | `{ <slug>: { name, organics } }` | The 19 Montréal boroughs and their **attributes**. `organics` is `"combined"` or `"food_only"`. |
| `boroughsSourceUrl` | URL | Where the borough attributes were checked. |
| `items` | Rule[] | The rules. |

## A rule (`items[]`), field by field

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | `lowercase_with_underscores`, unique. Gemini returns it as `ruleId`. **Never rename one**: the app, tests and saved stats refer to it. |
| `category` | yes | What the item *is* (one of `CATEGORIES`). Used for stats, quizzes and to cross-check Gemini. **It never decides the bin.** |
| `bin` | yes | City-wide default bin. |
| `dropoff` | yes | `null` unless `bin` is `"special"`. A dropoff on any other bin fails the check. |
| `icon` | yes | One of `icons`. |
| `name` | yes | `{ fr, en }` display name of the rule. |
| `names` | yes | Synonyms, **both languages**, singular and plural, brand names welcome. Used by `findRule` when the user types a name, and shown to Gemini in the catalogue. |
| `explanation` | yes | `{ fr, en }` one sentence: why this bin. |
| `specialInstruction` | yes | `{ fr, en }` or `null`. `null` falls back to the dropoff's `note`. |
| `mapsQuery` | yes | `{ fr, en }` or `null`. `null` falls back to the dropoff's `mapsQuery`. |
| `links` | yes | Keys into top-level `links`. The dropoff's links are added after them, without duplicates. |
| `overrides` | no | Context-dependent answers. See below. |
| `verified` | yes | `false` until someone has checked it on montreal.ca. See the verification policy. |
| `sourceUrl` | yes | The official page that states the rule: montreal.ca, or Recyc-Québec. Any other host must be added on purpose to `SOURCE_EXCEPTIONS` in `rules.test.ts`. |

## How to add an item

1. Find the rule on montreal.ca. Good starting pages: [recycling](https://montreal.ca/articles/quoi-mettre-dans-le-bac-des-matieres-recyclables-83068), [brown bin](https://montreal.ca/articles/quoi-deposer-dans-le-bac-brun-44580), [garbage](https://montreal.ca/demarches/connaitre-les-modalites-de-la-collecte-des-ordures-menageres), [écocentres](https://montreal.ca/deposer-des-objets-lecocentre), [hazardous waste](https://montreal.ca/sujets/residus-domestiques-dangereux).
2. Copy the closest existing entry and give it a new `id`.
3. Set `category`, `bin` and `dropoff` (non-null only for `special`).
4. Fill `name`, `explanation` and `specialInstruction` in **French and English**.
5. Add plenty of `names` in both languages, e.g. `["canette", "canettes", "can", "cans", "Red Bull"]`. These matter both for typed corrections and for Gemini's matching.
6. Set `sourceUrl` (montreal.ca or Recyc-Québec). Set `verified: true` only if the page you read states this exact rule.
7. Bump `version`.
8. Add a case to the "typed names" test in `server/src/tests/rules.test.ts`.
9. Run `npm run check`, then `npm run sync-shared` so the app's offline copy matches.

The Gemini schema's `ruleId` enum is built from the ids automatically, so there's nothing to change in `gemini.ts`.

## How to add an override

An override changes the answer for users in a certain **context**. Example from `yard_waste`:

```json
"overrides": [
  {
    "when": { "organics": "combined" },
    "bin": "compost",
    "dropoff": null,
    "explanation": { "fr": "Dans votre arrondissement, les résidus verts vont dans le bac brun avec les restes de table.",
                     "en": "In your borough, yard waste goes in the brown bin with food scraps." },
    "specialInstruction": { "fr": "…", "en": "…" },
    "verified": true
  }
]
```

| Field | Meaning |
|---|---|
| `when` | **All** listed conditions must match. `hasBrownBin` (boolean) and `organics` (`"combined"`/`"food_only"`, read from the user's borough). `boroughs` (list of slugs) exists only as a last resort. |
| `bin`, `dropoff` | The answer in that context. **Set `"dropoff": null` explicitly** when moving off `special`. An omitted dropoff is inherited from the rule, and the check fails if that leaves a dropoff on a non-special bin. |
| `explanation` | **Required.** The base explanation is almost always wrong once the bin changes. |
| `specialInstruction` | `{ fr, en }` or `null`. |
| `verified` | The answer is verified only if the rule **and** the override are. |

Rules for overrides:

- **Match attributes, not borough names.** Write "boroughs with combined organics", not a list of five names. A fact about a borough lives once, in `boroughs`. There is no item × borough table anywhere, and there must not be.
- The **first** matching override wins. Put the most specific one first.
- No borough, or an unknown one, means the city-wide default (`organics` is unknown, so `organics` overrides don't match). `hasBrownBin` defaults to `true`.
- A matching override sets `contextApplied: true`, and the app can show "Different in your borough".

## How to add a borough attribute

Use this when a new fact varies by borough, e.g. a hypothetical `glassDropoff: true`.

1. Add the attribute to **every** borough in `boroughs` (the schema in `rulesEngine.ts` → `RulesFile.boroughs`).
2. Add it to `Override.when` in `rulesEngine.ts` and to the matching logic in `resolveRule()`.
3. Add a test with one borough of each value.
4. Write overrides against the attribute, never against borough names.

## Verification policy

- `verified: false` until a teammate has read the rule on the `sourceUrl` page. It's the same for overrides.
- An unverified rule or override is still answered, but the item gets `needsVerification: true`, and the app shows **"Needs verification"** with a confirm step before it can be played.
- `ruleId: "none"`, low confidence, or a Gemini category that disagrees with the rule's category also set `needsVerification`. **We never invent an answer.**
- `npm run validate-rules` lists every unverified rule and override.

Currently unverified: **none** (since v4). The five no-brown-bin overrides, `wrapping_paper` and
`christmas_lights` were checked and set to `verified: true` in v4 (see below).

## Verified facts: do not "fix" these

These were checked on montreal.ca on 2026-11-21. They look surprising, and that's what the game teaches.

| Fact | In the data | Source |
|---|---|---|
| Recycling rules are the same in all 19 boroughs (uniform across Québec). | No recycling overrides. | [Recycling bin](https://montreal.ca/articles/quoi-mettre-dans-le-bac-des-matieres-recyclables-83068) |
| 5 boroughs collect food **and** yard waste in the brown bin: Lachine, Le Plateau-Mont-Royal, L'Île-Bizard–Sainte-Geneviève, Pierrefonds-Roxboro, Saint-Laurent. The other 14 have a separate seasonal yard-waste collection. | `boroughs.*.organics`; `yard_waste` defaults to `special` + `yard_collection`, with an `organics: "combined"` override to `compost`. | [Organics collection](https://montreal.ca/collectes/collecte-des-matieres-organiques) |
| Upholstered furniture, mattresses and box springs go in household **garbage**. Only the Saint-Laurent écocentre recycles mattresses (pilot). | `upholstered_furniture` → `garbage` | [Garbage collection](https://montreal.ca/demarches/connaitre-les-modalites-de-la-collecte-des-ordures-menageres) |
| Non-upholstered furniture → bulky-item collection or écocentre. | `furniture` → `special` + `bulky_collection` | [Bulky items](https://montreal.ca/sujets/encombrants-et-materiaux-de-construction) |
| Drink cans and plastic drink bottles (100 mL–2 L) go back for the deposit, not into recycling. | `drink_can`, `drink_bottle` → `special` + `deposit` | [Recycling bin](https://montreal.ca/articles/quoi-mettre-dans-le-bac-des-matieres-recyclables-83068) |
| Since 2025, all packaging goes in recycling: coffee cups, chip bags, wrappers, film, foam food trays. | `coffee_cup`, `chip_bag`, `plastic_bags`, `foam_food` → `recycling` | [Recycling bin](https://montreal.ca/articles/quoi-mettre-dans-le-bac-des-matieres-recyclables-83068) |
| Without a brown bin, food scraps, eggshells and coffee grounds go in the **garbage**, as a last resort. Soiled paper towels and tissues too: they are refused in the recycling. (Verified in v4.) | No-brown-bin overrides on `food_scraps`, `eggshells`, `coffee_grounds`, `paper_towel` → `garbage` | [Brown bin](https://montreal.ca/articles/quoi-deposer-dans-le-bac-brun-44580) |
| Compostable and biodegradable plastics go in the **garbage** in every context. They aren't recyclable, and some boroughs refuse them in the brown bin. (Changed in v4: was `compost`.) | `compostable_plastic` → `garbage`, no override | [Garbage](https://montreal.ca/sujets/ordures-menageres) |
| Gift-wrap paper is accepted printed paper → recycling. (Verified in v4; the unverified "metallic paper goes in the garbage" sentence was removed.) | `wrapping_paper` → `recycling` | [Collections, Saint-Laurent](https://montreal.ca/articles/tout-savoir-sur-les-collectes-saint-laurent-11887) |
| Christmas lights never go in the recycling bin, where they jam the sorting machines. They go to an écocentre. (Verified in v4.) | `christmas_lights` → `special` + `ecocentre` | [Recyc-Québec holiday guide](https://newswire.ca/fr/news-releases/guide-pour-un-noel-ecoresponsable-selon-recyc-quebec-apres-les-fetes-le-sapin-et-les-decorations-885351746.html) (press release; a recyc-quebec.gouv.qc.ca page would be a better source) |
| Yard waste: branches longer than 1 m or thicker than 5 cm, soil and stones go to an écocentre. Off season (separate-collection boroughs), yard waste goes to an écocentre, and the garbage only as a last resort. (Corrected in v4.) | `yard_waste.specialInstruction`; `dropoffs.yard_collection.note` | [Organics collection](https://montreal.ca/collectes/collecte-des-matieres-organiques) |
| Independent municipalities (Westmount, Côte-Saint-Luc, Pointe-Claire…) are not boroughs. | Not in `boroughs`; the app sends `borough: null` ("Other"), which uses the city-wide default. | |

## What does NOT belong here

Garbage collection frequency, bulky-item volume limits and bin sizes vary by borough and change often, but
they aren't **sorting** rules: they don't change which bin an item goes in. They belong on the app's
**My Area** screen, which links to [Info-collectes](https://montreal.ca/services/horaire-des-collectes).
Don't add them to the rules engine.
