/**
 * Client for the TriMTL server's POST /api/scan (see docs/API.md).
 * No secrets live here: the Gemini key stays in server/.env.
 */
import Constants from 'expo-constants';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { fromScanItem, ScanResponseDTO, SortItem } from '../data/items';

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
async function toBase64(uri: string): Promise<string> {
  const ref = await ImageManipulator.manipulate(uri).resize({ width: 1280 }).renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!out.base64) throw new Error('Could not read the photo.');
  return out.base64;
}

export interface ScanOutcome {
  items: SortItem[];
  /** Server text to show when a photo had nothing to sort. */
  messages: string[];
}

/** Scans each photo (the endpoint takes one image per request) and merges the items. */
export async function scanPhotos(uris: string[], signal?: AbortSignal): Promise<ScanOutcome> {
  const base = apiBaseUrl();
  if (!base) throw new Error('No server URL. Set EXPO_PUBLIC_API_URL in mobile/.env.');

  const results = await Promise.all(
    uris.map(async (uri) => {
      const imageBase64 = await toBase64(uri);
      let res: Response;
      try {
        res = await fetch(`${base}/api/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg', lang: 'en', borough: null, hasBrownBin: true }),
          signal,
        });
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e;
        throw new Error(`Can't reach the server at ${base}. Is it running, on the same Wi-Fi?`);
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
        throw new Error(body?.message ?? body?.error ?? `Server error ${res.status}`);
      }
      return (await res.json()) as ScanResponseDTO;
    }),
  );

  return {
    items: results.flatMap((r) => r.items.map((it) => fromScanItem(it, r.scanId))),
    messages: results.filter((r) => r.items.length === 0 && r.message).map((r) => r.message as string),
  };
}
