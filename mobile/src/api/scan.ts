/**
 * Client for the TriMTL server's POST /api/scan (see docs/API.md).
 * No secrets live here: the Gemini key stays in server/.env.
 */
import Constants from 'expo-constants';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { fromScanItem, ScanResponseDTO, SortItem } from '../data/items';
import { translate } from '../i18n';

/**
 * Server URL. Set EXPO_PUBLIC_API_URL (e.g. in mobile/.env) to override. Otherwise, in development,
 * we assume the server runs on the same laptop as Metro, on port 3001.
 */
export function apiBaseUrl(): string | null {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:3001` : null;
}

/** Resize to ~1280 px wide JPEG and return base64, as docs/API.md recommends. */
async function toBase64(uri: string, lang: 'fr' | 'en'): Promise<string> {
  const ref = await ImageManipulator.manipulate(uri).resize({ width: 1280 }).renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!out.base64) throw new Error(translate(lang, 'Could not read the photo.'));
  return out.base64;
}

export interface ScanOutcome {
  items: SortItem[];
  /** Server text to show when a photo had nothing to sort. */
  messages: string[];
}

/** Longer than the server's 20 s Gemini limit; without it a wrong server IP spins for over a minute. */
const TIMEOUT_MS = 25_000;

/** Scans each photo (the endpoint takes one image per request) and merges the items. */
export async function scanPhotos(
  uris: string[],
  ctx: { borough: string | null; hasBrownBin: boolean; lang?: 'fr' | 'en' },
  signal?: AbortSignal,
): Promise<ScanOutcome> {
  const lang = ctx.lang ?? 'en';
  const base = apiBaseUrl();
  if (!base) throw new Error(translate(lang, 'No server URL. Set EXPO_PUBLIC_API_URL in mobile/.env.'));

  const results = await Promise.all(
    uris.map(async (uri) => {
      const imageBase64 = await toBase64(uri, lang);
      // Aborts on the caller's cancel or after TIMEOUT_MS, whichever comes first.
      const ctrl = new AbortController();
      const cancel = () => ctrl.abort();
      if (signal?.aborted) cancel();
      signal?.addEventListener('abort', cancel);
      const timer = setTimeout(cancel, TIMEOUT_MS);
      const unreachable = () => new Error(translate(lang, "Can't reach the server at {url}. Is it running, on the same Wi-Fi?", { url: base }));
      try {
        let res: Response;
        try {
          res = await fetch(`${base}/api/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg', lang, borough: ctx.borough, hasBrownBin: ctx.hasBrownBin }),
            signal: ctrl.signal,
          });
        } catch (e) {
          if (signal?.aborted) throw e; // the user left the screen: not an error to show
          throw unreachable();
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
          throw new Error(body?.message ?? body?.error ?? translate(lang, 'Server error {status}', { status: res.status }));
        }
        return (await res.json().catch((e) => { if (signal?.aborted) throw e; throw unreachable(); })) as ScanResponseDTO;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
      }
    }),
  );

  return {
    items: results.flatMap((r) => r.items.map((it) => ({ ...fromScanItem(it, r.scanId), lang }))),
    messages: results.filter((r) => r.items.length === 0 && r.message).map((r) => r.message as string),
  };
}
