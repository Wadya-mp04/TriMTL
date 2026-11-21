// Rules engine (Waddah). The ONLY place that decides which bin an item goes in.
// Gemini names objects and picks a ruleId from this catalogue; it never chooses a bin.
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Confidence, Lang, Rule, ScanItem } from "../types.js";

const text = z.object({ fr: z.string().min(1), en: z.string().min(1) });
const RulesFile = z.object({
  version: z.number(),
  checkedOn: z.string(),
  bins: z.array(z.string()),
  dropoffs: z.array(z.string()),
  icons: z.array(z.string()),
  items: z.array(z.object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    bin: z.enum(["recycling", "compost", "garbage", "special"]),
    dropoff: z.enum(["ecocentre", "deposit", "pharmacy", "donation", "tree_collection", "bulky_collection"]).nullable(),
    icon: z.string(),
    name: text,
    names: z.array(z.string().min(1)).min(1),
    explanation: text,
    specialInstruction: text.nullable(),
    mapsQuery: text.nullable(),
    links: z.array(z.object({ label: text, url: z.url() })),
    verified: z.boolean(),
    sourceUrl: z.url(),
  })),
});

// Validated at startup: a typo in the JSON stops the server with a clear message instead of
// sending a wrong bin to the game.
const file = RulesFile.parse(JSON.parse(readFileSync(new URL("../data/quebecRules.json", import.meta.url), "utf8")));
for (const r of file.items) {
  if (!file.icons.includes(r.icon)) throw new Error(`quebecRules.json: item "${r.id}" uses unknown icon "${r.icon}"`);
}
if (new Set(file.items.map(r => r.id)).size !== file.items.length) throw new Error("quebecRules.json: duplicate item id");

export const RULES: Rule[] = file.items;
export const RULES_CHECKED_ON = file.checkedOn;
export const RULE_IDS = RULES.map(r => r.id);
export const getRule = (id: string | null | undefined) => RULES.find(r => r.id === id) ?? null;

/** Compact catalogue for the Gemini prompt: "id: name; synonyms". */
export function catalogue(): string {
  return RULES.map(r => `- ${r.id}: ${r.name.en} / ${r.name.fr} (${r.names.join(", ")})`).join("\n");
}

// ---------- Text lookup, for when the user edits an item name ----------

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").trim();

function score(q: string, name: string) {
  const n = norm(name);
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.split(/[\s'-]+/).some(w => w.startsWith(q))) return 60;
  if (n.includes(q)) return 40;
  if (n.length > 3 && q.includes(n)) return 30;
  return 0;
}

/** Best rule for a typed name, or null. Works offline, no AI. */
export function findRule(query: string): Rule | null {
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

// ---------- Rule -> game piece ----------

export function toConfidence(c: number): Confidence {
  return c >= 0.8 ? "high" : c >= 0.5 ? "medium" : "low";
}

export const mapsUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${q} Montréal`)}`;

export function toScanItem(args: { id: string; name: string; kind?: string; count?: number; rule: Rule | null; confidence: Confidence; lang: Lang; closedBag?: boolean }): ScanItem {
  const { id, name, rule, confidence, lang } = args;
  // The model's description of the object; the rule's own name when the model gave none.
  const kind = args.kind || rule?.name[lang] || name;
  if (!rule) {
    return {
      id, ruleId: null, name, kind, count: args.count ?? 1, icon: "generic", confidence,
      correctBin: null, dropoff: null, explanation: null,
      specialInstruction: args.closedBag
        ? (lang === "fr" ? "Le contenu du sac est caché. Videz-le sur une table et reprenez la photo." : "The bag hides what's inside. Empty it on a table and take the photo again.")
        : (lang === "fr" ? "Aucune règle vérifiée pour cet objet. Corrigez son nom ou vérifiez sur montreal.ca." : "No verified rule for this item. Edit its name or check montreal.ca."),
      needsVerification: true, sourceUrl: null, mapsUrl: null,
    };
  }
  return {
    id, ruleId: rule.id, name, kind, count: args.count ?? 1, icon: rule.icon, confidence,
    correctBin: rule.bin,
    dropoff: rule.dropoff,
    explanation: rule.explanation[lang],
    specialInstruction: rule.specialInstruction?.[lang] ?? null,
    // Unverified rules and low-confidence detections get confirmed by the user first.
    needsVerification: !rule.verified || confidence === "low",
    sourceUrl: rule.sourceUrl,
    mapsUrl: rule.mapsQuery ? mapsUrl(rule.mapsQuery[lang]) : null,
  };
}
