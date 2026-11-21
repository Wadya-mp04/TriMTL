/**
 * @file The shared API contract between the server and the mobile app (owners: Juan + Waddah; read by
 * Melik and Zayaan). The app bundles an identical copy in mobile/shared/ (see `npm run sync-shared`).
 *
 * Changes here are ADDITIVE ONLY: add a field, never rename or remove one the app may already read.
 * Post every change in the team chat. This file holds shapes only: it must never contain logic that
 * decides a bin (that is rulesEngine.ts's job).
 */

/** Language of every user-facing string in a response. */
export type Lang = "fr" | "en";

/** How sure Gemini is of an object and its ruleId, bucketed by `toConfidence()` (≥0.8 high, ≥0.5 medium). */
export type Confidence = "high" | "medium" | "low";

/** The four game bins. Deposit, écocentre, pharmacy… are a `dropoff` on the "special" bin, not extra bins. */
export const BINS = ["recycling", "compost", "garbage", "special"] as const;
/** One of the four game bins. */
export type Bin = (typeof BINS)[number];

/**
 * Where a "special" item actually goes. Kept separate from the bin so the game stays at four bins
 * while the results screen can still say "bring it to the écocentre".
 */
export const DROPOFFS = [
  "ecocentre", "deposit", "pharmacy", "donation", "tree_collection", "bulky_collection", "yard_collection",
] as const;
/** One of the drop-off destinations for the "special" bin. */
export type Dropoff = (typeof DROPOFFS)[number];

/**
 * General label for an item: what it IS (its material/family), used for stats, XP, quizzes and as a
 * sanity check on Gemini. It never decides the bin: "plastic" alone can be recycling (containers),
 * garbage (straws), compost (certified compostable) or special (protective foam).
 */
export const CATEGORIES = [
  "paper_cardboard", "plastic", "metal", "glass", "drink_container", "food", "yard", "hygiene",
  "textile", "household_object", "electronics", "battery", "lighting", "appliance", "hazardous",
  "medical", "automotive", "construction", "furniture",
] as const;
/** One of the item categories (never decides a bin, see `CATEGORIES`). */
export type Category = (typeof CATEGORIES)[number];

/**
 * How a borough collects organics. "combined": food AND yard waste in the brown bin (Lachine, Plateau,
 * Île-Bizard–Sainte-Geneviève, Pierrefonds-Roxboro, Saint-Laurent). "food_only": food in the brown bin,
 * yard waste in its own seasonal collection (the other 14).
 */
export type OrganicsModel = "food_only" | "combined";

/**
 * Where the user lives. Recycling is the same city-wide; the borough matters through its attributes
 * (e.g. organics model), which rule overrides match on.
 */
export interface ScanContext {
  lang: Lang;
  /** One of the 19 borough slugs in quebecRules.json, e.g. "plateau-mont-royal". Unknown/null = city default. */
  borough?: string | null;
  /** Many apartment buildings have no brown bin. Default true. */
  hasBrownBin?: boolean;
}

/** App -> server. POST /api/scan */
export interface ScanRequest extends ScanContext {
  imageBase64: string;
  mimeType: string;
}

/** One game piece. Every bin-related field comes from the rules engine, never from Gemini. */
export interface ScanItem {
  id: string;                    // "item-1"
  ruleId: string | null;         // null = no verified rule matched
  category: Category | null;     // rule's category; Gemini's guess when no rule matched
  name: string;                  // what Gemini saw, e.g. "Canette de Red Bull"
  kind: string;                  // material description, e.g. "Canette en aluminium"
  count: number;
  icon: string;
  confidence: Confidence;
  correctBin: Bin | null;        // null when needsVerification and no rule
  dropoff: Dropoff | null;
  dropoffName: string | null;    // "Écocentre", "Pharmacy"… in the requested language
  explanation: string | null;
  specialInstruction: string | null;
  links: { label: string; url: string }[];
  mapsUrl: string | null;
  needsVerification: boolean;    // unverified rule, low confidence, or Gemini/rule category mismatch
  contextApplied: boolean;       // true when the user's context (e.g. no brown bin) changed the answer
  sourceUrl: string | null;
}

/**
 * Server -> app, POST /api/scan.
 *
 * The last three fields predate the v3 contract and are kept because contract changes are additive
 * only: `/api/score` and `/api/classify` still take `sessionId`. New code should read `scanId`,
 * `total` and `isEstimate`; the server sends both names with the same values.
 */
export interface ScanResponse {
  scanId: string;
  rulesVersion: number;          // the app compares this with its bundled copy to know when to refresh
  checkedOn: string;
  context: Required<ScanContext>;
  total: number;
  isEstimate: boolean;
  items: ScanItem[];
  /** @deprecated Same value as `scanId`. Kept for /api/score and /api/classify clients. */
  sessionId: string;
  /** @deprecated Same value as `total`. */
  totalCount: number;
  /** @deprecated Same value as `isEstimate`. */
  countIsEstimate: boolean;
}

/** App -> server, POST /api/score: the bin the player chose for each item of a scan session. */
export interface ScoreRequest {
  sessionId: string;
  answers: { itemId: string; chosenBin: Bin }[];
}

/** One line of the results screen: the player's answer next to the engine's answer. */
export interface ScoreResult {
  itemId: string;
  name: string;
  chosenBin: Bin | null;
  correctBin: Bin;
  isCorrect: boolean;
  points: number;
  explanation: string | null;
  specialInstruction: string | null;
}

/** Server -> app, POST /api/score. */
export interface ScoreResponse {
  sessionId: string;
  score: number;        // out of 100
  correct: number;
  total: number;        // playable items only
  results: ScoreResult[];
  unplayable: string[]; // item ids left out because no verified rule matched
}

/**
 * Every error body looks like this. `error` is a flat code string (not `{ code, message }`) because
 * the app was already written against this shape; changing it would break clients.
 */
export interface ApiError {
  error: "bad_request" | "no_items" | "rate_limited" | "timeout" | "ai_failed" | "no_key" | "session_not_found";
  message: string;
}

export type { Rule } from "./services/rulesEngine.js";
