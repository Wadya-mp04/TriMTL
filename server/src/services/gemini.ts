/**
 * @file Gemini vision service (owner: Juan). Names the objects in a photo and matches each one to a
 * `ruleId` from our catalogue, plus a `category` used as a sanity check.
 *
 * It NEVER chooses a bin, and nothing it writes about disposal is ever used: the rules engine
 * (rulesEngine.ts) decides every bin from verified data. The schema below has no bin field on purpose.
 */
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { catalogue, RULE_IDS } from "./sortingRules.js";
import { CATEGORIES } from "../types.js";
import type { Lang } from "../types.js";

/** Model id. Overridable with GEMINI_MODEL; flash-lite took 2–4 s per photo vs 22 s for a heavier model. */
export const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const TIMEOUT_MS = 20_000;
// Tested 21 Nov: thinkingLevel "low"/"high" did not improve counting of partly hidden cans and
// "high" timed out on 2 of 4 photos, so the model's default is used.
const MAX_ITEMS = 8;

/**
 * A failure talking to Gemini. The scan route maps each `code` to an HTTP status
 * (rate_limited 429, timeout 504, ai_failed 502, no_key 500).
 */
export class AiError extends Error {
  /**
   * @param code Machine-readable reason, sent to the app as `error`.
   * @param message Human-readable detail. Never includes the API key.
   */
  constructor(public code: "rate_limited" | "timeout" | "ai_failed" | "no_key", message: string) { super(message); }
}

/**
 * System prompt. Only the compact `catalogue()` text goes to the model, not the whole rules JSON:
 * the model needs ids and synonyms to match objects, and must not see bins it could be tempted to repeat.
 */
export const SYSTEM = `You look at a photo of household waste for a Montréal recycling game.
Your only job: name each object, say what category it belongs to, and match it to the catalogue id below. You never choose a bin.

Catalogue (id [category]: names):
${catalogue()}

Rules:
- List EVERY distinct object a person would throw away or sort, up to ${MAX_ITEMS}. Look at the whole photo, including objects behind or partly hidden by others.
- Merge objects of the same kind and catalogue id into one entry, even if brands differ, and set "count" (5 drink cans of 3 brands = one entry, count 5). Count every one, including those partly hidden.
- "name": short and plain, in the requested language, brand allowed (e.g. "Canette de Red Bull", "Bouteille d'eau").
- "kind": what the object physically is, material included, in the requested language (e.g. "Canette en aluminium", "Bouteille en plastique", "Sachet souple en plastique", "Emballage multicouche", "Pile alcaline").
- "category": what the object IS (its material or family), decided from the object itself before you pick an id. Give it even when no catalogue id fits.
- "totalObjects": how many separate objects you see in total, counting each one in a merged entry. Count exactly when there are fewer than 20; with 20 or more, give your best estimate and set "isEstimate" true.
- "ruleId": the catalogue id that best fits, or "none" if nothing fits.
  * Drink cans and plastic drink bottles (water, soda, energy drinks, juice, 100 mL to 2 L) -> drink_can / drink_bottle.
  * Snack wrappers, granola bar wrappers, cookie bags, chip bags, food pouches -> chip_bag.
- A pile, a heap or an OPEN bag of loose things is not a closed bag: list each object, even crushed, dirty or seen from an odd angle.
- If a closed, opaque bag hides its contents, return one entry for it with ruleId "none" and closedBag true.
- Ignore people, hands, tables, floors, walls, and belongings clearly in use (a phone or laptop on the desk, keys, a wallet).
- "confidence": 0 to 1, how sure you are of the object AND the id.
- "subject": in a few words, in the requested language, what the photo mainly shows (e.g. "un chat", "une personne", "une rue", "des canettes sur une table").
- "notWaste": true when the photo contains NOTHING to throw away or sort: only an animal, a person, a landscape, a room, a screen, food still on a plate being eaten, etc. Then return an empty list. If there is any waste in the photo (even a person holding a bottle), notWaste is false and you list the waste.`;

/**
 * JSON schema Gemini must fill. Two choices matter:
 * - `ruleId` and `category` are `enum`s, so the model cannot invent an id or a category.
 * - `category` is listed BEFORE `ruleId`: the model fills fields in order, so it first decides what the
 *   object is, then picks a rule. If the two disagree, the engine flags the item for verification.
 */
export const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          kind: { type: "string" },
          category: { type: "string", enum: [...CATEGORIES] },
          ruleId: { type: "string", enum: [...RULE_IDS, "none"] },
          count: { type: "integer" },
          confidence: { type: "number" },
          closedBag: { type: "boolean" },
        },
        required: ["name", "kind", "category", "ruleId", "count", "confidence"],
      },
    },
    totalObjects: { type: "integer" },
    isEstimate: { type: "boolean" },
    subject: { type: "string" },
    notWaste: { type: "boolean" },
  },
  required: ["items", "totalObjects", "isEstimate", "subject", "notWaste"],
};

// Never trust the model's JSON blindly: validate, clamp, and drop anything malformed.
// An unknown category becomes null (no sanity check) rather than failing the whole scan.
/** Validates Gemini's JSON: clamps and trims bad values instead of failing the scan. Exported for tests. */
export const Detected = z.object({
  totalObjects: z.number().int().catch(0),
  isEstimate: z.boolean().catch(false),
  subject: z.string().trim().max(80).catch(""),
  notWaste: z.boolean().catch(false),
  items: z.array(z.object({
    name: z.string().trim().min(1).transform(s => s.slice(0, 80)), // a long product name is cut, not a failed scan
    kind: z.string().trim().max(80).catch(""),
    category: z.enum(CATEGORIES).nullable().catch(null),
    ruleId: z.string(),
    count: z.number().int().catch(1).transform(n => Math.min(Math.max(n, 1), 99)),
    confidence: z.number().catch(0).transform(c => Math.min(Math.max(c, 0), 1)),
    closedBag: z.boolean().optional().default(false),
  })).transform(a => a.slice(0, MAX_ITEMS * 2)),
});

/** One object as Gemini described it, after validation. Has no bin field by design. */
export type DetectedItem = z.infer<typeof Detected>["items"][number];

/**
 * What `identifyItems` returns: validated objects, the total object count, a short description of the
 * photo (`subject`) and whether it holds nothing to sort at all (`notWaste`, e.g. a cat or a street).
 */
export interface Detection { items: DetectedItem[]; total: number; isEstimate: boolean; subject: string; notWaste: boolean }

/**
 * Total objects: the sum of merged counts, unless the model saw more than it listed (20+ = estimate).
 * @param items Validated detections.
 * @param modelTotal The model's own `totalObjects`.
 * @param modelEstimate The model's own `isEstimate`.
 */
export function totalOf(items: Pick<DetectedItem, "count">[], modelTotal: number, modelEstimate: boolean) {
  const listed = items.reduce((s, i) => s + i.count, 0);
  const total = Math.max(listed, modelTotal);
  return { total, isEstimate: modelEstimate || total >= 20 };
}

let client: GoogleGenAI | null = null;
function ai() {
  if (!process.env.GEMINI_API_KEY) throw new AiError("no_key", "GEMINI_API_KEY is not set in server/.env");
  return (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
}

async function callOnce(imageBase64: string, mimeType: string, lang: Lang): Promise<Detection> {
  const call = ai().models.generateContent({
    model: MODEL,
    contents: [
      { inlineData: { mimeType, data: imageBase64 } },
      // The examples in SYSTEM are French; say the language explicitly or "subject"/"kind" drift into French.
      { text: `List every object to sort in this photo. Write every "name", "kind" and "subject" in ${lang === "en" ? "English" : "French"}.` },
    ],
    config: { systemInstruction: SYSTEM, responseMimeType: "application/json", responseJsonSchema: SCHEMA, temperature: 0 },
  });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new AiError("timeout", `Gemini took longer than ${TIMEOUT_MS / 1000} s`)), TIMEOUT_MS));
  let text: string | undefined;
  try {
    text = (await Promise.race([call, timeout])).text;
  } catch (err) {
    if (err instanceof AiError) throw err;
    const status = (err as { status?: number }).status;
    if (status === 429) throw new AiError("rate_limited", "Gemini quota reached; try again in a minute");
    throw new AiError("ai_failed", `Gemini error ${status ?? ""}: ${(err as Error).message}`.slice(0, 300));
  }
  let json: unknown;
  try { json = JSON.parse(text ?? "{}"); } catch { throw new AiError("ai_failed", "Gemini returned invalid JSON"); }
  const parsed = Detected.safeParse(json);
  if (!parsed.success) throw new AiError("ai_failed", "Gemini returned JSON in an unexpected shape");
  const items = parsed.data.items.slice(0, MAX_ITEMS);
  return {
    items, ...totalOf(items, parsed.data.totalObjects, parsed.data.isEstimate),
    subject: parsed.data.subject,
    // Listed waste wins over the flag: a person holding a bottle is a bottle to sort.
    notWaste: parsed.data.notWaste && items.length === 0,
  };
}

/**
 * Identify the objects in a photo.
 *
 * Retries once, and only on `ai_failed` (a transient server error or malformed JSON, which a second
 * try usually fixes). A quota error would just fail again and burn quota; a timeout would double the
 * wait to 40 s, longer than the app's 25 s client timeout.
 * @param imageBase64 Bare base64 (no data: prefix).
 * @param mimeType e.g. "image/jpeg".
 * @param lang Language for `name` and `kind`.
 * @throws AiError
 */
export async function identifyItems(imageBase64: string, mimeType: string, lang: Lang): Promise<Detection> {
  try {
    return await callOnce(imageBase64, mimeType, lang);
  } catch (err) {
    if (err instanceof AiError && err.code === "ai_failed") return callOnce(imageBase64, mimeType, lang);
    throw err;
  }
}
