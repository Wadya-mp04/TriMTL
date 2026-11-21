/**
 * @file Server entry point for the rules engine (owner: Waddah). Reads quebecRules.json from disk and
 * hands it to `createRulesEngine`, so the JSON is validated (Zod + integrity checks) as soon as this
 * module loads: a typo in the data stops the server instead of sending a wrong bin to the game.
 *
 * All logic lives in rulesEngine.ts (pure, shared with the app). This file must stay a thin loader:
 * no bin decisions here.
 */
import { readFileSync } from "node:fs";
import { createRulesEngine } from "./rulesEngine.js";

const engine = createRulesEngine(
  JSON.parse(readFileSync(new URL("../data/quebecRules.json", import.meta.url), "utf8")),
);

/**
 * The server's rules engine, flattened so callers keep the same imports as before the v3 split.
 * See `createRulesEngine` in rulesEngine.ts for each member: `getRule` (scan path, by ruleId),
 * `findRule` (typed names only), `resolveRule` / `toScanItem` (the only bin deciders), `catalogue`
 * (Gemini prompt text), `RULES_VERSION` (sent to the app as `rulesVersion`), `BOROUGHS` (19 slugs).
 */
export const {
  RULES, RULE_IDS, CATEGORY_IDS, RULES_VERSION, RULES_CHECKED_ON,
  categoryName, BOROUGHS, boroughInfo, getRule, catalogue, findRule, resolveRule, isCorrect, toScanItem,
} = engine;
export { toConfidence, mapsUrl } from "./rulesEngine.js";
export type { Rule, ResolvedRule } from "./rulesEngine.js";
