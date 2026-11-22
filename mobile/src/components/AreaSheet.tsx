/**
 * Bottom sheet to pick the user's borough and brown-bin setting (sent with every scan).
 */
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOROUGHS } from '../data/rules';
import { useApp } from '../state/AppState';
import { colors, radius } from '../theme';
import { Icon, PrimaryButton, T } from './ui';

export function AreaSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { borough, hasBrownBin, setArea } = useApp();
  const insets = useSafeAreaInsets();
  const options = [{ slug: null as string | null, name: 'Montréal (city-wide)' }, ...BOROUGHS];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: colors.mintCanvas, paddingBottom: insets.bottom + 16 }]}>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(18, 41, 31, 0.35)' },
  sheet: { borderTopLeftRadius: radius['3xl'], borderTopRightRadius: radius['3xl'], padding: 20 },
  title: { fontSize: 30, lineHeight: 36, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, borderBottomWidth: 1, borderBottomColor: 'rgba(18,41,31,0.08)' },
});
