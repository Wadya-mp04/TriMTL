/**
 * @file POST /api/classify (owner: Waddah): a typed name in, a game piece out. Used when the user
 * corrects a wrong detection.
 *
 * This is the ONE place on the server where a name is matched to a rule (`findRule`, text synonyms),
 * because here the human typed it. The scan path uses Gemini's `ruleId` instead. The bin still comes
 * only from `toScanItem()`; this route must never decide one itself.
 */
import { Router } from "express";
import { z } from "zod";
import { getSessionContext, replaceItem } from "../services/sessions.js";
import { BOROUGHS, findRule, toScanItem } from "../services/sortingRules.js";
import type { ApiError, ScanItem } from "../types.js";

const BOROUGH_SLUGS = BOROUGHS.map(b => b.slug) as [string, ...string[]];

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  lang: z.enum(["fr", "en"]).default("fr"),
  // Both set = replace that item in the scan session, so /api/score uses the corrected answer.
  sessionId: z.string().optional(),
  itemId: z.string().optional(),
  // Optional; when omitted, the scan session's context is used, else the city-wide default.
  borough: z.enum(BOROUGH_SLUGS).nullable().optional(),
  hasBrownBin: z.boolean().optional(),
});

/** Router for POST /api/classify. Returns `{ item: ScanItem }`; 404 `session_not_found` if the session expired. */
export const classify = Router().post("/api/classify", (req, res) => {
  const body = Body.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "bad_request", message: "Send JSON { name, lang?, sessionId?, itemId?, borough?, hasBrownBin? }" } satisfies ApiError);
  }
  const { name, lang, sessionId, itemId } = body.data;
  // Without this, an item corrected after a "no brown bin" scan would come back as compost while
  // the rest of the scan said garbage, and scoring would disagree with what the user was shown.
  const session = sessionId ? getSessionContext(sessionId) : null;
  const ctx = {
    borough: body.data.borough !== undefined ? body.data.borough : session?.borough ?? null,
    hasBrownBin: body.data.hasBrownBin ?? session?.hasBrownBin ?? true,
  };
  // The user typed it, so the object itself is certain; only the rule match can be missing.
  const item: ScanItem = toScanItem({ id: itemId ?? "item-edited", name, rule: findRule(name), confidence: "high", lang, ctx });
  if (sessionId && itemId && !replaceItem(sessionId, item)) {
    return res.status(404).json({ error: "session_not_found", message: "Scan session expired; scan again" } satisfies ApiError);
  }
  return res.json({ item });
});
