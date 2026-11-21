/**
 * @file POST /api/scan (owner: Juan): a photo in, game pieces out.
 *
 * Flow: validate the request -> Gemini names objects and picks ruleIds -> the rules engine resolves each
 * ruleId in the user's context (borough, brown bin) -> ScanResponse. This route must never decide a bin
 * or use Gemini's `name` to look up a rule: the bin comes only from `toScanItem()`, via `getRule(ruleId)`.
 */
import { Router } from "express";
import { z } from "zod";
import { AiError, identifyItems, type Detection } from "../services/gemini.js";
import { createSession } from "../services/sessions.js";
import { BOROUGHS, getRule, RULES_CHECKED_ON, RULES_VERSION, toConfidence, toScanItem } from "../services/sortingRules.js";
import type { ApiError, ScanContext, ScanResponse } from "../types.js";

/** ~7.5 MB of image once decoded. Express's 10 MB JSON limit rejects anything far above this first. */
const MAX_BASE64_CHARS = 10_000_000;
const BOROUGH_SLUGS = BOROUGHS.map(b => b.slug) as [string, ...string[]];

const Body = z.object({
  // expo-image-picker with { base64: true } gives the bare base64 string; a data: URL prefix is also accepted.
  imageBase64: z.string({ error: "imageBase64 is required" })
    .min(100, "imageBase64 is too short to be a photo")
    .max(MAX_BASE64_CHARS, "Image too large; resize to 1280 px before sending")
    .transform(s => s.replace(/^data:[^,]+,/, "")),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]).default("image/jpeg"),
  lang: z.enum(["fr", "en"], { error: 'lang must be "fr" or "en"' }).default("fr"),
  // Rejecting an unknown slug (instead of silently using the city default) catches app-side typos.
  // Independent municipalities (Westmount, Côte-Saint-Luc…) are not boroughs: the app sends null.
  borough: z.enum(BOROUGH_SLUGS, { error: "borough must be one of the 19 borough slugs, or null" }).nullable().default(null),
  hasBrownBin: z.boolean({ error: "hasBrownBin must be true or false" }).default(true),
});

/**
 * What to tell the user when there is nothing to play with: "not waste" (a cat, a street) or "nothing
 * found". Null when there are items. Built server-side so both languages read the same in every screen.
 */
function emptyMessage(d: Detection, lang: "fr" | "en"): string | null {
  if (d.items.length) return null;
  const what = d.subject ? ` (${d.subject})` : "";
  if (d.notWaste) {
    return lang === "fr"
      ? `Ce n'est pas un déchet à trier${what}. Prenez en photo un contenant, un emballage ou un objet à jeter.`
      : `That's not something to sort${what}. Take a photo of a container, packaging or something you want to throw away.`;
  }
  return lang === "fr"
    ? "Aucun objet à trier n'a été trouvé. Rapprochez-vous et assurez-vous que les objets sont bien visibles."
    : "No items to sort were found. Move closer and make sure the items are clearly visible.";
}

const AI_STATUS = { rate_limited: 429, timeout: 504, ai_failed: 502, no_key: 500 } as const;

/**
 * Build the scan router.
 * @param identify The Gemini call. Injectable so tests run the real route with a fake detector
 *   (no network, no API key).
 */
export function createScanRouter(identify: typeof identifyItems = identifyItems) {
  return Router().post("/api/scan", async (req, res) => {
    const body = Body.safeParse(req.body);
    if (!body.success) {
      const issue = body.error.issues[0];
      const where = issue?.path.join(".");
      return res.status(400).json({
        error: "bad_request",
        message: `${where ? `${where}: ` : ""}${issue?.message ?? "invalid body"}. Send JSON { imageBase64, mimeType?, lang?, borough?, hasBrownBin? }`,
      } satisfies ApiError);
    }
    const { imageBase64, mimeType, lang, borough, hasBrownBin } = body.data;
    // The resolved context, echoed back so the app shows what the answers were computed for.
    const context: Required<ScanContext> = { lang, borough, hasBrownBin };
    try {
      const detected = await identify(imageBase64, mimeType, lang);
      const items = detected.items.map((d, i) => toScanItem({
        id: `item-${i + 1}`,
        name: d.name,
        kind: d.kind,
        count: d.count,
        rule: getRule(d.ruleId),   // null for "none" or an unknown id
        confidence: toConfidence(d.confidence),
        lang,
        closedBag: d.closedBag,
        aiCategory: d.category,
        ctx: { borough, hasBrownBin },
      }));
      // Rule ids only, never the image: enough to debug a bad scan from the server log.
      console.log("scan", `total=${detected.total}${detected.isEstimate ? "~" : ""}`, items.map(i => `${i.ruleId ?? "none"}x${i.count}:${i.confidence}`).join(" ") || "empty");
      const scanId = createSession(items, context);
      return res.json({
        scanId, rulesVersion: RULES_VERSION, checkedOn: RULES_CHECKED_ON, context,
        total: detected.total, isEstimate: detected.isEstimate, items,
        // Legacy names, same values (contract changes are additive only).
        sessionId: scanId, totalCount: detected.total, countIsEstimate: detected.isEstimate,
        subject: detected.subject, notWaste: detected.notWaste, message: emptyMessage(detected, lang),
      } satisfies ScanResponse);
    } catch (err) {
      if (err instanceof AiError) {
        console.error("scan failed:", err.code, err.message);
        return res.status(AI_STATUS[err.code]).json({ error: err.code, message: err.message } satisfies ApiError);
      }
      throw err;
    }
  });
}

/** The production router, wired to the real Gemini call. */
export const scan = createScanRouter();
