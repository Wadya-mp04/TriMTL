/**
 * App state: profile, XP, saved items, the photos being scanned and the last scan result.
 * Starts with the demo profile from the designs (EcoSorter, 320 XP).
 * With Supabase configured (src/lib/supabase.ts), sign in / sign up use real accounts, the profile shows
 * the user's own totals, and saved scans and finished rounds are written to their rows (retried when the
 * network drops). Without it, everything stays local (demo mode).
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { CHALLENGE_POOL, DEMO_SAVED, fromRule, Lang, resolveItem, SortItem } from '../data/items';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { montrealDay } from '../lib/daily';
import { withRetry } from '../lib/retry';
import { supabase } from '../lib/supabase';
import { brand } from '../brand';
import { applyTheme, ThemeKey } from '../theme';

export interface GameRecord {
  title: string;
  items: number;
  correct: number;
  when: string;
}

/** Level thresholds: Level 3 runs 200 → 500 XP, so 320 XP shows "320 / 500" like the design. */
const LEVELS = [0, 100, 200, 500, 800, 1200, 1700, 2300, 3000];

export function levelFor(xp: number) {
  let level = 1;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) level = i + 1;
  const next = LEVELS[level] ?? LEVELS[LEVELS.length - 1] + 1000;
  return { level, next, progress: Math.min(1, xp / next) };
}

interface AppState {
  username: string;
  initials: string;
  xp: number;
  xpToday: number;
  /** The library: every item the user has scanned, newest first (auto-saved; Supabase will store it per user). */
  saved: SortItem[];
  photos: string[];
  lastScan: SortItem[];
  /** Borough slug from quebecRules.json, or null for the city-wide default. */
  borough: string | null;
  hasBrownBin: boolean;
  games: GameRecord[];
  stats: { games: number; answered: number; correct: number };
  /** Neighbourhood theme: the game's street scene and the app's colours. */
  playTheme: ThemeKey;
  /** Supabase user id, or null when signed out or in demo mode. */
  userId: string | null;
  /** Each returns an error message to show, or null on success. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (username: string, email: string, password: string) => Promise<string | null>;
  signOut: () => void;
  addXp: (n: number) => void;
  setPhotos: (uris: string[]) => void;
  setLastScan: (items: SortItem[]) => void;
  /** Challenge-round items the player may never have scanned, answered for their area. */
  challengePool: SortItem[];
  saveItems: (items: SortItem[]) => void;
  recordGame: (g: Omit<GameRecord, 'when'> & { mode: GameMode; xp: number }) => void;
  setArea: (borough: string | null, hasBrownBin: boolean) => void;
  /** Language of rule and scan text (FR/EN). Kept on this phone; the app's own labels stay English. */
  lang: Lang;
  setLang: (l: Lang) => void;
  setPlayTheme: (t: ThemeKey) => void;
  /** Today's daily challenge result (Montréal day), or null if not played yet today. */
  dailyDone: { day: string; score: number } | null;
  /** False until today's saved daily result has been read, so Play never shows the wrong start state. */
  dailyKnown: boolean;
}

// Apply the white-label default before the first render.
applyTheme(brand.defaultTheme);

const Ctx = createContext<AppState | null>(null);

const LANG_KEY = 'trimtl.lang';

/** Round types stored in game_scores.mode. */
export type GameMode = 'mine' | 'daily' | 'challenge';
const TITLES: Record<GameMode, string> = { mine: 'Your items', daily: 'Daily challenge', challenge: 'Challenge' };

/** The demo profile from the designs, shown when signed out or without Supabase. */
const DEMO = {
  username: 'EcoSorter',
  xp: 320,
  xpToday: 75,
  games: [
    { title: 'My scanned items', items: 4, correct: 4, when: 'Today' },
    { title: 'Daily challenge', items: 5, correct: 4, when: 'Yesterday' },
  ] as GameRecord[],
  stats: { games: 12, answered: 50, correct: 44 },
};

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return 'Today';
  if (d.toDateString() === new Date(Date.now() - 86_400_000).toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}

/** Two-letter avatar initials: "EcoSorter" -> "ES", "alice" -> "AL". */
export function initialsOf(name: string) {
  const caps = name.match(/[A-Z]/g);
  if (caps && caps.length >= 2) return (caps[0] + caps[1]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'ES';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState(DEMO.username);
  const [xp, setXp] = useState(DEMO.xp);
  const [xpToday, setXpToday] = useState(DEMO.xpToday);
  // Raw items keep their rule id; `saved` / `lastScan` below are re-worked for the current area.
  const [savedRaw, setSaved] = useState<SortItem[]>(DEMO_SAVED);
  const [photos, setPhotos] = useState<string[]>([]);
  const [borough, setBorough] = useState<string | null>(null);
  const [hasBrownBin, setHasBrownBin] = useState(true);
  const [lang, setLangState] = useState<Lang>('en');
  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((v) => { if (v === 'fr' || v === 'en') setLangState(v); }).catch(() => {});
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l).catch(() => {}); // a failed write only means English after a restart
  }, []);
  const [games, setGames] = useState<GameRecord[]>(DEMO.games);
  const [stats, setStats] = useState(DEMO.stats);
  const [playTheme, setPlayThemeState] = useState<ThemeKey>(brand.defaultTheme);
  const [lastScanRaw, setLastScanRaw] = useState<SortItem[]>([]);
  const [dailyResult, setDailyResult] = useState<{ day: string; score: number } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [dailyKnown, setDailyKnown] = useState(false);
  // The Montréal day, re-checked every 30 s so a new challenge appears at midnight without a restart.
  const [day, setDay] = useState(montrealDay);
  useEffect(() => {
    const t = setInterval(() => setDay(montrealDay()), 30_000);
    return () => clearInterval(t);
  }, []);
  // Today's daily result is kept on the phone per user, so restarting the app can't reset it.
  const dailyKey = `trimtl.daily.${userId ?? 'demo'}`;
  useEffect(() => {
    let alive = true;
    setDailyKnown(false);
    setDailyResult(null);
    AsyncStorage.getItem(dailyKey)
      .then((raw) => {
        const r = raw ? (JSON.parse(raw) as { day: string; score: number }) : null;
        if (alive && r?.day === montrealDay()) setDailyResult(r);
      })
      .catch(() => {})
      .finally(() => { if (alive) setDailyKnown(true); });
    return () => { alive = false; };
  }, [dailyKey]);
  const keepDaily = useCallback((r: { day: string; score: number }) => {
    setDailyResult(r);
    AsyncStorage.setItem(dailyKey, JSON.stringify(r)).catch(() => {});
  }, [dailyKey]);
  // Last user the profile was loaded for (undefined = not loaded yet).
  const loadedFor = useRef<string | null | undefined>(undefined);

  // Follow sign-in / sign-out; INITIAL_SESSION on subscribe restores a saved login at launch.
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    const apply = async (id: string | null) => {
      // Token refreshes re-send the same user: reloading would reset the XP of a round in progress.
      if (id === loadedFor.current) return;
      loadedFor.current = id;
      setUserId(id);
      if (!id) {
        setUsername(DEMO.username); setXp(DEMO.xp); setXpToday(DEMO.xpToday); setGames(DEMO.games); setStats(DEMO.stats);
        setSaved(DEMO_SAVED); setLastScanRaw([]);
        return;
      }
      // Scoreboard: the signed-in user's own totals, recent rounds and today's XP (RLS limits it to them).
      const [profile, totals, recent, board, scans, daily] = await Promise.all([
        sb.from('profiles').select('username').eq('id', id).single(),
        sb.from('player_stats').select('games, answered, correct, xp').maybeSingle(),
        sb.from('game_scores').select('mode, items, correct, played_at').order('played_at', { ascending: false }).limit(5),
        sb.rpc('leaderboard', { scope: 'friends' }),
        // shortcut: the newest 200 scans only; page through them if a library ever gets bigger.
        sb.from('scanned_items').select('id, rule_id, category, name, count, client_key, scanned_at')
          .order('scanned_at', { ascending: false }).limit(200),
        sb.from('game_scores').select('items, correct, played_at').eq('mode', 'daily').order('played_at', { ascending: true }).limit(20),
      ]);
      if (loadedFor.current !== id) return; // signed out or switched user while loading: drop the stale reply
      if (profile.data?.username) setUsername(profile.data.username);
      const t = totals.data;
      setXp(t?.xp ?? 0);
      setStats({ games: t?.games ?? 0, answered: t?.answered ?? 0, correct: t?.correct ?? 0 });
      setGames((recent.data ?? []).map((g: { mode: GameMode; items: number; correct: number; played_at: string }) =>
        ({ title: TITLES[g.mode] ?? g.mode, items: g.items, correct: g.correct, when: dayLabel(g.played_at) })));
      const me = (board.data as { xp_today: number; is_me: boolean }[] | null)?.find((r) => r.is_me);
      setXpToday(me?.xp_today ?? 0);
      // Today's daily challenge, from any device: the first daily round played today (Montréal day) is the one that counts.
      const today = montrealDay();
      const first = (daily.data as { items: number; correct: number; played_at: string }[] | null)?.find((r) => montrealDay(new Date(r.played_at)) === today);
      // Only ever marks the day as done (a local result not yet synced is kept).
      if (first) {
        const r = { day: today, score: Math.round((first.correct * 100) / Math.max(1, first.items)) };
        setDailyResult(r);
        AsyncStorage.setItem(`trimtl.daily.${id}`, JSON.stringify(r)).catch(() => {}); // this user's key (not a stale closure)
      }
      // The library follows the account: saved scans come back, and the engine decides their bins.
      type ScanRow = { id: number; rule_id: string | null; category: string | null; name: string; count: number; client_key: string | null; scanned_at: string };
      if (!scans.error) {
        setSaved((scans.data as ScanRow[]).map((r) =>
          fromRule(r.client_key ?? `db:${r.id}`, r.rule_id, r.name, { category: r.category, count: r.count, scannedAt: r.scanned_at })));
      }
    };
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => { apply(session?.user.id ?? null); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return null; // demo mode: any input enters
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? error.message : null;
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    if (!supabase) {
      if (name.trim()) setUsername(name.trim());
      return null;
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password, options: { data: { username: name.trim() } },
    });
    if (error) return error.message.includes('Database error') ? 'That username is taken or invalid (3–24 letters, numbers, . _ -).' : error.message;
    // With "Confirm email" on in Supabase Auth, sign-up returns no session until the link is clicked.
    return data.session ? null : 'Check your email to confirm your account, then sign in.';
  }, []);

  const signOut = useCallback(() => {
    supabase?.auth.signOut(); // onAuthStateChange then restores the demo profile
    if (!supabase) setUsername(DEMO.username);
  }, []);

  const addXp = useCallback((n: number) => {
    setXp((v) => v + n);
    setXpToday((v) => v + n);
  }, []);

  const saveItems = useCallback((items: SortItem[]) => {
    setSaved((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      const now = new Date().toISOString();
      return [...items.filter((i) => !ids.has(i.id)).map((i) => ({ ...i, scannedAt: i.scannedAt ?? now })), ...prev];
    });
    const real = items.filter((i) => !i.demo && i.ruleId !== undefined);
    if (!supabase || !userId || !real.length) return;
    // Store the rule id and context, not the bin: the rules engine decides the bin when it is played.
    // client_key = the item's scan-unique id, so a retry after a dropped connection can't save it twice.
    const rows = real.map((i) => ({
      rule_id: i.ruleId, category: i.category, name: i.name, count: i.count ?? 1,
      borough, has_brown_bin: hasBrownBin, client_key: i.id,
    }));
    const sb = supabase;
    withRetry('save scans', () => sb.from('scanned_items').upsert(rows, { onConflict: 'user_id,client_key', ignoreDuplicates: true }));
  }, [userId, borough, hasBrownBin]);

  // Stamp scan time so the game can tell today's items from earlier ones; every scan is saved to the
  // library automatically (and to Supabase when signed in), newest first.
  const setLastScan = useCallback((items: SortItem[]) => {
    const now = new Date().toISOString();
    const stamped = items.map((i) => ({ ...i, scannedAt: i.scannedAt ?? now }));
    setLastScanRaw(stamped);
    saveItems(stamped);
  }, [saveItems]);

  const recordGame = useCallback((g: Omit<GameRecord, 'when'> & { mode: GameMode; xp: number }) => {
    // Only the first daily round of the day counts; replays are recorded as normal rounds by Play.
    if (g.mode === 'daily' && dailyResult?.day !== montrealDay()) keepDaily({ day: montrealDay(), score: Math.round((g.correct * 100) / Math.max(1, g.items)) });
    setGames((prev) => [{ title: g.title, items: g.items, correct: g.correct, when: 'Today' }, ...prev].slice(0, 5));
    setStats((s) => ({ games: s.games + 1, answered: s.answered + g.items, correct: s.correct + g.correct }));
    if (!supabase || !userId) return;
    // One key per round, reused by every retry, so a round is never counted twice.
    const row = { mode: g.mode, items: g.items, correct: g.correct, xp: g.xp, client_key: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    const sb = supabase;
    withRetry('save score', () => sb.from('game_scores').upsert(row, { onConflict: 'user_id,client_key', ignoreDuplicates: true }));
  }, [userId, dailyResult, keepDaily]);

  // Changing brown bin or borough re-sorts everything at once: saved items, the last scan, the game.
  const saved = useMemo(() => savedRaw.map((i) => resolveItem(i, { borough, hasBrownBin }, lang)), [savedRaw, borough, hasBrownBin, lang]);
  const lastScan = useMemo(() => lastScanRaw.map((i) => resolveItem(i, { borough, hasBrownBin }, lang)), [lastScanRaw, borough, hasBrownBin, lang]);
  const challengePool = useMemo(() => CHALLENGE_POOL.map((i) => resolveItem(i, { borough, hasBrownBin }, lang)), [borough, hasBrownBin, lang]);

  const value = useMemo<AppState>(
    () => ({
      username,
      initials: initialsOf(username),
      xp,
      xpToday,
      saved,
      photos,
      lastScan,
      challengePool,
      borough,
      hasBrownBin,
      games,
      stats,
      playTheme,
      userId,
      signIn,
      signUp,
      signOut,
      addXp,
      setPhotos,
      setLastScan,
      saveItems,
      recordGame,
      dailyDone: dailyResult?.day === day ? dailyResult : null,
      dailyKnown,
      setArea: (b, brown) => { setBorough(b); setHasBrownBin(brown); },
      lang,
      setLang,
      // Immediate, so the tapped tile and the background crossfade respond in the same frame; the heavy
      // street and game take the change later (useDeferredValue in components/World and Play).
      setPlayTheme: (t) => { applyTheme(t); setPlayThemeState(t); },
    }),
    [username, xp, xpToday, saved, photos, lastScan, challengePool, borough, hasBrownBin, lang, setLang, games, stats, playTheme, userId, signIn, signUp, signOut, addXp, setLastScan, saveItems, recordGame, dailyResult, dailyKnown, day],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
