/**
 * Play: throw items into the right Montréal bin (src/game/SortGame).
 * - Today's challenge: the same 6 items for everyone on the same Montréal day (lib/daily). The first one each
 *   day counts for the leaderboard (saved as mode 'daily').
 * - Keep sorting (after today's challenge): unlimited rounds of 6 for XP only: your library items (past mistakes
 *   first), topped up with Montréal items you haven't scanned. Scanning is never required to play.
 * Before today's challenge, a start card floats over the game (the street and bins stay in place behind it);
 * once it's done, Play goes straight into Keep sorting and the header reads "Today's challenge ✓ 57/100".
 * +15 XP per item sorted right on the first try; each round is scored out of 100.
 */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { type HostInstance, ScrollView, StyleSheet, View } from 'react-native';

import { TAB_BAR_SPACE } from '../../components/TabBar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, PrimaryButton, T } from '../../components/ui';
import { resolveItem, SortItem } from '../../data/items';
import { useWorld } from '../../components/World';
import { DeckEntry, RoundResult, SortGame } from '../../game/SortGame';
import { skyInk, streetDark, THEMES } from '../../game/themes';
import { DAILY_SIZE, dailyItems } from '../../lib/daily';
import { useT } from '../../i18n';
import { useApp } from '../../state/AppState';
import { BinKey, bins, colors, fonts, radius } from '../../theme';

const XP_PER_HIT = 15;
const ROUND_SIZE = 6;
/** At most this many of your own items per Keep sorting round; the rest are Montréal items you haven't scanned. */
const MAX_YOURS = 4;
/** Height of the bin labels under the wheels (see SortGame), so the start strip begins below them. */
const LABELS_H = 56;
/** Street bins for players without a brown bin (stable array, so the game's layout isn't recomputed). */
const NO_BROWN_BIN: BinKey[] = ['recycling', 'garbage', 'special'];

const isToday = (iso?: string) => !!iso && new Date(iso).toDateString() === new Date().toDateString();
const playable = (i: SortItem) => i.bin !== null;
function shuffle<T>(a: T[]) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

type Mode = 'daily' | 'practice';
interface Run { id: number; mode: Mode; deck: DeckEntry[] }

/**
 * Today's challenge: the same items for everyone (lib/daily), each resolved for this player's borough and brown bin
 * (the pool from AppState), so only the correct answers adapt to where they live.
 */
function dailyDeck(pool: SortItem[], fits: (i: SortItem) => boolean): DeckEntry[] {
  const resolved = new Map(pool.map((i) => [i.id, i]));
  return dailyItems().map((i) => resolved.get(i.id) ?? i).filter(fits).map((item) => ({ item, origin: 'never' as const }));
}

/** Keep sorting: past mistakes first, then your other items (random), topped up with items you haven't scanned. */
function practiceDeck(lastScan: SortItem[], saved: SortItem[], review: SortItem[], pool: SortItem[], fits: (i: SortItem) => boolean): DeckEntry[] {
  const seen = new Set<string>();
  const fresh = (i: SortItem) => playable(i) && fits(i) && !seen.has(i.id) && !!seen.add(i.id);
  const mistakes = review.filter(fresh);
  const yours = shuffle([...lastScan, ...saved].filter(fresh));
  const mine = [...mistakes, ...yours].slice(0, MAX_YOURS);
  const known = new Set([...lastScan, ...saved, ...mine].map((i) => i.name.toLowerCase()));
  const never = shuffle(pool.filter((p) => playable(p) && fits(p) && !known.has(p.name.toLowerCase())));
  return shuffle([
    ...mine.map((item) => ({ item, origin: (isToday(item.scannedAt) ? 'today' : 'past') as DeckEntry['origin'] })),
    ...never.slice(0, ROUND_SIZE - mine.length).map((item) => ({ item, origin: 'never' as const })),
  ]);
}

export default function PlayScreen() {
  const { saved, lastScan, challengePool, hasBrownBin, borough, lang, addXp, recordGame, playTheme, dailyDone, dailyKnown } = useApp();
  const { t } = useT();
  // No brown bin: the compost bin is hidden, so leave out anything only it could take.
  const fits = useCallback((i: SortItem) => hasBrownBin || i.bin !== 'compost', [hasBrownBin]);
  const [run, setRun] = useState<Run | null>(null); // null = start card showing
  const [result, setResult] = useState<RoundResult[] | null>(null);
  const [review, setReview] = useState<SortItem[]>([]); // items got wrong, played again until right
  // Re-worked for the current language and area, like every other list (they're kept as they were when missed).
  const reviewNow = useMemo(() => review.map((i) => resolveItem(i, { borough, hasBrownBin }, lang)), [review, borough, hasBrownBin, lang]);
  const nextId = useRef(1);
  // The street itself is drawn by the shared world (components/World); Play tells it where things are.
  const world = useWorld();
  // The game re-renders for a new theme in a later, low-priority pass, so the visible crossfade stays smooth.
  const theme = THEMES[useDeferredValue(playTheme)];
  const ink = skyInk(theme);
  // Buildings start just below the header, so the title never sits on a facade.
  const headerRef = useRef<HostInstance>(null);
  const [progress, setProgress] = useState({ index: 0, total: 0 });
  const onProgress = useCallback((index: number, total: number) => setProgress({ index, total }), []);
  const measureHeader = () => headerRef.current?.measureInWindow((_x, y, _w, h) => world.setLandmarkTop(y + h + 12));
  // Where the bins stand and where the game area starts (window px), to place the start strip under the labels.
  const gameRef = useRef<HostInstance>(null);
  const [gameTop, setGameTop] = useState(0);
  const [ground, setGround] = useState(0);
  const onGround = useCallback((y: number) => { world.setGroundY(y); setGround(y); }, [world]);
  const measureGame = () => gameRef.current?.measureInWindow((_x, y) => setGameTop(y));
  // Bin labels sit just under the wheels; the strip starts below them (fallback: lower 40%).
  const stripTop = ground > 0 && gameTop > 0 ? ground - gameTop + LABELS_H : undefined;

  // What the start card would begin: today's challenge if not done yet, otherwise Keep sorting.
  const upcoming = useMemo<Run>(
    () => (dailyDone
      ? { id: 0, mode: 'practice', deck: practiceDeck(lastScan, saved, reviewNow, challengePool, fits) }
      : { id: 0, mode: 'daily', deck: dailyDeck(challengePool, fits) }),
    // Rebuilt when today's status or the player's area changes; the scanned/saved lists only matter at the next start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dailyDone, challengePool, fits],
  );
  const start = (r: Omit<Run, 'id'>) => {
    setResult(null);
    setRun({ ...r, id: nextId.current++ });
  };
  const keepSorting = () => start({ mode: 'practice', deck: practiceDeck(lastScan, saved, reviewNow, challengePool, fits) });

  // Today's challenge already done: Play is simply the game (Keep sorting), no start card.
  // Not done but a Keep sorting run is up (another account signed in, or Montréal midnight): back to the start card.
  useEffect(() => {
    if (!dailyKnown) return;
    if (dailyDone && !run) keepSorting();
    else if (!dailyDone && run?.mode === 'practice') { setRun(null); setResult(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyKnown, dailyDone, run]);


  const current = run ?? upcoming;
  const counts = current.mode === 'daily' && !dailyDone;
  const onHit = useCallback(() => addXp(XP_PER_HIT), [addXp]);
  const onFinish = useCallback(
    (r: RoundResult[]) => {
      setResult(r);
      const correct = r.filter((x) => x.first).length;
      setReview((prev) => {
        const right = new Set(r.filter((x) => x.first).map((x) => x.item.id));
        const wrong = r.filter((x) => !x.first).map((x) => x.item);
        const keep = prev.filter((i) => !right.has(i.id) && !wrong.some((w) => w.id === i.id));
        return [...wrong, ...keep];
      });
      recordGame({
        title: counts ? "Today's challenge" : 'Keep sorting', items: r.length, correct,
        // Only the first daily round of the day is saved as 'daily' (it counts for the leaderboard).
        mode: counts ? 'daily' : 'mine', xp: correct * XP_PER_HIT, // XP only on a first try
      });
    },
    [counts, recordGame],
  );

  const title = current.mode === 'daily' ? "Today's challenge" : 'Keep sorting';
  const playing = !!run && !result && progress.total > 0;
  // Items still to place in this round (including the one in hand), shown as a pill in the header.
  const left = progress.total - progress.index;
  // Once today's challenge is done, the header always says so in plain words, with the score.
  const eyebrow = dailyDone && current.mode === 'practice'
    ? t("Today's challenge ✓ {score}/100", { score: dailyDone.score })
    : current.mode === 'daily' ? t('{n} {city} items · same for everyone', { n: DAILY_SIZE, city: 'Montréal' }) : t('Your items + tricky ones · XP only');

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      {/* Same header as the other tabs (small line + serif title), coloured for the neighbourhood's sky. */}
      <View ref={headerRef} onLayout={measureHeader} style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <T size="sm" color={ink} style={{ opacity: 0.75, fontVariant: ['tabular-nums'] }}>{eyebrow}</T>
          <T display color={ink} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.title}>{t(title)}</T>
        </View>
        {playing && (
          <View style={styles.leftPill} accessible accessibilityLabel={t(left === 1 ? '{n} item left to sort' : '{n} items left to sort', { n: left })}>
            <T size="xs" weight="bold" style={{ fontVariant: ['tabular-nums'] }}>{t('{n} left', { n: left })}</T>
          </View>
        )}
      </View>

      <View style={styles.main}>


        {result ? (
          <Results
            results={result}
            accent={theme.accent}
            dark={streetDark(theme)}
            ink={theme.laneInk}
            muted={theme.laneMuted}
            label={t(current.mode === 'daily' ? "Today's challenge" : 'This round')}
            counted={current.mode === 'daily'}
            onKeepSorting={keepSorting}
          />
        ) : (
          <View ref={gameRef} onLayout={measureGame} collapsable={false} style={{ flex: 1 }}>
            <SortGame key={run?.id ?? `preview-${current.mode}`} deck={current.deck} theme={theme} xpPerHit={XP_PER_HIT} onHit={onHit} onFinish={onFinish} onGround={onGround} onProgress={onProgress} shownBins={hasBrownBin ? undefined : NO_BROWN_BIN} />
            {!run && (
              // Before today's challenge: a plain strip in the ground colour covers the item area (above the game's own
              // layers, so nothing shows through), with just the start button. Bins stay visible above it.
              // While today's saved result loads, or Keep sorting starts, the strip shows without the button.
              <View collapsable={false} style={[StyleSheet.absoluteFill, styles.blocker]}>
                <View style={[styles.strip, stripTop !== undefined ? { top: stripTop } : { top: '60%' }, { backgroundColor: theme.lane }]}>
                  {dailyKnown && !dailyDone && (
                    <PrimaryButton label={t("Start today's challenge")} icon="play-arrow" onPress={() => start({ mode: 'daily', deck: dailyDeck(challengePool, fits) })} style={styles.startButton} />
                  )}
                </View>
              </View>
            )}
          </View>
        )}
      </View>
      </SafeAreaView>
    </View>
  );
}


function Results({ results, accent, dark, ink, muted, label, counted, onKeepSorting }: {
  results: RoundResult[]; accent: string; dark: boolean; ink: string; muted: string; label: string; counted: boolean; onKeepSorting: () => void;
}) {
  const { t, binLabel } = useT();
  const n = results.length, good = results.filter((r) => r.first).length;
  const score = Math.round((good * 100) / n);
  const wrong = n - good;
  const line = dark ? 'rgba(255,255,255,0.10)' : 'rgba(18,41,31,0.08)';
  return (
    <View style={{ flex: 1 }}>
    {/* The sorted items scroll; Keep sorting stays pinned just above the tab bar. */}
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingTop: 8, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
      <View style={[styles.sheet, { backgroundColor: dark ? 'rgba(14,20,30,0.9)' : 'rgba(250,250,246,0.92)' }]}>
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <T size="4xl" display color={ink} style={{ fontSize: 76, lineHeight: 80, fontVariant: ['tabular-nums'] }}>
            {score}<T size="2xl" color={muted}>/100</T>
          </T>
          <T size="sm" weight="semibold" color={ink}>
            {label}: {good === n ? t('every item in the right bin.') : t('{good} right first try, {review} to review.', { good, review: n - good })}
          </T>
          <T size="xs" color={muted} style={{ marginTop: 2 }}>{counted ? t("Saved to today's leaderboard") : `+${good * XP_PER_HIT} XP`}</T>
        </View>
        {results.map(({ item, first }) => {
          const b = bins[item.bin!];
          return (
            <View key={item.id} style={[styles.guideRow, { borderTopColor: line }]} accessible accessibilityLabel={`${item.name}: ${binLabel(item.bin!)}. ${item.note} ${t(first ? 'Right first try.' : 'To review.')}`}>
              <Icon name={b.icon} size={20} color={dark ? '#FFFFFF' : b.deep} />
              <View style={{ flex: 1, gap: 2 }}>
                <T size="sm" weight="bold" color={ink}>
                  {item.name} <T size="sm" color={dark ? '#FFFFFF' : b.deep}>→ {binLabel(item.bin!)}</T>
                </T>
                <T size="xs" color={muted}>{item.note}</T>
              </View>
              {!first && <T size="xs" weight="bold" color="#D9785E">{t('Review')}</T>}
            </View>
          );
        })}
      </View>
      {!!wrong && <T size="xs" color={muted} style={{ textAlign: 'center' }}>{t('Items to review come back in your next round.')}</T>}
    </ScrollView>
    <PrimaryButton label={t('Keep sorting')} icon="replay" size="md" onPress={onKeepSorting} style={{ backgroundColor: accent, marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { borderRadius: 22, paddingHorizontal: 16, paddingBottom: 6 },
  guideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40 },
  main: { flex: 1, paddingHorizontal: 16, paddingTop: 4, paddingBottom: TAB_BAR_SPACE, gap: 10 },
  // zIndex/elevation above SortGame's item layer (zIndex 30), so the item never draws over the strip.
  blocker: { zIndex: 100, elevation: 100 },
  leftPill: { height: 28, paddingHorizontal: 10, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.85)' },
  strip: { position: 'absolute', left: -16, right: -16, bottom: -TAB_BAR_SPACE, alignItems: 'center', justifyContent: 'center', paddingBottom: TAB_BAR_SPACE },
  startButton: { width: 'auto', alignSelf: 'center', paddingHorizontal: 28 },
});
