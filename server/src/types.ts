// The API contract. The mobile app (mobile/services/api.ts) should copy these types exactly.

export type Lang = "fr" | "en";

/** The four bins in the game. */
export type Bin = "recycling" | "compost" | "garbage" | "special";

/** For bin "special" (and a few others): where exactly it goes. */
export type Dropoff = "ecocentre" | "deposit" | "pharmacy" | "donation" | "tree_collection" | "bulky_collection";

export type Confidence = "high" | "medium" | "low";

type Text = { fr: string; en: string };

/** One entry in src/data/quebecRules.json (Waddah owns this file). */
export interface Rule {
  id: string;
  bin: Bin;
  dropoff: Dropoff | null;
  icon: string;
  name: Text;
  names: string[];
  explanation: Text;
  specialInstruction: Text | null;
  mapsQuery: Text | null;
  links: { label: Text; url: string }[];
  verified: boolean;
  sourceUrl: string;
}

/** One game piece, as returned by POST /api/scan and POST /api/classify. */
export interface ScanItem {
  id: string;                    // "item-1", unique within the session
  ruleId: string | null;         // null = no verified rule matched
  name: string;                  // what was seen, in the requested language ("Canette de Red Bull")
  kind: string;                  // what it physically is, material included ("Canette en aluminium")
  count: number;                 // identical objects merged into one piece
  icon: string;                  // one of quebecRules.json "icons"; "generic" when unmatched
  confidence: Confidence;
  correctBin: Bin | null;        // null => not playable: show under "Needs verification"
  dropoff: Dropoff | null;
  explanation: string | null;
  specialInstruction: string | null;
  needsVerification: boolean;    // true => ask the user to confirm or edit before the game
  sourceUrl: string | null;      // montreal.ca page the rule comes from
  mapsUrl: string | null;        // Google Maps search for the nearest drop-off, when relevant
}

export interface ScanResponse {
  sessionId: string;
  totalCount: number;       // every object in the photo, merged counts included (3 cans + 1 bottle = 4)
  countIsEstimate: boolean; // true with 20+ objects: show "about 25 items"
  items: ScanItem[];
  subject: string;          // what the photo mainly shows ("un chat", "des canettes sur une table")
  notWaste: boolean;        // true => nothing to sort in the photo (a cat, a person...); items is empty
  message: string | null;   // ready-to-show text when notWaste or when nothing was found; null otherwise
}

export interface ScoreRequest {
  sessionId: string;
  answers: { itemId: string; chosenBin: Bin }[];
}

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

export interface ScoreResponse {
  sessionId: string;
  score: number;        // out of 100
  correct: number;
  total: number;        // playable items only
  results: ScoreResult[];
  unplayable: string[]; // item ids left out because no verified rule matched
}

/** Every error body looks like this. */
export interface ApiError {
  error: "bad_request" | "no_items" | "rate_limited" | "timeout" | "ai_failed" | "no_key" | "session_not_found";
  message: string;
}
