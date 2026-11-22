/**
 * Scan home (ui-references/.../frosted_mint_scan_viewfinder), with a larger viewfinder and scan button.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { TAB_BAR_SPACE } from '../../components/TabBar';
import {
  CornerBrackets,
  Glass,
  Icon,
  Screen,
  ScreenHeader,
  Spring,
  T,
} from '../../components/ui';
import { skyInk, THEMES } from '../../game/themes';
import { useT } from '../../i18n';
import { levelFor, useApp } from '../../state/AppState';
import { colors, radius, shadow } from '../../theme';
import { brand } from '../../brand';

/** Line camera in the theme colour, in the same white bubble the app uses for icons. */
function CameraMark() {
  return (
    <View style={[styles.cameraBubble, shadow.md]}>
      <Svg width={76} height={76} viewBox="0 0 96 96">
        <Path
          d="M26 37a5 5 0 0 1 5-5h6l3-5h16l3 5h6a5 5 0 0 1 5 5v24a5 5 0 0 1-5 5H31a5 5 0 0 1-5-5Z"
          fill="none"
          stroke={colors.forest}
          strokeWidth={2.6}
          strokeLinejoin="round"
        />
        <Circle cx={48} cy={49} r={10} fill="none" stroke={colors.forest} strokeWidth={2.6} />
        <Circle cx={48} cy={49} r={4.5} fill={colors.forest} />
        <Circle cx={63.5} cy={39} r={1.8} fill={colors.forest} />
      </Svg>
    </View>
  );
}

/** Brackets gently "focus" in and out while the icon floats: a calm, camera-like idle state. */
function Viewfinder() {
  const { t: tr } = useT();
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
        <CameraMark />
      </Animated.View>
      <Animated.View style={[{ alignItems: 'center', gap: 6 }, rise]}>
        <T display style={styles.headline}>{tr('Sort your bin!')}</T>
        <T size="sm" color={colors.inkMuted}>{tr('Instant {city} bin match · 1–3 photos', { city: brand.city })}</T>
      </Animated.View>
    </>
  );
}

export default function ScanScreen() {
  const router = useRouter();
  const { saved, username, xp, playTheme } = useApp();
  const { t } = useT();
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
  const openCamera = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/camera');
  };

  return (
    <Screen edges={['top']} transparent>
      <View style={styles.page}>
        <ScreenHeader ink={skyInk(THEMES[playTheme])} eyebrow={t('{greeting} · Level {level}', { greeting, level: levelFor(xp).level })} title={t('Welcome back, {name}', { name: username })} />

        <View style={styles.main}>
          <Glass style={styles.finderCard}>
            <Spring onPress={openCamera} pressedScale={0.99} accessibilityLabel={t('Open camera')} style={styles.finder}>
              <Viewfinder />
            </Spring>

            <Spring onPress={openCamera} accessibilityRole="button" accessibilityLabel={t('Analyze items')} pressedScale={0.97} style={[styles.scanButton, shadow.xl]}>
              <T size="lg" weight="semibold" color={colors.white}>{t('Analyze items')}</T>
            </Spring>
          </Glass>

          {/* Every scan is saved to the library automatically; this card is the way in. */}
          <Spring onPress={() => router.push('/library')} accessibilityRole="button" accessibilityLabel={t("You've sorted {n} items. Open my library", { n: saved.length })} pressedScale={0.98} style={styles.impact}>
            <View style={{ flex: 1 }}>
              <T size="xs" color={colors.inkMuted}>{t("You've sorted")}</T>
              <T size="lg" weight="bold">
                <T size="lg" weight="bold" color={colors.forest}>{saved.length}</T> {t(saved.length === 1 ? 'item' : 'items')}
              </T>
            </View>
            <View style={[styles.libraryButton, { backgroundColor: colors.forest }]}>
              <T size="sm" weight="semibold" color={colors.white}>{t('My library')}</T>
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
  cameraBubble: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.9)' },
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
