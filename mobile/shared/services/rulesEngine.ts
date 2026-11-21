/**
 * @file Rules engine (owner: Waddah). The ONLY place that decides which bin an item goes in:
 * `correctBin`, `dropoff`, `explanation` and `specialInstruction` come only from `resolveRule()` /
 * `toScanItem()` here.
 *
 * Pure TypeScript with no Node imports (no node:fs): the server loads the JSON in sortingRules.ts, and
 * the app bundles an identical copy of this file with quebecRules.json so lookups, quizzes and scoring
 * give the same answers offline. Never import a Node module here, and never read Gemini's `name` or
 * `category` to choose a bin.
 */
import { z } from "zod";
import { BINS, CATEGORIES, DROPOFFS } from "../types.js";
import type { Bin, Category, Confidence, Lang, OrganicsModel, ScanContext, ScanItem } from "../types.js";

const text = z.object({ fr: z.string().min(1), en: z.string().min(1) });

const Override = z.object({
  // Every condition listed must match. Conditions are borough ATTRIBUTES (organics), not borough names,
  // so a fact about a borough is written once, in the boroughs table. `boroughs` is a last-resort escape hatch.
  when: z.object({
    hasBrownBin: z.boolean().optional(),
    organics: z.enum(["food_only", "combined"]).optional(),
    boroughs: z.array(z.string()).optional(),
  }),
  bin: z.enum(BINS),
  dropoff: z.enum(DROPOFFS).nullable().optional(),
  explanation: text,                    // required: the base explanation is usually wrong once the bin changes
  specialInstruction: text.nullable(),
  verified: z.boolean(),
});

/** Schema of one rule (one item) in quebecRules.json → `items`. Field-by-field docs: docs/RULES.md. */
const Item = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  category: z.enum(CATEGORIES),
  bin: z.enum(BINS),
  dropoff: z.enum(DROPOFFS).nullable(),
  icon: z.string(),
  name: text,
  names: z.array(z.string().min(1)).min(1),
  explanation: text,
  specialInstruction: text.nullable(), // null = use the dropoff's note, if any
  mapsQuery: text.nullable(),          // null = use the dropoff's mapsQuery, if any
  links: z.array(z.string()),          // keys into file.links
  overrides: z.array(Override).optional().default([]),
  verified: z.boolean(),
  sourceUrl: z.url(),
});

/** Zod schema of the whole quebecRules.json. `createRulesEngine` parses with it before anything else. */
export const RulesFile = z.object({
  version: z.number().int(),
  checkedOn: z.string(),
  bins: z.array(z.enum(BINS)),
  categories: z.record(z.enum(CATEGORIES), text),
  dropoffs: z.record(z.enum(DROPOFFS), z.object({
    name: text,
    mapsQuery: text.nullable(),
    note: text.nullable(),
    links: z.array(z.string()),
  })),
  links: z.record(z.string(), z.object({ label: text, url: z.url() })),
  icons: z.array(z.string()),
  boroughs: z.record(z.string().regex(/^[a-z-]+$/), z.object({
    name: z.string(),
    organics: z.enum(["food_only", "combined"]),
  })),
  boroughsSourceUrl: z.url(),
  items: z.array(Item),
});
/** The parsed rules file. */
export type RulesFile = z.infer<typeof RulesFile>;
/** One rule as stored in the JSON (before the user's context is applied; see `ResolvedRule`). */
export type Rule = z.infer<typeof Item>;

/** A rule after applying the user's context: what the game and the results screen actually show. */
export interface ResolvedRule {
  rule: Rule;
  bin: Bin;
  dropoff: Rule["dropoff"];
  explanation: Rule["explanation"];
  specialInstruction: Rule["specialInstruction"];
  verified: boolean;
  contextApplied: boolean;
}

/**
 * Bucket Gemini's 0–1 confidence. "low" (< 0.5) makes the item need verification.
 * @param c Confidence from the model, already clamped to 0–1.
 */
export function toConfidence(c: number): Confidence {
  return c >= 0.8 ? "high" : c >= 0.5 ? "medium" : "low";
}

/** Google Maps search URL for a drop-off query; " Montréal" is appended so results stay local. */
export const mapsUrl = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${q} Montréal`)}`;

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").trim();

function score(q: string, name: string) {
  const n = norm(name);
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.split(/[\s'-]+/).some(w => w.startsWith(q))) return 60;
  if (n.includes(q)) return 40;
  if (n.length > 3 && q.includes(n)) return 30;
  return 0;
}

/**
 * Validate a rules file and build the engine around it.
 *
 * Takes the parsed JSON instead of a path so the same function runs on the server (which reads the file
 * with node:fs) and in the app (which imports the bundled JSON).
 * @param raw The parsed quebecRules.json.
 * @throws Error naming the bad field: unknown icon/link/dropoff/borough, duplicate id, missing category
 *   name, or a dropoff on a bin other than "special" (including one an override would inherit).
 */
export function createRulesEngine(raw: unknown) {
  // Validated at startup: a typo in the JSON stops the server (or fails the app's test) with a clear
  // message instead of sending a wrong bin to the game.
  const file = RulesFile.parse(raw);
  const fail = (m: string) => { throw new Error(`quebecRules.json: ${m}`); };
  const ids = new Set<string>();
  for (const r of file.items) {
    if (ids.has(r.id)) fail(`duplicate item id "${r.id}"`);
    ids.add(r.id);
    if (!file.icons.includes(r.icon)) fail(`item "${r.id}" uses unknown icon "${r.icon}"`);
    for (const k of r.links) if (!file.links[k]) fail(`item "${r.id}" uses unknown link "${k}"`);
    if (r.dropoff && !file.dropoffs[r.dropoff]) fail(`item "${r.id}" uses undefined dropoff "${r.dropoff}"`);
    if (r.dropoff && r.bin !== "special") fail(`item "${r.id}" has a dropoff but its bin is "${r.bin}", not "special"`);
  }
  for (const c of CATEGORIES) if (!file.categories[c]) fail(`category "${c}" has no name`);
  for (const r of file.items) for (const o of r.overrides) {
    for (const b of o.when.boroughs ?? []) if (!file.boroughs[b]) fail(`item "${r.id}" override uses unknown borough "${b}"`);
    // An override that omits `dropoff` inherits the rule's, so check the dropoff it would actually produce:
    // moving yard_waste to "compost" without `dropoff: null` would otherwise keep "yard_collection".
    const effective = o.dropoff === undefined ? r.dropoff : o.dropoff;
    if (effective !== null && o.bin !== "special") fail(`item "${r.id}" override gives bin "${o.bin}" a dropoff ("${effective}"); set "dropoff": null`);
  }

  const RULES: Rule[] = file.items;
  const RULE_IDS = RULES.map(r => r.id);
  const byId = new Map(RULES.map(r => [r.id, r]));
  const getRule = (id: string | null | undefined) => (id ? byId.get(id) ?? null : null);

  /** Compact catalogue for the Gemini prompt: "- id [category]: name / nom (synonyms)". */
  function catalogue(): string {
    return RULES.map(r => `- ${r.id} [${r.category}]: ${r.name.en} / ${r.name.fr} (${r.names.join(", ")})`).join("\n");
  }

  /**
   * Best rule for a name the USER typed or corrected, or null. Works offline, no AI.
   * Never use it on Gemini's `name` in the scan path: the scan uses Gemini's `ruleId`, because a
   * display name like "Bouteille Coca" would text-match the wrong rule more often than the model errs.
   */
  function findRule(query: string): Rule | null {
    const q = norm(query);
    if (q.length < 2) return null;
    const variants = [q, q.replace(/s\b/g, "")];
    let best: Rule | null = null, top = 0;
    for (const r of RULES) {
      for (const n of [r.name.fr, r.name.en, ...r.names]) {
        for (const v of variants) {
          const s = score(v, n);
          if (s > top) { top = s; best = r; }
        }
      }
    }
    return best;
  }

  /** The borough's attributes; null when the borough is unknown (the city-wide default applies). */
  function boroughInfo(slug: string | null | undefined) {
    return slug ? file.boroughs[slug] ?? null : null;
  }

  /**
   * Apply the user's context to a rule. Overrides match on borough ATTRIBUTES (`organics`, `hasBrownBin`)
   * rather than borough names, so a fact about a borough is written once, in `boroughs`.
   * The first matching override wins; no match = the city-wide default. A result is verified only
   * if both the rule and the override are.
   */
  function resolveRule(rule: Rule, ctx: Partial<ScanContext> = {}): ResolvedRule {
    const hasBrownBin = ctx.hasBrownBin ?? true;
    const organics: OrganicsModel | null = boroughInfo(ctx.borough)?.organics ?? null;
    const o = rule.overrides.find(({ when }) =>
      (when.hasBrownBin === undefined || when.hasBrownBin === hasBrownBin) &&
      (when.organics === undefined || when.organics === organics) &&
      (when.boroughs === undefined || (!!ctx.borough && when.boroughs.includes(ctx.borough))));
    if (!o) {
      return { rule, bin: rule.bin, dropoff: rule.dropoff, explanation: rule.explanation,
        specialInstruction: rule.specialInstruction, verified: rule.verified, contextApplied: false };
    }
    return { rule, bin: o.bin, dropoff: o.dropoff === undefined ? rule.dropoff : o.dropoff,
      explanation: o.explanation, specialInstruction: o.specialInstruction,
      verified: rule.verified && o.verified, contextApplied: true };
  }

  /** Same scoring everywhere (game, quiz, offline): is this bin right for this rule in this context? */
  function isCorrect(ruleId: string, chosen: Bin, ctx: Partial<ScanContext> = {}): boolean | null {
    const rule = getRule(ruleId);
    return rule ? resolveRule(rule, ctx).bin === chosen : null;
  }

  /**
   * Turn a rule (or no rule) into a game piece, in the user's context.
   * `needsVerification` is true for: no rule, an unverified rule or override, low confidence, or a
   * Gemini category that disagrees with the rule's category (it probably picked the wrong ruleId).
   * @param args.rule `getRule(ruleId)` on the scan path, `findRule(typedName)` when the user corrects.
   * @param args.aiCategory Gemini's category, used only as a sanity check, never to pick a bin.
   * @param args.ctx Borough and brown bin; omitted fields use the defaults (borough null, hasBrownBin true).
   */
  function toScanItem(args: {
    id: string; name: string; kind?: string; count?: number; rule: Rule | null; confidence: Confidence;
    lang: Lang; closedBag?: boolean; aiCategory?: string | null; ctx?: Partial<ScanContext>;
  }): ScanItem {
    const { id, name, rule, confidence, lang } = args;
    const aiCategory = (CATEGORIES as readonly string[]).includes(args.aiCategory ?? "")
      ? (args.aiCategory as Category) : null;
    // The model's description of the object; the rule's own name when the model gave none.
    const kind = args.kind || rule?.name[lang] || name;

    if (!rule) {
      return {
        id, ruleId: null, category: aiCategory, name, kind, count: args.count ?? 1, icon: "generic", confidence,
        correctBin: null, dropoff: null, dropoffName: null, dropoffNote: null, explanation: null,
        specialInstruction: args.closedBag
          ? (lang === "fr" ? "Le contenu du sac est caché. Videz-le sur une table et reprenez la photo." : "The bag hides what's inside. Empty it on a table and take the photo again.")
          : (lang === "fr" ? "Aucune règle vérifiée pour cet objet. Corrigez son nom ou vérifiez sur montreal.ca." : "No verified rule for this item. Edit its name or check montreal.ca."),
        links: [], mapsUrl: null, needsVerification: true, contextApplied: false, sourceUrl: null,
      };
    }

    const r = resolveRule(rule, { ...args.ctx, lang });
    const d = r.dropoff ? file.dropoffs[r.dropoff] : null;
    const mapsQuery = rule.mapsQuery ?? d?.mapsQuery ?? null;
    // Item links first, then the dropoff's, without duplicates.
    const linkKeys = [...new Set([...rule.links, ...(d?.links ?? [])])];
    // Gemini says "plastic" but the rule is "food"? It probably picked the wrong ruleId.
    const categoryMismatch = aiCategory !== null && aiCategory !== rule.category;
    // The item's own instruction wins the specialInstruction slot (unchanged since v1, so existing screens
    // keep working); the drop-off's note gets its own field so it isn't hidden when both exist.
    const specialInstruction = (r.specialInstruction ?? d?.note)?.[lang] ?? null;
    const note = d?.note?.[lang] ?? null;

    return {
      id, ruleId: rule.id, category: rule.category, name, kind, count: args.count ?? 1, icon: rule.icon, confidence,
      correctBin: r.bin,
      dropoff: r.dropoff,
      dropoffName: d?.name[lang] ?? null,
      explanation: r.explanation[lang],
      specialInstruction,
      dropoffNote: note !== specialInstruction ? note : null,
      links: linkKeys.map(k => ({ label: file.links[k].label[lang], url: file.links[k].url })),
      mapsUrl: mapsQuery ? mapsUrl(mapsQuery[lang]) : null,
      // Unverified rules, low-confidence detections and category mismatches get confirmed by the user first.
      needsVerification: !r.verified || confidence === "low" || categoryMismatch,
      contextApplied: r.contextApplied,
      sourceUrl: rule.sourceUrl,
    };
  }

  return {
    RULES, RULE_IDS, CATEGORY_IDS: CATEGORIES, RULES_VERSION: file.version, RULES_CHECKED_ON: file.checkedOn,
    categoryName: (c: Category, lang: Lang) => file.categories[c][lang],
    /** For the borough picker in My Area / onboarding. */
    BOROUGHS: Object.entries(file.boroughs).map(([slug, b]) => ({ slug, ...b })),
    boroughInfo,
    getRule, catalogue, findRule, resolveRule, isCorrect, toScanItem,
  };
}
/** Everything `createRulesEngine` returns. */
export type RulesEngine = ReturnType<typeof createRulesEngine>;
