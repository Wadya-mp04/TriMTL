/**
 * @file Runtime (Zod) mirror of the response contract in types.ts (owners: Juan + Waddah).
 * Used by tests to prove that the scan route and docs/examples match the contract, field name for field
 * name. Server-only: the app does not need it. It must never contain bin logic.
 *
 * The type assertions at the bottom fail `tsc` if this schema and types.ts drift apart, so a contract
 * change has to be made in both places.
 */
import { z } from "zod";
import { BINS, CATEGORIES, DROPOFFS } from "./types.js";
import type { ScanItem, ScanResponse } from "./types.js";

/** One ScanItem. `.strict()` so an extra or misspelled field name fails validation. */
export const ScanItemSchema = z.object({
  id: z.string(),
  ruleId: z.string().nullable(),
  category: z.enum(CATEGORIES).nullable(),
  name: z.string(),
  kind: z.string(),
  count: z.number().int().min(1),
  icon: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  correctBin: z.enum(BINS).nullable(),
  dropoff: z.enum(DROPOFFS).nullable(),
  dropoffName: z.string().nullable(),
  explanation: z.string().nullable(),
  specialInstruction: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: z.url() }).strict()),
  mapsUrl: z.url().nullable(),
  needsVerification: z.boolean(),
  contextApplied: z.boolean(),
  sourceUrl: z.url().nullable(),
}).strict();

/**
 * POST /api/scan response. The legacy fields and subject/notWaste/message are optional here because the
 * canonical example (scanResponse.example.json) predates them; the server always sends them (route test).
 */
export const ScanResponseSchema = z.object({
  scanId: z.string().min(1),
  rulesVersion: z.number().int(),
  checkedOn: z.string(),
  context: z.object({
    lang: z.enum(["fr", "en"]),
    borough: z.string().nullable(),
    hasBrownBin: z.boolean(),
  }).strict(),
  total: z.number().int().min(0),
  isEstimate: z.boolean(),
  items: z.array(ScanItemSchema),
  sessionId: z.string().optional(),
  totalCount: z.number().int().optional(),
  countIsEstimate: z.boolean().optional(),
  // Added after the canonical example was written (PR #2), so optional here; the server always sends them.
  subject: z.string().optional(),
  notWaste: z.boolean().optional(),
  message: z.string().nullable().optional(),
}).strict();

// Compile-time drift check: each side must be assignable to the other.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const itemMatches: Same<z.infer<typeof ScanItemSchema>, ScanItem> = true;
const responseMatches: Same<Required<z.infer<typeof ScanResponseSchema>>, ScanResponse> = true;
void itemMatches; void responseMatches;
