/**
 * AI loading (ui-references/.../frosted_mint_ai_loading). Sends the photos to POST /api/scan.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, View } from 'react-native';

import { scanPhotos } from '../api/scan';
import { CircleButton, Glass, Icon, Pill, PrimaryButton, Screen, T } from '../components/ui';
import { DEMO_SCAN } from '../data/items';
import { tipOfTheDay } from '../data/rules';
import { useApp } from '../state/AppState';
import { bins, colors, radius, shadow } from '../theme';

type Phase = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'empty'; message: string };

export default function AnalyzingScreen() {
  const router = useRouter();
  const { photos, setLastScan, borough, hasBrownBin } = useApp();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const abort = useRef<AbortController | null>(null);

  const pulse = useRef(new Animated.Value(1)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const b = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }));
    a.start();
    b.start();
    return () => { a.stop(); b.stop(); };
  }, [pulse, sweep]);

  const run = useCallback(async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setPhase({ kind: 'loading' });
    try {
      const { items, messages } = await scanPhotos(photos, { borough, hasBrownBin }, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (items.length === 0) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setPhase({ kind: 'empty', message: messages[0] ?? 'No items to sort were found. Move closer and try again.' });
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLastScan(items);
      router.replace('/results');
    } catch (e) {
      if (ctrl.signal.aborted) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPhase({ kind: 'error', message: (e as Error).message });
    }
  }, [photos, borough, hasBrownBin, router, setLastScan]);

  useEffect(() => {
    run();
    return () => abort.current?.abort();
  }, [run]);

  const showDemo = () => {
    setLastScan(DEMO_SCAN);
    router.replace('/results');
  };

  const loading = phase.kind === 'loading';
  const tip = tipOfTheDay(new Date(), { borough, hasBrownBin });
  const barLeft = sweep.interpolate({ inputRange: [0, 1], outputRange: ['-50%', '100%'] });

  return (
    <Screen style={styles.root}>
      <View style={styles.header}>
        <CircleButton icon="close" label="Cancel analysis" onPress={() => router.back()} />
        <Pill><T size="xs" weight="semibold" color={colors.forest}>Gemini Vision</T></Pill>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.main}>
        <View style={styles.thumbs}>
          {photos.map((uri) => (
            <Glass key={uri} style={styles.thumb}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} />
            </Glass>
          ))}
        </View>

        <Glass style={styles.card}>
          <Animated.View style={[styles.spark, shadow.lg, { opacity: loading ? pulse : 1, backgroundColor: loading ? colors.forest : colors.inkMuted }]}>
            <Icon name={loading ? 'auto-awesome' : phase.kind === 'empty' ? 'search-off' : 'cloud-off'} size={32} color={colors.white} />
          </Animated.View>
          <View style={{ alignItems: 'center' }}>
            <T size="3xl" display style={{ textAlign: 'center', lineHeight: 38 }}>
              {loading ? 'Identifying your items...' : phase.kind === 'empty' ? 'Nothing to sort here' : "Couldn't analyze"}
            </T>
            <T size="xs" color={colors.inkMuted} style={{ marginTop: 6, textAlign: 'center' }}>
              {loading ? "We're checking what you've scanned." : phase.message}
            </T>
          </View>
          {loading && (
            <View style={styles.track}>
              <Animated.View style={[styles.bar, { left: barLeft, backgroundColor: colors.forest }]} />
            </View>
          )}
        </Glass>

        {loading && (
          <Glass style={styles.tip}>
            <T size="xs" weight="bold" color={colors.forest} style={{ letterSpacing: 0.6 }}>DID YOU KNOW?</T>
            <T size="sm" weight="semibold" style={{ textAlign: 'center' }}>
              {tip.name} → <T size="sm" weight="semibold" color={bins[tip.bin].deep}>{tip.where ?? bins[tip.bin].label}</T>
            </T>
            <T size="xs" color={colors.inkMuted} style={{ textAlign: 'center' }}>{tip.text}</T>
          </Glass>
        )}

        {phase.kind === 'empty' && (
          <PrimaryButton label="Take another photo" size="sm" onPress={() => router.replace('/camera')} style={styles.cta} />
        )}
        {phase.kind === 'error' && (
          <PrimaryButton label="See demo results instead" size="sm" onPress={showDemo} style={styles.cta} />
        )}
      </View>

      <Pressable onPress={run} disabled={loading} style={styles.retry}>
        <T size="xs" weight="semibold" color={colors.inkMuted} style={{ opacity: loading ? 0.6 : 1 }}>
          Having trouble? Retry analysis
        </T>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingVertical: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  thumbs: { flexDirection: 'row', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: radius['2xl'], overflow: 'hidden' },
  card: { width: '100%', borderRadius: radius['3xl'], padding: 28, alignItems: 'center', gap: 16 },
  spark: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  track: { width: '100%', height: 8, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.8)', overflow: 'hidden' },
  bar: { position: 'absolute', top: 0, bottom: 0, width: '50%', borderRadius: radius.full },
  cta: { width: 'auto', paddingHorizontal: 24 },
  retry: { alignSelf: 'center', paddingVertical: 8 },
  tip: { alignSelf: 'stretch', alignItems: 'center', gap: 4, padding: 16, borderRadius: radius['2xl'] },
});
