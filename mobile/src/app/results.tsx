/**
 * Sorted breakdown, "Where it goes" (ui-references/.../frosted_mint_sorted_breakdown).
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CircleButton, Glass, Icon, Pill, PrimaryButton, Screen, SecondaryButton, T } from '../components/ui';
import { SortItem } from '../data/items';
import { useApp } from '../state/AppState';
import { BIN_ORDER, BinKey, bins, colors, radius } from '../theme';

const SECTION_LABEL: Record<BinKey, string> = {
  recycling: 'Recycling',
  compost: 'Compost',
  garbage: 'Garbage',
  special: 'Special drop-off',
};

const UNSURE = { fg: colors.inkMuted, deep: colors.inkMuted, bg: '#F3F4F6', border: '#D1D5DB', icon: 'help-outline' };

function Section({ label, icon, tone, items }: { label: string; icon: string; tone: typeof UNSURE; items: SortItem[] }) {
  const n = items.length;
  return (
    <Glass style={[styles.section, { borderColor: tone.border }]}>
      <View style={styles.sectionHead}>
        <View style={[styles.chip, { backgroundColor: tone.bg }]}>
          <Icon name={icon} size={16} color={tone.deep} />
          <T size="xs" weight="bold" color={tone.deep}>{label}</T>
        </View>
        <T size="xs" weight="semibold" color={tone.deep}>{n} {n === 1 ? 'item' : 'items'}</T>
      </View>
      <View style={{ gap: 8 }}>
        {items.map((it) => (
          <View key={it.id} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
              <Icon name={it.icon} size={20} color={tone.deep} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size="sm" weight="semibold">{it.name}</T>
              {!!it.detail && <T size="xs" color={colors.inkMuted}>{it.detail}</T>}
            </View>
          </View>
        ))}
      </View>
    </Glass>
  );
}

export default function ResultsScreen() {
  const router = useRouter();
  const { lastScan, saveItems } = useApp();
  const [saved, setSaved] = useState(false);
  const unsure = lastScan.filter((i) => i.bin === null);
  const n = lastScan.length;

  const save = () => {
    saveItems(lastScan);
    setSaved(true);
    router.navigate('/scan');
  };

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
        {BIN_ORDER.map((bin) => {
          const items = lastScan.filter((i) => i.bin === bin);
          if (!items.length) return null;
          const b = bins[bin];
          return <Section key={bin} label={SECTION_LABEL[bin]} icon={b.icon} tone={b} items={items} />;
        })}
        {unsure.length > 0 && <Section label="Needs verification" icon={UNSURE.icon} tone={UNSURE} items={unsure} />}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={saved ? 'Saved' : n === 1 ? 'Save item' : `Save all ${n} items`}
          icon="bookmark-added"
          onPress={save}
          disabled={saved || n === 0}
        />
        <SecondaryButton
          label="Play with these items"
          icon="play-arrow"
          textColor={colors.forest}
          onPress={() => router.navigate({ pathname: '/play', params: { deck: 'scan' } })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  main: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8, gap: 16 },
  section: { borderRadius: radius['3xl'], padding: 16, gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full },
  row: { backgroundColor: colors.white, borderRadius: radius['2xl'], paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, gap: 10 },
});
