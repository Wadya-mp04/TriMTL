/**
 * Draggable sheet with three snap points (peek, half, full). The handle and header drag it; the body scrolls.
 * Springs use the same feel as `Spring` in ui.tsx; with Reduce Motion on, it moves without a spring.
 */
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { useT } from '../i18n';
import { colors, radius, shadow } from '../theme';

export function BottomSheet({
  snaps,
  index,
  onIndexChange,
  reduceMotion,
  header,
  children,
}: {
  /** Visible heights, smallest first. */
  snaps: number[];
  index: number;
  onIndexChange: (i: number) => void;
  reduceMotion: boolean;
  header: ReactNode;
  children: ReactNode;
}) {
  const { t } = useT();
  const max = snaps[snaps.length - 1];
  const [headerHeight, setHeaderHeight] = useState(0);
  const [visible] = useState(() => new Animated.Value(snaps[index]));

  useEffect(() => {
    if (reduceMotion) Animated.timing(visible, { toValue: snaps[index], duration: 0, useNativeDriver: true }).start();
    else Animated.spring(visible, { toValue: snaps[index], useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [index, snaps, reduceMotion, visible]);

  const pan = useMemo(
    () => {
      let start = snaps[index];
      return PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderGrant: () => { visible.stopAnimation((value) => { start = value; }); },
        onPanResponderMove: (_, g) => visible.setValue(Math.min(max + 24, Math.max(snaps[0] - 24, start - g.dy))),
        onPanResponderRelease: (_, g) => {
          // Project a flick forward a little so a quick swipe reaches the next snap.
          const target = start - g.dy - g.vy * 120;
          let best = 0;
          snaps.forEach((s, i) => { if (Math.abs(s - target) < Math.abs(snaps[best] - target)) best = i; });
          if (best === index) {
            if (reduceMotion) Animated.timing(visible, { toValue: snaps[best], duration: 0, useNativeDriver: true }).start();
            else Animated.spring(visible, { toValue: snaps[best], useNativeDriver: true, speed: 14, bounciness: 3 }).start();
          }
          onIndexChange(best);
        },
        onPanResponderTerminate: () => {
          Animated.timing(visible, { toValue: snaps[index], duration: reduceMotion ? 0 : 180, useNativeDriver: true }).start();
        },
      });
    },
    [snaps, max, index, onIndexChange, visible, reduceMotion],
  );

  const translateY = visible.interpolate({ inputRange: [0, max], outputRange: [max, 0] });
  const next = index === snaps.length - 1 ? 0 : index + 1;

  return (
    <Animated.View style={[styles.sheet, shadow.xl, { backgroundColor: colors.mintCanvas, height: max + 24, transform: [{ translateY }] }]}>
      <View {...pan.panHandlers} onLayout={(e) => setHeaderHeight(Math.round(e.nativeEvent.layout.height))}>
        <Pressable
          onPress={() => onIndexChange(next)}
          accessibilityRole="adjustable"
          accessibilityLabel={t('Details sheet')}
          accessibilityValue={{ text: [t('Collapsed'), t('Half open'), t('Open')][index] }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) =>
            onIndexChange(e.nativeEvent.actionName === 'increment' ? Math.min(index + 1, snaps.length - 1) : Math.max(index - 1, 0))
          }
          hitSlop={8}
          style={styles.handleHit}
        >
          <View style={styles.handle} />
        </Pressable>
        {header}
      </View>
      {/* At peek the body would sit behind the floating tab bar, so it is hidden until the sheet opens. */}
      <View style={{ height: Math.max(0, snaps[index] - headerHeight), overflow: 'hidden', opacity: index === 0 ? 0 : 1 }} pointerEvents={index === 0 ? 'none' : 'auto'}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -24,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.88)',
  },
  handleHit: { alignItems: 'center', justifyContent: 'center', height: 28 },
  handle: { width: 40, height: 5, borderRadius: radius.full, backgroundColor: 'rgba(18,41,31,0.18)' },
});
