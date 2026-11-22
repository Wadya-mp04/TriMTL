/**
 * Play: throw what you scanned into the right Montréal bin (src/game/SortGame).
 * One continuous game in rounds. Round 1 is your own items (today's scan, or your saved items when
 * nothing was scanned today). Round 2 is the challenge: items from earlier days plus items you have
 * never scanned. Later rounds work through the rest of the items, six at a time.
 * +15 XP per item sorted right on the first try; each round is scored out of 100.
 */
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import { type HostInstance, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { TAB_BAR_SPACE } from '../../components/TabBar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, PrimaryButton, T } from '../../components/ui';
import { SortItem } from '../../data/items';
import { Backdrop } from '../../game/Backdrop';
import { DeckEntry, RoundResult, SortGame } from '../../game/SortGame';
import { skyInk, streetDark, THEME_ORDER, THEMES } from '../../game/themes';
import { useApp } from '../../state/AppState';
import { bins, fonts } from '../../theme';

const XP_PER_HIT = 15;
const ROUND_SIZE = 6;

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
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

interface Round { title: string; deck: DeckEntry[] }

/** Round 1: your items. Round 2: earlier scans first, topped up with never-scanned. Then the rest. */
function buildRounds(lastScan: SortItem[], saved: SortItem[], fromScan: boolean, pool: SortItem[]): Round[] {
  const seen = new Set<string>();
  const yours = [...lastScan, ...saved].filter((i) => playable(i) && !seen.has(i.id) && seen.add(i.id));
  const scanned = lastScan.filter(playable);
  const today = yours.filter((i) => isToday(i.scannedAt));
  const first = fromScan && scanned.length ? scanned : today.length ? today : yours;
  const firstIds = new Set(first.map((i) => i.id));
  const past = shuffle(yours.filter((i) => !firstIds.has(i.id))).map((item) => ({ item, origin: 'past' as const }));
  const known = new Set(yours.map((i) => i.name.toLowerCase()));
  const never = shuffle(pool.filter((p) => !known.has(p.name.toLowerCase()))).map((item) => ({ item, origin: 'never' as const }));
  const r2 = [...past.slice(0, 3), ...never.slice(0, ROUND_SIZE - Math.min(3, past.length))];
  const rest = shuffle([...past.slice(3), ...never.slice(ROUND_SIZE - Math.min(3, past.length))]);
  const rounds: Round[] = [];
  if (first.length) rounds.push({ title: 'Your items', deck: first.slice(0, 8).map((item) => ({ item, origin: isToday(item.scannedAt) ? 'today' : 'past' })) });
  for (const d of [shuffle(r2), ...chunk(rest, ROUND_SIZE)]) if (d.length) rounds.push({ title: 'Challenge', deck: d });
  return rounds;
}

export default function PlayScreen() {
  const { deck: deckParam } = useLocalSearchParams<{ deck?: string }>();
  const { saved, lastScan, challengePool, addXp, recordGame, playTheme, setPlayTheme } = useApp();
  const [seed, setSeed] = useState(0);
  const [roundIdx, setRoundIdx] = useState(0);
  const [result, setResult] = useState<RoundResult[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [groundY, setGroundY] = useState(0);
  const theme = THEMES[playTheme];
  const ink = skyInk(theme);
  // Buildings start just below the header, so the title never sits on a facade.
  const headerRef = useRef<HostInstance>(null);
  const [headerBottom, setHeaderBottom] = useState(150);
  const [progress, setProgress] = useState({ index: 0, total: 0 });
  const onProgress = useCallback((index: number, total: number) => setProgress({ index, total }), []);
  const measureHeader = () => headerRef.current?.measureInWindow((_x, y, _w, h) => setHeaderBottom(y + h + 12));

  const rounds = useMemo(
    () => buildRounds(lastScan, saved, deckParam === 'scan', challengePool),
    // `seed` reshuffles everything on "Play again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deckParam, lastScan, saved, challengePool, seed],
  );
  const current = rounds[Math.min(roundIdx, rounds.length - 1)];
  const hasNext = roundIdx < rounds.length - 1;

  const next = () => {
    setResult(null);
    setRoundIdx((i) => i + 1);
  };
  const again = () => {
    setResult(null);
    setRoundIdx(0);
    setSeed((v) => v + 1);
  };
  const onHit = useCallback(() => addXp(XP_PER_HIT), [addXp]);
  const onFinish = useCallback(
    (r: RoundResult[]) => {
      setResult(r);
      const correct = r.filter((x) => x.first).length;
      recordGame({
        title: `Round ${roundIdx + 1}: ${current.title}`, items: r.length, correct,
        mode: current.title === 'Your items' ? 'mine' : 'challenge', xp: correct * XP_PER_HIT, // XP only on a first try
      });
    },
    [roundIdx, current, recordGame],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.lane }}>
      <Backdrop theme={theme} groundY={groundY} landmarkTop={headerBottom} />
      <StatusBar style={theme.key === 'nuit' ? 'light' : 'dark'} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      {/* Same header as the other tabs (small line + serif title), coloured for the neighbourhood's sky. */}
      <View ref={headerRef} onLayout={measureHeader} style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <T size="sm" color={ink} style={{ opacity: 0.75, fontVariant: ['tabular-nums'] }}>
            Round {roundIdx + 1}{!result && progress.total > 0 ? ` · Item ${progress.index + 1} of ${progress.total}` : ''}
          </T>
          <T display color={ink} accessibilityRole="header" style={styles.title}>{current.title}</T>
        </View>
        <Pressable
          onPress={() => setPicking((p) => !p)}
          accessibilityRole="button"
          accessibilityLabel={`Theme: ${theme.name.en}, ${theme.name.fr}. Change theme`}
          accessibilityState={{ expanded: picking }}
          hitSlop={10}
        >
          <Swatch colors={theme.gradient} size={40} ring />
        </Pressable>
      </View>

      <View style={styles.main}>

        {picking && (
          <View style={styles.picker}>
            {THEME_ORDER.map((k) => {
              const t = THEMES[k];
              const on = k === playTheme;
              return (
                <Pressable
                  key={k}
                  onPress={() => { setPlayTheme(k); setPicking(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${t.name.en}, ${t.name.fr}`}
                  hitSlop={6}
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Swatch colors={t.gradient} size={on ? 40 : 32} accent={t.accent} ring={on} />
                </Pressable>
              );
            })}
          </View>
        )}

        {result ? (
          <Results
            results={result}
            accent={theme.accent}
            dark={streetDark(theme)}
            ink={theme.laneInk}
            muted={theme.laneMuted}
            roundNo={roundIdx + 1}
            nextTitle={hasNext ? rounds[roundIdx + 1].title : null}
            onNext={next}
            onAgain={again}
          />
        ) : (
          <SortGame key={`${seed}-${roundIdx}`} deck={current.deck} theme={theme} xpPerHit={XP_PER_HIT} onHit={onHit} onFinish={onFinish} onGround={setGroundY} onProgress={onProgress} />
        )}
      </View>
      </SafeAreaView>
    </View>
  );
}

function Swatch({ colors: [a, b], size, accent, ring }: { colors: [string, string]; size: number; accent?: string; ring?: boolean }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id={`g${a}${b}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={a} />
          <Stop offset="1" stopColor={b} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={size} height={size} rx={size / 2} fill={`url(#g${a}${b})`} />
      {ring && <Rect x="1.5" y="1.5" width={size - 3} height={size - 3} rx={(size - 3) / 2} fill="none" stroke="#FFFFFF" strokeWidth={3} />}
      {accent && <Rect x={size * 0.62} y={size * 0.62} width={size * 0.38} height={size * 0.38} rx={size * 0.19} fill={accent} stroke="#FFFFFF" strokeWidth={2} />}
    </Svg>
  );
}

function Results({ results, accent, dark, ink, muted, roundNo, nextTitle, onNext, onAgain }: {
  results: RoundResult[]; accent: string; dark: boolean; ink: string; muted: string; roundNo: number; nextTitle: string | null; onNext: () => void; onAgain: () => void;
}) {
  const n = results.length, good = results.filter((r) => r.first).length;
  const score = Math.round((good * 100) / n);
  const line = dark ? 'rgba(255,255,255,0.10)' : 'rgba(18,41,31,0.08)';
  return (
    <ScrollView contentContainerStyle={{ gap: 12, paddingTop: 8, paddingBottom: TAB_BAR_SPACE }} showsVerticalScrollIndicator={false}>
      <View style={[styles.sheet, { backgroundColor: dark ? 'rgba(14,20,30,0.9)' : 'rgba(250,250,246,0.92)' }]}>
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <T size="4xl" display color={ink} style={{ fontSize: 76, lineHeight: 80, fontVariant: ['tabular-nums'] }}>
            {score}<T size="2xl" color={muted}>/100</T>
          </T>
          <T size="sm" weight="semibold" color={ink}>
            Round {roundNo}: {good === n ? 'every item in the right bin.' : `${good} right first try, ${n - good} to review.`}
          </T>
          <T size="xs" color={muted} style={{ marginTop: 2 }}>+{good * XP_PER_HIT} XP</T>
        </View>
        {results.map(({ item, first }) => {
          const b = bins[item.bin!];
          return (
            <View key={item.id} style={[styles.guideRow, { borderTopColor: line }]} accessible accessibilityLabel={`${item.name}: ${b.label}. ${item.note} ${first ? 'Right first try.' : 'To review.'}`}>
              <Icon name={b.icon} size={20} color={dark ? '#FFFFFF' : b.deep} />
              <View style={{ flex: 1, gap: 2 }}>
                <T size="sm" weight="bold" color={ink}>
                  {item.name} <T size="sm" color={dark ? '#FFFFFF' : b.deep}>→ {b.label}</T>
                </T>
                <T size="xs" color={muted}>{item.note}</T>
              </View>
              {!first && <T size="xs" weight="bold" color="#D9785E">Review</T>}
            </View>
          );
        })}
      </View>
      {nextTitle ? (
        <PrimaryButton label={`Start round ${roundNo + 1}: ${nextTitle}`} icon="arrow-forward" size="md" onPress={onNext} style={{ backgroundColor: accent }} />
      ) : (
        <T size="sm" color={muted} style={{ textAlign: 'center' }}>That's every item for now.</T>
      )}
      <Pressable onPress={onAgain} accessibilityRole="button" style={{ alignSelf: 'center', padding: 10 }}>
        <T size="sm" weight="semibold" color={ink}>{nextTitle ? 'Start over' : 'Play again'}</T>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Floats over the game so opening it never reflows the board.
  picker: { position: 'absolute', top: 0, right: 12, zIndex: 50, flexDirection: 'row', gap: 4 },
  sheet: { borderRadius: 22, paddingHorizontal: 16, paddingBottom: 6 },
  guideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40 },
  main: { flex: 1, paddingHorizontal: 16, paddingTop: 4, paddingBottom: TAB_BAR_SPACE, gap: 10 },
});
