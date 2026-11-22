/**
 * Floating glass pill tab bar (Scan / Play / Community). The dark highlight follows the swipe position.
 */
import type { MaterialTopTabBarProps } from 'expo-router/js-top-tabs';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, glass, radius, shadow } from '../theme';
import { Icon, Spring, T } from './ui';
import { useWorld } from './World';

const TABS: Record<string, { label: string; icon: string }> = {
  scan: { label: 'Scan', icon: 'qr-code-scanner' },
  play: { label: 'Play', icon: 'sports-esports' },
  community: { label: 'Community', icon: 'groups' },
};

/** Height the screens should leave free at the bottom so content isn't hidden by the bar. */
export const TAB_BAR_SPACE = 112;

const PAD = 6;
const GAP = 4;

export function FrostedTabBar({ state, navigateToTab, position }: MaterialTopTabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  // Share the slide position so Play's buildings (components/World) move in step with the Play page.
  const { setTabPosition } = useWorld();
  const playIndex = state.routes.findIndex((r) => r.name === 'play');
  useEffect(() => {
    setTabPosition({ position, playIndex });
    return () => setTabPosition(null);
  }, [position, playIndex, setTabPosition]);
  const n = state.routes.length;
  const tabW = width ? (width - PAD * 2 - GAP * (n - 1)) / n : 0;
  const translateX = position.interpolate({
    inputRange: state.routes.map((_, i) => i),
    outputRange: state.routes.map((_, i) => i * (tabW + GAP)),
  });

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 16) }]}>
      <View style={[glass, shadow.xl, styles.bar]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {tabW > 0 && <Animated.View style={[styles.highlight, { width: tabW, transform: [{ translateX }] }]} />}
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const color = focused ? colors.white : colors.inkMuted;
          return (
            <Spring
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={() => !focused && navigateToTab(route.key)}
              style={styles.tab}
            >
              <Icon name={tab.icon} size={19} color={color} />
              <T size="xs" weight="semibold" color={color}>{tab.label}</T>
            </Spring>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 18, right: 18, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 354, borderRadius: radius.full, padding: PAD, flexDirection: 'row', gap: GAP },
  highlight: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: radius.full, backgroundColor: colors.ink },
  tab: { flex: 1, minHeight: 48, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
