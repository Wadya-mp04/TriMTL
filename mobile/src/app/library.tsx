/**
 * My library: every item the user has scanned (auto-saved), with a total, the split by bin and search.
 * Opened from the Scan page. Items come from `saved` in the app state, which Supabase will store per user.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BinSections } from '../components/BinSections';
import { CircleButton, Glass, Icon, PrimaryButton, Screen, ScreenHeader, T } from '../components/ui';
import { useT } from '../i18n';
import { useApp } from '../state/AppState';
import { BIN_ORDER, bins, colors, fonts, radius } from '../theme';

export default function LibraryScreen() {
  const router = useRouter();
  const { saved } = useApp();
  const { t, binLabel } = useT();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = q ? saved.filter((i) => `${i.name} ${i.detail}`.toLowerCase().includes(q)) : saved;
  const counts = BIN_ORDER.map((b) => ({ bin: b, n: saved.filter((i) => i.bin === b).length }));

  return (
    <Screen>
      <View style={styles.back}>
        <CircleButton icon="arrow-back" label={t('Back')} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/scan'))} />
      </View>
      <ScreenHeader eyebrow={t("Everything you've sorted")} title={t('My library')} style={{ paddingTop: 12 }} />

      <ScrollView contentContainerStyle={styles.main} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {saved.length === 0 ? (
          <Glass style={styles.empty}>
            <Icon name="inventory-2" size={32} color={colors.forest} />
            <T size="base" weight="semibold">{t('Nothing here yet')}</T>
            <T size="sm" color={colors.inkMuted} style={{ textAlign: 'center' }}>{t('Every item you scan is saved here, with where it goes and why.')}</T>
            <PrimaryButton label={t('Analyze items')} size="md" onPress={() => router.push('/camera')} style={{ marginTop: 8 }} />
          </Glass>
        ) : (
          <>
            <Glass style={styles.summary}>
              <View style={styles.totalRow}>
                <T color={colors.forest} style={styles.total}>{saved.length}</T>
                <T size="sm" color={colors.inkMuted}>{t(saved.length === 1 ? 'item sorted' : 'items sorted')}</T>
              </View>
              <View style={styles.bar}>
                {counts.filter((c) => c.n).map((c) => <View key={c.bin} style={{ flex: c.n, backgroundColor: bins[c.bin].fg }} />)}
              </View>
              <View style={styles.legend}>
                {counts.map((c) => (
                  <View key={c.bin} style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: bins[c.bin].fg }]} />
                    <T size="xs" color={colors.inkMuted}>{binLabel(c.bin)} <T size="xs" weight="bold" color={colors.ink}>{c.n}</T></T>
                  </View>
                ))}
              </View>
            </Glass>

            <View style={styles.search}>
              <Icon name="search" size={20} color={colors.inkMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('Search your items')}
                placeholderTextColor={colors.inkMuted}
                accessibilityLabel={t('Search your items')}
                returnKeyType="search"
                style={styles.input}
              />
            </View>

            {shown.length ? (
              <BinSections items={shown} />
            ) : (
              <T size="sm" color={colors.inkMuted} style={{ textAlign: 'center', paddingVertical: 24 }}>{t('No items match “{query}”.', { query })}</T>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingHorizontal: 20, paddingTop: 12 },
  main: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40, gap: 16 },
  summary: { borderRadius: radius['3xl'], padding: 18, gap: 12 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  total: { fontFamily: fonts.display, fontSize: 48, lineHeight: 52 },
  bar: { flexDirection: 'row', height: 8, borderRadius: radius.full, overflow: 'hidden', gap: 2, backgroundColor: 'rgba(255,255,255,0.8)' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: colors.white,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink, paddingVertical: 10 },
  empty: { borderRadius: radius['3xl'], padding: 28, alignItems: 'center', gap: 8 },
});
