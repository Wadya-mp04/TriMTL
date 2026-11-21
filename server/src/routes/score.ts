// POST /api/score  (Waddah)  the player's answers -> score out of 100 + correct bins
import { Router } from "express";
import { z } from "zod";
import { score } from "../services/scoring.js";
import { getSession } from "../services/sessions.js";
import type { ApiError, ScoreResponse } from "../types.js";

const Body = z.object({
  sessionId: z.string().min(1),
  answers: z.array(z.object({
    itemId: z.string().min(1),
    chosenBin: z.enum(["recycling", "compost", "garbage", "special"]),
  })).max(50),
});

export const scoreRoute = Router().post("/api/score", (req, res) => {
  const body = Body.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "bad_request", message: "Send JSON { sessionId, answers: [{ itemId, chosenBin }] }" } satisfies ApiError);
  }
  const items = getSession(body.data.sessionId);
  if (!items) return res.status(404).json({ error: "session_not_found", message: "Scan session expired; scan again" } satisfies ApiError);
  return res.json(score(body.data.sessionId, items, body.data.answers) satisfies ScoreResponse);
});
