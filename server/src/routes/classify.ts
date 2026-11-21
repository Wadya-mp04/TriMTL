// POST /api/classify  (Waddah)  typed name -> game piece. Used when the user edits a wrong detection.
import { Router } from "express";
import { z } from "zod";
import { replaceItem } from "../services/sessions.js";
import { findRule, toScanItem } from "../services/sortingRules.js";
import type { ApiError, ScanItem } from "../types.js";

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  lang: z.enum(["fr", "en"]).default("fr"),
  // Both set = replace that item in the scan session, so /api/score uses the corrected answer.
  sessionId: z.string().optional(),
  itemId: z.string().optional(),
});

export const classify = Router().post("/api/classify", (req, res) => {
  const body = Body.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "bad_request", message: "Send JSON { name, lang?, sessionId?, itemId? }" } satisfies ApiError);
  }
  const { name, lang, sessionId, itemId } = body.data;
  // The user typed it, so the object itself is certain; only the rule match can be missing.
  const item: ScanItem = toScanItem({ id: itemId ?? "item-edited", name, rule: findRule(name), confidence: "high", lang });
  if (sessionId && itemId && !replaceItem(sessionId, item)) {
    return res.status(404).json({ error: "session_not_found", message: "Scan session expired; scan again" } satisfies ApiError);
  }
  return res.json({ item });
});
