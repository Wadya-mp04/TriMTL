/**
 * Retry a Supabase write while the network is down. supabase-js reports a dropped connection as
 * status 0 (no answer at all); any other error (permission, constraint) is final and is not retried.
 * Only use it for writes keyed by client_key (see supabase/migrations/…_client_keys.sql): a retry may
 * repeat a write that already landed, and the key makes the database ignore the copy.
 *
 * shortcut: retries live in memory for about 5 minutes; if the app is closed or offline longer the
 * write is dropped. Upgrade to a queue in AsyncStorage when offline play matters.
 */
type WriteResult = { error: { message: string } | null; status: number };

/**
 * Waits before each retry: 2, 4, 8 s, then every 15 s, about 5 minutes in total. Capped at 15 s so a
 * write goes through within 15 s of the phone coming back online (e.g. after airplane mode).
 */
export const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, ...Array<number>(19).fill(15_000)];

/**
 * Run `write`, retrying on network failure.
 * @returns null on success, or the last error message (already logged as a warning).
 */
export async function withRetry(
  what: string,
  write: () => PromiseLike<WriteResult>,
  wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
): Promise<string | null> {
  for (let attempt = 0; ; attempt++) {
    const { error, status } = await write();
    if (!error) return null;
    if (status !== 0 || attempt >= RETRY_DELAYS_MS.length) {
      console.warn(`${what} failed:`, error.message);
      return error.message;
    }
    console.log(`${what}: offline, retry ${attempt + 1} in ${RETRY_DELAYS_MS[attempt] / 1000} s`);
    await wait(RETRY_DELAYS_MS[attempt]);
  }
}
