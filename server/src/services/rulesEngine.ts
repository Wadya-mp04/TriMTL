// Rules engine (Waddah). The ONLY place that decides which bin an item goes in.
// Pure TypeScript, no node:fs: the server loads it in sortingRules.ts, and the app can bundle the same
// file with quebecRules.json so lookups, quizzes and scoring give the same answers offline.
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
export type RulesFile = z.infer<typeof RulesFile>;
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

export function toConfidence(c: number): Confidence {
  return c >= 0.8 ? "high" : c >= 0.5 ? "medium" : "low";
}

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
    if ((o.dropoff ?? null) !== null && o.bin !== "special") fail(`item "${r.id}" override has a dropoff but bin "${o.bin}"`);
  }

  const RULES: Rule[] = file.items;
  const RULE_IDS = RULES.map(r => r.id);
  const byId = new Map(RULES.map(r => [r.id, r]));
  const getRule = (id: string | null | undefined) => (id ? byId.get(id) ?? null : null);

  /** Compact catalogue for the Gemini prompt: "- id [category]: name / nom (synonyms)". */
  function catalogue(): string {
    return RULES.map(r => `- ${r.id} [${r.category}]: ${r.name.en} / ${r.name.fr} (${r.names.join(", ")})`).join("\n");
  }

  /** Best rule for a typed name, or null. Works offline, no AI. */
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

  /** Apply the user's context. The first matching override wins; no match = the city-wide default. */
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
        correctBin: null, dropoff: null, dropoffName: null, explanation: null,
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

    return {
      id, ruleId: rule.id, category: rule.category, name, kind, count: args.count ?? 1, icon: rule.icon, confidence,
      correctBin: r.bin,
      dropoff: r.dropoff,
      dropoffName: d?.name[lang] ?? null,
      explanation: r.explanation[lang],
      specialInstruction: (r.specialInstruction ?? d?.note)?.[lang] ?? null,
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
export type RulesEngine = ReturnType<typeof createRulesEngine>;
