import type { SupabaseClient } from '@supabase/supabase-js';

export interface ScanRow {
  id: number;
  rule_id: string | null;
  category: string | null;
  name: string;
  count: number;
  client_key: string | null;
  scanned_at: string;
}

/** Read metadata in bounded pages. An id cursor avoids gaps when new scans arrive during loading. */
export async function loadScanHistory(client: SupabaseClient, userId: string, signal: AbortSignal): Promise<ScanRow[]> {
  const rows: ScanRow[] = [];
  let before: number | undefined;
  while (!signal.aborted) {
    let request = client.from('scanned_items')
      .select('id, rule_id, category, name, count, client_key, scanned_at')
      .eq('user_id', userId).order('id', { ascending: false }).limit(200);
    if (before !== undefined) request = request.lt('id', before);
    const { data, error } = await request.abortSignal(signal);
    if (error) throw error;
    const page = data as ScanRow[];
    rows.push(...page);
    if (page.length < 200) return rows.sort((a, b) => b.scanned_at.localeCompare(a.scanned_at) || b.id - a.id);
    before = page[page.length - 1].id;
  }
  return [];
}
