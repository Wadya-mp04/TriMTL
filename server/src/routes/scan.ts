// POST /api/scan  (Juan)  photo -> game pieces
import { Router } from "express";
import { z } from "zod";
import { AiError, identifyItems } from "../services/gemini.js";
import { createSession } from "../services/sessions.js";
import { getRule, toConfidence, toScanItem } from "../services/sortingRules.js";
import type { ApiError, ScanResponse } from "../types.js";

const Body = z.object({
  // expo-image-picker with { base64: true } gives the bare base64 string; a data: URL prefix is also accepted.
  imageBase64: z.string().min(100).transform(s => s.replace(/^data:[^,]+,/, "")),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]).default("image/jpeg"),
  lang: z.enum(["fr", "en"]).default("fr"),
});

const AI_STATUS = { rate_limited: 429, timeout: 504, ai_failed: 502, no_key: 500 } as const;

export const scan = Router().post("/api/scan", async (req, res) => {
  const body = Body.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "bad_request", message: "Send JSON { imageBase64, mimeType?, lang? }" } satisfies ApiError);
  }
  const { imageBase64, mimeType, lang } = body.data;
  try {
    const detected = await identifyItems(imageBase64, mimeType, lang);
    const items = detected.items.map((d, i) => toScanItem({
      id: `item-${i + 1}`,
      name: d.name,
      kind: d.kind,
      count: d.count,
      rule: getRule(d.ruleId),
      confidence: toConfidence(d.confidence),
      lang,
      closedBag: d.closedBag,
    }));
    // Bins only, never the image: enough to debug a bad scan from the server log.
    console.log("scan", `total=${detected.total}${detected.isEstimate ? "~" : ""}`, items.map(i => `${i.ruleId ?? "none"}x${i.count}:${i.confidence}`).join(" ") || "empty");
    return res.json({
      sessionId: createSession(items), totalCount: detected.total, countIsEstimate: detected.isEstimate, items,
    } satisfies ScanResponse);
  } catch (err) {
    if (err instanceof AiError) {
      console.error("scan failed:", err.code, err.message);
      return res.status(AI_STATUS[err.code]).json({ error: err.code, message: err.message } satisfies ApiError);
    }
    throw err;
  }
});
