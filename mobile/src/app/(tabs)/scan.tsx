/**
 * Scan home (ui-references/.../frosted_mint_scan_viewfinder), with a larger viewfinder and scan button.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { TAB_BAR_SPACE } from '../../components/TabBar';
import { SkyBackdrop } from '../../game/Backdrop';
import { skyInk, THEMES } from '../../game/themes';
import {
  CornerBrackets,
  Glass,
  Icon,
  IconBubble,
  Screen,
  ScreenHeader,
  Spring,
  T,
} from '../../components/ui';
import { levelFor, useApp } from '../../state/AppState';
import { colors, radius, shadow } from '../../theme';
import { brand } from '../../brand';

/** Brackets gently "focus" in and out while the icon floats: a calm, camera-like idle state. */
function Viewfinder() {
  const t = useRef(new Animated.Value(0)).current;
  const intro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, intro]);
  const focus = { transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) }] };
  const float = { transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] };
  const rise = { opacity: intro, transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] };
  return (
    <>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, focus]}>
        <CornerBrackets inset={18} size={26} color={`${colors.forest}8C`} />
      </Animated.View>
      <Animated.View style={float}>
        <IconBubble icon="qr-code-scanner" size={76} iconSize={38} />
      </Animated.View>
      <Animated.View style={[{ alignItems: 'center', gap: 6 }, rise]}>
        <T display style={styles.headline}>Point at up to 5 items</T>
        <T size="sm" color={colors.inkMuted}>Instant {brand.city} bin match · 1–3 photos</T>
      </Animated.View>
    </>
  );
}

export default function ScanScreen() {
  const router = useRouter();
  const { saved, username, xp, playTheme } = useApp();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const openCamera = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/camera');
  };

  return (
    <Screen edges={['top']} background={<SkyBackdrop theme={THEMES[playTheme]} />}>
      <View style={styles.page}>
        <ScreenHeader ink={skyInk(THEMES[playTheme])} eyebrow={`${greeting} · Level ${levelFor(xp).level}`} title={`Welcome back, ${username}`} />

        <View style={styles.main}>
          <Glass style={styles.finderCard}>
            <Spring onPress={openCamera} pressedScale={0.99} accessibilityLabel="Open camera" style={styles.finder}>
              <Viewfinder />
            </Spring>

            <Spring onPress={openCamera} accessibilityRole="button" accessibilityLabel="Analyze items" pressedScale={0.97} style={[styles.scanButton, shadow.xl]}>
              <T size="lg" weight="semibold" color={colors.white}>Analyze items</T>
            </Spring>
          </Glass>

          {/* Every scan is saved to the library automatically; this card is the way in. */}
          <Spring onPress={() => router.push('/library')} accessibilityRole="button" accessibilityLabel={`You've sorted ${saved.length} items. Open my library`} pressedScale={0.98} style={styles.impact}>
            <View style={{ flex: 1 }}>
              <T size="xs" color={colors.inkMuted}>You've sorted</T>
              <T size="lg" weight="bold">
                <T size="lg" weight="bold" color={colors.forest}>{saved.length}</T> {saved.length === 1 ? 'item' : 'items'}
              </T>
            </View>
            <View style={[styles.libraryButton, { backgroundColor: colors.forest }]}>
              <T size="sm" weight="semibold" color={colors.white}>My library</T>
              <Icon name="chevron-right" size={18} color={colors.white} />
            </View>
          </Spring>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingBottom: TAB_BAR_SPACE },
  main: { flex: 1, paddingHorizontal: 20, paddingTop: 4, gap: 20 },
  finderCard: { flex: 1, borderRadius: 28, padding: 16, gap: 16 },
  finder: {
    flex: 1,
    minHeight: 220,
    borderRadius: radius['3xl'],
    backgroundColor: 'rgba(18,54,41,0.05)',
    borderWidth: 1,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
    overflow: 'hidden',
  },
  headline: { fontSize: 30, lineHeight: 36, textAlign: 'center', color: colors.ink },
  scanButton: {
    minHeight: 64,
    borderRadius: radius.full,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  impact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius['3xl'],
    paddingVertical: 14,
    paddingLeft: 20,
    paddingRight: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.88)',
    boxShadow: '0px 10px 30px -10px rgba(20, 92, 64, 0.12), inset 0px 1px 0px rgba(255, 255, 255, 0.9)',
  },
  libraryButton: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 44, paddingLeft: 16, paddingRight: 10, borderRadius: radius.full },
});
