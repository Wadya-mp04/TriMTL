/**
 * @file Scan sessions (owner: Waddah). Keeps what /api/scan returned, so /api/score checks answers
 * against the server's own answers and /api/classify can correct an item in the same context.
 * It must never decide a bin: it only stores ScanItems that the rules engine already resolved.
 *
 * shortcut: in-memory, lost on restart and not shared between instances; move to Supabase if the
 * server ever runs on more than one machine.
 */
import { randomUUID } from "node:crypto";
import type { ScanContext, ScanItem } from "../types.js";

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_SESSIONS = 1000;

/** A stored scan: the items as returned, plus the resolved context they were resolved in. */
interface Session { items: ScanItem[]; ctx: Required<ScanContext>; at: number }
const sessions = new Map<string, Session>();

/** City-wide default context, used for sessions created before context was stored. */
const DEFAULT_CTX: Required<ScanContext> = { lang: "fr", borough: null, hasBrownBin: true };

/**
 * Store a scan and return its id (the response's `scanId` / `sessionId`).
 * Expired sessions are swept here rather than on a timer, so there is no background work to manage.
 * @param items The resolved game pieces.
 * @param ctx The resolved context; stored so a later correction uses the same borough and brown-bin answer.
 */
export function createSession(items: ScanItem[], ctx: Required<ScanContext> = DEFAULT_CTX): string {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.at > TTL_MS) sessions.delete(id);
  if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value!);
  const id = randomUUID();
  sessions.set(id, { items, ctx, at: now });
  return id;
}

/** The items of a session, or null if it expired or the server restarted. */
export const getSession = (id: string): ScanItem[] | null => sessions.get(id)?.items ?? null;

/** The context a session was scanned with, or null if the session is gone. */
export const getSessionContext = (id: string): Required<ScanContext> | null => sessions.get(id)?.ctx ?? null;

/**
 * Replace one item after the user corrects its name (appends it if the id is new).
 * @returns false when the session no longer exists.
 */
export function replaceItem(sessionId: string, item: ScanItem): boolean {
  const s = sessions.get(sessionId);
  if (!s) return false;
  const i = s.items.findIndex(x => x.id === item.id);
  if (i === -1) s.items.push(item); else s.items[i] = item;
  return true;
}
