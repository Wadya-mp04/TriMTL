/**
 * In-memory app state: profile, XP, saved items, the photos being scanned and the last scan result.
 * Starts with the demo profile from the designs (EcoSorter, 320 XP). Nothing is persisted yet and
 * there is no auth backend: sign in / sign up only set the local profile.
 */
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { DEMO_SAVED, SortItem } from '../data/items';

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
  saved: SortItem[];
  photos: string[];
  lastScan: SortItem[];
  games: GameRecord[];
  stats: { games: number; answered: number; correct: number };
  theme: 'forest' | 'ocean' | 'lavender';
  signIn: (name?: string) => void;
  signOut: () => void;
  addXp: (n: number) => void;
  setPhotos: (uris: string[]) => void;
  setLastScan: (items: SortItem[]) => void;
  saveItems: (items: SortItem[]) => void;
  recordGame: (g: Omit<GameRecord, 'when'>) => void;
  setTheme: (t: AppState['theme']) => void;
}

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
  const [lastScan, setLastScan] = useState<SortItem[]>([]);
  const [games, setGames] = useState<GameRecord[]>([
    { title: 'My scanned items', items: 4, correct: 4, when: 'Today' },
    { title: 'Daily challenge', items: 5, correct: 4, when: 'Yesterday' },
  ]);
  const [stats, setStats] = useState({ games: 12, answered: 50, correct: 44 });
  const [theme, setTheme] = useState<AppState['theme']>('forest');

  const addXp = useCallback((n: number) => {
    setXp((v) => v + n);
    setXpToday((v) => v + n);
  }, []);

  const saveItems = useCallback((items: SortItem[]) => {
    setSaved((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      return [...items.filter((i) => !ids.has(i.id)), ...prev];
    });
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
      games,
      stats,
      theme,
      signIn: (name) => name?.trim() && setUsername(name.trim()),
      signOut: () => setUsername('EcoSorter'),
      addXp,
      setPhotos,
      setLastScan,
      saveItems,
      recordGame,
      setTheme,
    }),
    [username, xp, xpToday, saved, photos, lastScan, games, stats, theme, addXp, saveItems, recordGame],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
