/**
 * Floating glass pill tab bar (Scan / Play / Social) from the Stitch designs.
 */
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, glass, radius, shadow } from '../theme';
import { Icon, Spring, T } from './ui';

const TABS: Record<string, { label: string; icon: string }> = {
  scan: { label: 'Scan', icon: 'qr-code-scanner' },
  play: { label: 'Play', icon: 'sports-esports' },
  social: { label: 'Social', icon: 'leaderboard' },
};

/** Height the screens should leave free at the bottom so content isn't hidden by the bar. */
export const TAB_BAR_SPACE = 112;

export function FrostedTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 16) }]}>
      <View style={[glass, shadow.xl, styles.bar]}>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          return (
            <Spring
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={() => {
                if (!focused) navigateToTab(route.key);
              }}
              style={[styles.tab, focused && { backgroundColor: colors.ink }]}
            >
              <Icon name={tab.icon} size={19} color={focused ? colors.white : colors.inkMuted} />
              <T size="xs" weight="semibold" color={focused ? colors.white : colors.inkMuted}>{tab.label}</T>
            </Spring>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 18, right: 18, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 354, borderRadius: radius.full, padding: 6, flexDirection: 'row', gap: 4 },
  tab: { flex: 1, minHeight: 48, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
