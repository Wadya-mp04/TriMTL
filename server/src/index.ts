/**
 * @file Express app (owner: Juan): CORS, JSON body limit, /health, routes, JSON-only error handler.
 * Run: npm run dev -> http://<laptop-LAN-IP>:3001 (Expo Go on the same Wi-Fi).
 * It must never decide a bin or log the image, the request body or GEMINI_API_KEY.
 */
import { networkInterfaces } from "node:os";
import cors from "cors";
import express from "express";
import { MODEL } from "./services/gemini.js";
import { RULES, RULES_CHECKED_ON, RULES_VERSION } from "./services/sortingRules.js";
import { classify } from "./routes/classify.js";
import { scan } from "./routes/scan.js";
import { scoreRoute } from "./routes/score.js";

/** The configured app, exported so it can be mounted or tested without listening on a port. */
export const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // a 1280 px JPEG is ~300 KB of base64; this leaves room

app.get("/health", (_req, res) => {
  res.json({
    ok: true, model: MODEL, hasKey: !!process.env.GEMINI_API_KEY,
    rules: RULES.length, rulesVersion: RULES_VERSION, rulesCheckedOn: RULES_CHECKED_ON,
  });
});
app.use(scan, classify, scoreRoute);

app.use((_req, res) => res.status(404).json({ error: "bad_request", message: "Unknown route" }));
// Malformed JSON, oversized body, or a bug: always JSON back, never an HTML error page.
app.use((err: Error & { status?: number; type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error: status === 500 ? "ai_failed" : "bad_request",
    message: err.type === "entity.too.large" ? "Image too large; resize to 1280 px before sending" : err.message,
  });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 3001;
  app.listen(port, "0.0.0.0", () => {
    const lan = Object.values(networkInterfaces()).flat().find(a => a?.family === "IPv4" && !a.internal)?.address;
    console.log(`TriMTL API on http://localhost:${port}` + (lan ? ` and http://${lan}:${port} (use this one in Expo Go)` : ""));
    if (!process.env.GEMINI_API_KEY) console.warn("GEMINI_API_KEY missing: /api/scan will return no_key");
  });
}
