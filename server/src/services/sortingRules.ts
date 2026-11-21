// Server entry point for the rules engine (Waddah). Same exports as before, so gemini.ts and the
// scan route keep working. All the logic lives in rulesEngine.ts, which the app can bundle too.
import { readFileSync } from "node:fs";
import { createRulesEngine } from "./rulesEngine.js";

const engine = createRulesEngine(
  JSON.parse(readFileSync(new URL("../data/quebecRules.json", import.meta.url), "utf8")),
);

export const {
  RULES, RULE_IDS, CATEGORY_IDS, RULES_VERSION, RULES_CHECKED_ON,
  categoryName, BOROUGHS, boroughInfo, getRule, catalogue, findRule, resolveRule, isCorrect, toScanItem,
} = engine;
export { toConfidence, mapsUrl } from "./rulesEngine.js";
export type { Rule, ResolvedRule } from "./rulesEngine.js";
