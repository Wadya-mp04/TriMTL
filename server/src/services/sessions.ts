// Scan sessions, so /api/score can check answers against what the server actually returned.
// shortcut: in-memory, lost on restart and not shared between instances; move to Supabase if the
// server ever runs on more than one machine.
import { randomUUID } from "node:crypto";
import type { ScanItem } from "../types.js";

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_SESSIONS = 1000;
const sessions = new Map<string, { items: ScanItem[]; at: number }>();

export function createSession(items: ScanItem[]): string {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.at > TTL_MS) sessions.delete(id);
  if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value!);
  const id = randomUUID();
  sessions.set(id, { items, at: now });
  return id;
}

export const getSession = (id: string) => sessions.get(id)?.items ?? null;

/** Replace one item after the user corrects its name. */
export function replaceItem(sessionId: string, item: ScanItem): boolean {
  const s = sessions.get(sessionId);
  if (!s) return false;
  const i = s.items.findIndex(x => x.id === item.id);
  if (i === -1) s.items.push(item); else s.items[i] = item;
  return true;
}
