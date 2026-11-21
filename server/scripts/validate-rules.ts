/**
 * @file `npm run check` step 2 (owner: Waddah): load quebecRules.json through sortingRules.ts, which runs
 * the Zod schema and the integrity checks (unknown icon/link/dropoff/category/borough, duplicate ids,
 * dropoff on a non-"special" bin). Any problem throws and fails the check. Never edits the data.
 */
import { BOROUGHS, RULES, RULES_CHECKED_ON, RULES_VERSION } from "../src/services/sortingRules.js";

const unverified = RULES.filter(r => !r.verified).map(r => r.id);
const unverifiedOverrides = RULES.flatMap(r => r.overrides.filter(o => !o.verified).map(o => `${r.id} ${JSON.stringify(o.when)}`));
console.log(`rules ok: v${RULES_VERSION}, ${RULES.length} rules, ${BOROUGHS.length} boroughs, checked ${RULES_CHECKED_ON}`);
console.log(`  unverified rules (${unverified.length}): ${unverified.join(", ") || "none"}`);
console.log(`  unverified overrides (${unverifiedOverrides.length}): ${unverifiedOverrides.join("; ") || "none"}`);
