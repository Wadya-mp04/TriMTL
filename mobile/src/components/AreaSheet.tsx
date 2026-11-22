/**
 * Bottom sheet to pick the user's borough and brown-bin setting (sent with every scan).
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOROUGHS } from '../data/rules';
import { motionMs } from '../lib/motion';
import { useApp } from '../state/AppState';
import { colors, radius } from '../theme';
import { Icon, PrimaryButton, T } from './ui';

export function AreaSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { borough, hasBrownBin, setArea } = useApp();
  const insets = useSafeAreaInsets();
  const options = [{ slug: null as string | null, name: 'Montréal (city-wide)' }, ...BOROUGHS];
  const { height } = useWindowDimensions();
  // The backdrop fades while only the sheet slides up (a sliding Modal would slide the dark backdrop too).
  const [mounted, setMounted] = useState(visible);
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(shown, { toValue: visible ? 1 : 0, duration: motionMs(visible ? 300 : 220), easing: Easing.out(Easing.cubic), useNativeDriver: true })
      .start(({ finished }) => { if (finished && !visible) setMounted(false); });
  }, [visible, shown]);
  const slide = shown.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: shown }]}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <View style={{ flex: 1 }} pointerEvents="box-none" />
      <Animated.View style={[styles.sheet, { backgroundColor: colors.mintCanvas, paddingBottom: insets.bottom + 16, transform: [{ translateY: slide }] }]}>
        <T display style={styles.title}>Your area</T>
        <T size="sm" color={colors.inkMuted} style={{ marginBottom: 12 }}>Some rules change by borough and building.</T>
        <View style={styles.row}>
          <T size="sm" weight="semibold">My building has a brown bin</T>
          <Switch value={hasBrownBin} onValueChange={(v) => setArea(borough, v)} trackColor={{ true: colors.forest }} />
        </View>
        <ScrollView style={{ maxHeight: 340 }}>
          {options.map((o) => {
            const on = o.slug === borough;
            return (
              <Pressable key={o.slug ?? 'city'} onPress={() => setArea(o.slug, hasBrownBin)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={styles.row}>
                <T size="sm" weight={on ? 'bold' : 'regular'}>{o.name}</T>
                {on && <Icon name="check" size={20} color={colors.forest} />}
              </Pressable>
            );
          })}
        </ScrollView>
        <PrimaryButton label="Done" size="md" onPress={onClose} style={{ marginTop: 12 }} />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(18, 41, 31, 0.35)' },
  sheet: { borderTopLeftRadius: radius['3xl'], borderTopRightRadius: radius['3xl'], padding: 20 },
  title: { fontSize: 30, lineHeight: 36, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, borderBottomWidth: 1, borderBottomColor: 'rgba(18,41,31,0.08)' },
});
