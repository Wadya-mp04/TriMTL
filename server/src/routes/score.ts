/**
 * @file POST /api/score (owner: Waddah): the player's answers in, a score out of 100 plus the correct
 * bins for the results screen. It never decides a bin: it compares against the `correctBin` the rules
 * engine already put in the scan session.
 */
import { Router } from "express";
import { z } from "zod";
import { score } from "../services/scoring.js";
import { getSession } from "../services/sessions.js";
import { BINS } from "../types.js";
import type { ApiError, ScoreResponse } from "../types.js";

const Body = z.object({
  sessionId: z.string().min(1),
  answers: z.array(z.object({
    itemId: z.string().min(1),
    chosenBin: z.enum(BINS),
  })).max(50),
});

/** Router for POST /api/score. 404 `session_not_found` when the server restarted or the session expired. */
export const scoreRoute = Router().post("/api/score", (req, res) => {
  const body = Body.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "bad_request", message: "Send JSON { sessionId, answers: [{ itemId, chosenBin }] }" } satisfies ApiError);
  }
  const items = getSession(body.data.sessionId);
  if (!items) return res.status(404).json({ error: "session_not_found", message: "Scan session expired; scan again" } satisfies ApiError);
  return res.json(score(body.data.sessionId, items, body.data.answers) satisfies ScoreResponse);
});
