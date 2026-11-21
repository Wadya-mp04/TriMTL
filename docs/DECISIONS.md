# Architecture decisions

Short records of decisions the code depends on. Read these before "simplifying" something. Add a new
entry rather than editing an old one when a decision changes.

---

## ADR-1: Gemini picks a `ruleId`, never a bin

**Decision.** Gemini returns, per object, only `name, kind, category, ruleId, count, confidence, closedBag?`.
`ruleId` is a JSON-schema `enum` of our rule ids plus `"none"`. The bin, dropoff, explanation and
instructions come from `quebecRules.json` through the rules engine. Nothing the model writes about
disposal is ever used.

**Why.**
- Montréal's rules are counter-intuitive (cans go back for the deposit, chip bags go in recycling since
  2025). A general model gives the *common* answer, which is often wrong *here*, and gives it confidently.
- With the enum, the model can't invent a rule. With the bin in our data, every answer has a montreal.ca
  `sourceUrl` that we can show a judge.
- Fixing a wrong answer means editing one JSON entry and adding a test, not prompt-tuning.

**Alternatives rejected.**
- *Ask Gemini for the bin directly.* Fastest to build, but unverifiable and wrong on exactly the items the game is about.
- *Gemini picks the bin, rules "correct" it.* Two sources of truth, and nobody can tell which one won.

---

## ADR-2: `category` is a label and a sanity check, never a bin

**Decision.** Every rule has a `category` (what the item *is*). Gemini also returns a `category`, listed
**before** `ruleId` in the schema. The category is used for stats, quizzes, display when no rule matches,
and as a cross-check: if Gemini's category ≠ the rule's category, the item gets `needsVerification: true`.

**Why.**
- One category maps to several bins. "plastic" can be recycling (containers), garbage (straws), compost
  (certified compostable) or special (protective foam). A category → bin shortcut would be wrong often.
- The model fills JSON fields in order. Deciding "this is food" before picking a rule makes a nonsense
  pick ("food" → `plastic_container`) less likely. When it happens anyway, the mismatch is caught and
  the user is asked, instead of being taught a wrong answer.

**Alternatives rejected.**
- *Fall back to a category's "usual bin" when no rule matches.* That's inventing an answer. No rule means "Needs verification".

---

## ADR-3: Borough differences are attribute-based overrides

**Decision.** Facts about boroughs live once, in `quebecRules.json` → `boroughs` (19 slugs, each with
`organics: "combined" | "food_only"`). A rule's `overrides` match on **attributes**
(`when: { organics: "combined" }`, `when: { hasBrownBin: false }`), not on lists of borough names.
Unknown or null borough means the city-wide default. `hasBrownBin` defaults to `true`.

**Why.**
- Recycling is uniform across all 19 boroughs. What varies is a handful of *collection models*. Writing
  "the 5 combined-organics boroughs" once means one edit when a borough changes model, instead of hunting
  through every rule that lists it.
- It makes the "not sure" path explicit: no borough means the default, never a guess.

**Alternatives rejected.**
- *Item × borough table.* 50 × 19 cells, almost all identical, and a typo in one cell is invisible.
- *Overrides listing borough names.* Same fact repeated on every affected rule. `when.boroughs` exists only as a last resort.

---

## ADR-4: One pure rules engine, shared by server and app

**Decision.** All rule logic lives in `server/src/services/rulesEngine.ts`, which has **no Node
imports**. It takes the parsed JSON as an argument. The server wraps it in `sortingRules.ts` (reads the
file with `node:fs`). The app bundles byte-identical copies of `rulesEngine.ts`, `types.ts` and
`quebecRules.json` in `mobile/shared/`, made by `npm run sync-shared` and enforced by a sha256 check in
`npm run check`.

**Why.**
- Offline mode (typed names, quizzes, scoring) must give the *same* answers as the server. Two
  implementations would drift within hours.
- Expo's bundler doesn't import files from outside `mobile/` by default, so a copy is simpler than a
  monorepo package during a 24 h hackathon. The hash check removes the risk that copies usually bring.
- The copies keep the server's folder layout (`shared/services/`, `shared/data/`) so the relative imports inside them resolve unchanged.

**Alternatives rejected.**
- *App always asks the server.* No offline mode, and every quiz question costs a round trip.
- *Shared npm workspace package.* Right long-term, but costs Metro configuration time we don't have.
- *A separate rules implementation in the app.* Guaranteed to disagree with the server.

---

## ADR-5: Contract changes are additive only

**Decision.** Fields in `types.ts` and the response JSON are never renamed or removed. A better name is
added next to the old one, both are sent, and the old one is marked `@deprecated`. `schemas.ts` mirrors
the contract, and `tsc` fails if the two disagree.

**Why.**
- Four people build against the same shapes in parallel. A rename on the server silently breaks a screen
  someone else is demoing, usually at hour 20.
- Concrete case: v3 renamed `sessionId` → `scanId`, `totalCount` → `total` and `countIsEstimate` →
  `isEstimate`. The server sends both sets, and `/api/score` and `/api/classify` still take `sessionId`.
  For the same reason, the error body stays `{ error: "<code>", message }`.

**Alternatives rejected.**
- *Rename and tell everyone.* Works until one person misses the message.
- *Versioned endpoints (`/v2/scan`).* Overkill for a 24 h build. Additive fields get the same result with no routing changes.
