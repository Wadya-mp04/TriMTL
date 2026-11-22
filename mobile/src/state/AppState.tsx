/**
 * In-memory app state: profile, XP, saved items, the photos being scanned and the last scan result.
 * Starts with the demo profile from the designs (EcoSorter, 320 XP). Nothing is persisted yet and
 * there is no auth backend: sign in / sign up only set the local profile.
 */
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { DEMO_SAVED, SortItem } from '../data/items';
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
  signIn: (name?: string) => void;
  signOut: () => void;
  addXp: (n: number) => void;
  setPhotos: (uris: string[]) => void;
  setLastScan: (items: SortItem[]) => void;
  recordGame: (g: Omit<GameRecord, 'when'>) => void;
  setArea: (borough: string | null, hasBrownBin: boolean) => void;
  setPlayTheme: (t: ThemeKey) => void;
}

// Apply the white-label default before the first render.
applyTheme(brand.defaultTheme);

const Ctx = createContext<AppState | null>(null);

function initialsOf(name: string) {
  const caps = name.match(/[A-Z]/g);
  if (caps && caps.length >= 2) return (caps[0] + caps[1]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'ES';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState('EcoSorter');
  const [xp, setXp] = useState(320);
  const [xpToday, setXpToday] = useState(75);
  const [saved, setSaved] = useState<SortItem[]>(DEMO_SAVED);
  const [photos, setPhotos] = useState<string[]>([]);
  const [borough, setBorough] = useState<string | null>(null);
  const [hasBrownBin, setHasBrownBin] = useState(true);
  const [games, setGames] = useState<GameRecord[]>([
    { title: 'My scanned items', items: 4, correct: 4, when: 'Today' },
    { title: 'Daily challenge', items: 5, correct: 4, when: 'Yesterday' },
  ]);
  const [stats, setStats] = useState({ games: 12, answered: 50, correct: 44 });
  const [playTheme, setPlayThemeState] = useState<ThemeKey>(brand.defaultTheme);
  const [lastScan, setLastScanRaw] = useState<SortItem[]>([]);

  // Stamp scan time so the game can tell today's items from earlier ones; every scan is saved to the library.
  const setLastScan = useCallback((items: SortItem[]) => {
    const now = new Date().toISOString();
    const stamped = items.map((i) => ({ ...i, scannedAt: i.scannedAt ?? now }));
    setLastScanRaw(stamped);
    setSaved((prev) => {
      const ids = new Set(stamped.map((i) => i.id));
      return [...stamped, ...prev.filter((p) => !ids.has(p.id))];
    });
  }, []);

  const addXp = useCallback((n: number) => {
    setXp((v) => v + n);
    setXpToday((v) => v + n);
  }, []);

  const recordGame = useCallback((g: Omit<GameRecord, 'when'>) => {
    setGames((prev) => [{ ...g, when: 'Today' }, ...prev].slice(0, 5));
    setStats((s) => ({ games: s.games + 1, answered: s.answered + g.items, correct: s.correct + g.correct }));
  }, []);

  const value = useMemo<AppState>(
    () => ({
      username,
      initials: initialsOf(username),
      xp,
      xpToday,
      saved,
      photos,
      lastScan,
      borough,
      hasBrownBin,
      games,
      stats,
      playTheme,
      signIn: (name) => name?.trim() && setUsername(name.trim()),
      signOut: () => setUsername('EcoSorter'),
      addXp,
      setPhotos,
      setLastScan,
      recordGame,
      setArea: (b, brown) => { setBorough(b); setHasBrownBin(brown); },
      setPlayTheme: (t) => { applyTheme(t); setPlayThemeState(t); },
    }),
    [username, xp, xpToday, saved, photos, lastScan, borough, hasBrownBin, games, stats, playTheme, addXp, setLastScan, recordGame],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
