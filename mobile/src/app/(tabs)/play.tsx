/**
 * Play, "Let's sort!" (ui-references/.../frosted_mint_play). Tap the right bin, +15 XP per hit.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';

import { TAB_BAR_SPACE } from '../../components/TabBar';
import { BentoBackdrop, Glass, Icon, PrimaryButton, Screen, ScreenHeader, Segmented, Spring, T } from '../../components/ui';
import { DAILY_DECK, SortItem } from '../../data/items';
import { levelFor, useApp } from '../../state/AppState';
import { BIN_ORDER, BinKey, bins, colors, radius, shadow } from '../../theme';

const XP_PER_HIT = 15;
type Mode = 'mine' | 'daily';

export default function PlayScreen() {
  const router = useRouter();
  const { deck: deckParam } = useLocalSearchParams<{ deck?: string }>();
  const { saved, lastScan, addXp, recordGame, xp } = useApp();
  const [mode, setMode] = useState<Mode>('mine');

  const deck: SortItem[] = useMemo(() => {
    if (mode === 'daily') return DAILY_DECK;
    const source = deckParam === 'scan' && lastScan.length ? lastScan : saved;
    const playable = source.filter((i) => i.bin !== null);
    return playable.length ? playable.slice(0, 8) : DAILY_DECK;
  }, [mode, deckParam, lastScan, saved]);

  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<BinKey | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  // New deck (mode switch, or arriving from a scan) → new round.
  useEffect(() => {
    setIdx(0);
    setChosen(null);
    setCorrect(0);
    setDone(false);
  }, [deck]);
  useEffect(() => {
    if (deckParam === 'scan') setMode('mine');
  }, [deckParam]);

  const item = deck[Math.min(idx, deck.length - 1)];
  const isRight = chosen !== null && chosen === item.bin;

  const answer = (bin: BinKey) => {
    if (chosen || done) return;
    setChosen(bin);
    if (bin === item.bin) {
      setCorrect((c) => c + 1);
      addXp(XP_PER_HIT);
    }
  };

  const next = () => {
    if (idx >= deck.length - 1) {
      recordGame({ title: mode === 'daily' ? 'Daily challenge' : 'My scanned items', items: deck.length, correct });
      setDone(true);
      return;
    }
    setIdx((i) => i + 1);
    setChosen(null);
  };

  const restart = () => {
    setIdx(0);
    setChosen(null);
    setCorrect(0);
    setDone(false);
  };

  const progress = done ? 1 : (idx + 1) / deck.length;

  return (
    <Screen edges={['top']}>
      <BentoBackdrop />
      <ScreenHeader eyebrow={`${xp} XP · Level ${levelFor(xp).level}`} title="Let's sort!" />

      <ScrollView contentContainerStyle={styles.main} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 8 }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <T size="xs" weight="semibold" color={colors.inkMuted} style={{ fontVariant: ['tabular-nums'] }}>
              {done ? 'Round complete' : `Item ${idx + 1} of ${deck.length}`}
            </T>
            <Segmented compact options={[{ key: 'mine', label: 'My items' }, { key: 'daily', label: 'Daily' }]} value={mode} onChange={setMode} />
          </View>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.forest }]} />
          </View>
        </View>

        {done ? (
          <Glass style={styles.focal}>
            <View style={[styles.itemIcon, shadow.md]}>
              <Icon name="emoji-events" size={40} color={colors.forest} />
            </View>
            <View style={{ alignItems: 'center' }}>
              <T size="4xl" display style={{ lineHeight: 44, textAlign: 'center' }}>{correct} / {deck.length} sorted</T>
              <T size="xs" color={colors.inkMuted} style={{ marginTop: 4 }}>+{correct * XP_PER_HIT} XP this round</T>
            </View>
            <View style={{ width: '100%', gap: 8, marginTop: 8 }}>
              <PrimaryButton label="Play again" icon="replay" size="md" onPress={restart} />
              <PrimaryButton label="See today's podium" icon="leaderboard" size="md" onPress={() => router.navigate('/community')} style={{ backgroundColor: colors.forest }} />
            </View>
          </Glass>
        ) : (
          <Glass style={styles.focal}>
            <View style={[styles.itemIcon, shadow.md]}>
              <Icon name={item.icon} size={40} color={colors.forest} />
            </View>
            <View style={{ alignItems: 'center' }}>
              <T size="4xl" display style={{ lineHeight: 44, textAlign: 'center' }}>{item.name}</T>
              <T size="xs" color={colors.inkMuted} style={{ marginTop: 4 }}>Tap the right bin below</T>
            </View>
          </Glass>
        )}

        {chosen && !done && (
          <Glass style={styles.feedback}>
            <T size="sm" weight="bold">
              {isRight ? `Nice! +${XP_PER_HIT} XP` : `Correct bin: ${item.bin ? bins[item.bin].label : '—'}`}
            </T>
            <T size="xs" color={colors.inkMuted}>{item.note}</T>
            <PrimaryButton label={idx >= deck.length - 1 ? 'Finish' : 'Next'} size="sm" onPress={next} />
          </Glass>
        )}

        {!done && (
          <View style={{ gap: 12 }}>
            {[BIN_ORDER.slice(0, 2), BIN_ORDER.slice(2)].map((pair) => (
              <View key={pair[0]} style={{ flexDirection: 'row', gap: 12 }}>
                {pair.map((bin) => {
                  const b = bins[bin];
                  const reveal = chosen !== null && (bin === item.bin || bin === chosen);
                  const ring = !reveal ? undefined : bin === item.bin ? b.fg : '#DC2626';
                  return (
                    <Spring
                      key={bin}
                      onPress={() => answer(bin)}
                      accessibilityRole="button"
                      accessibilityLabel={b.label}
                      style={[styles.bin, ring ? { borderColor: ring, borderWidth: 2 } : null]}
                    >
                      <View style={[styles.binIcon, { backgroundColor: b.bg }]}>
                        <Icon name={b.icon} size={22} color={b.fg} />
                      </View>
                      <T size="sm" weight="bold">{b.label}</T>
                    </Spring>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  main: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: TAB_BAR_SPACE, gap: 20 },
  track: { height: 8, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: colors.white, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  focal: { borderRadius: radius['3xl'], padding: 28, minHeight: 208, alignItems: 'center', justifyContent: 'center', gap: 12 },
  itemIcon: { width: 80, height: 80, borderRadius: radius['3xl'], backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  feedback: { borderRadius: radius['2xl'], padding: 14, gap: 8 },
  bin: {
    flex: 1,
    minHeight: 96,
    borderRadius: radius['3xl'],
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.88)',
    boxShadow: '0px 10px 30px -10px rgba(20, 92, 64, 0.12), inset 0px 1px 0px rgba(255, 255, 255, 0.9)',
  },
  binIcon: { width: 40, height: 40, borderRadius: radius['2xl'], alignItems: 'center', justifyContent: 'center' },
});
