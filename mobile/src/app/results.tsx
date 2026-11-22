/**
 * Sorted breakdown, "Where it goes" (ui-references/.../frosted_mint_sorted_breakdown).
 */
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BinSections } from '../components/BinSections';
import { CircleButton, Pill, PrimaryButton, Screen, T } from '../components/ui';
import { useApp } from '../state/AppState';
import { colors } from '../theme';

export default function ResultsScreen() {
  const router = useRouter();
  const { lastScan } = useApp();
  const n = lastScan.length;

  return (
    <Screen>
      <View style={styles.header}>
        <CircleButton icon="arrow-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/scan'))} />
        <T size="2xl" display>Where it goes</T>
        <Pill style={{ paddingHorizontal: 12 }}>
          <T size="xs" weight="semibold" color={colors.forest}>{n} {n === 1 ? 'item' : 'items'}</T>
        </Pill>
      </View>

      <ScrollView contentContainerStyle={styles.main} showsVerticalScrollIndicator={false}>
        <BinSections items={lastScan} />
        <T size="xs" color={colors.inkMuted} style={{ textAlign: 'center' }}>Saved to your library automatically</T>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Play with these items" icon="play-arrow" onPress={() => router.navigate({ pathname: '/play', params: { deck: 'scan' } })} />
        <Pressable onPress={() => router.navigate('/scan')} accessibilityRole="button" style={styles.done}>
          <T size="sm" weight="semibold" color={colors.inkMuted}>Done</T>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  main: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8, gap: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 4 },
  done: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
});
