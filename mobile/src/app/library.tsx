/** Searchable library with collapsed bins and virtualized rows; newest scans stay first. */
import { useRouter } from 'expo-router';
import { type ComponentRef, useDeferredValue, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, SectionList, StyleSheet, TextInput, View } from 'react-native';

import { BinItemRow } from '../components/BinSections';
import { CircleButton, Glass, Icon, PrimaryButton, Screen, ScreenHeader, Spring, T } from '../components/ui';
import type { SortItem } from '../data/items';
import { useT } from '../i18n';
import { groupLibraryItems, type LibraryBin } from '../library/items';
import { useApp } from '../state/AppState';
import { BIN_ORDER, bins, colors, fonts, radius } from '../theme';

const BINS: LibraryBin[] = [...BIN_ORDER, 'unsure'];
const UNSURE = { fg: colors.inkMuted, deep: colors.inkMuted, bg: '#F3F4F6', border: '#D1D5DB', icon: 'help-outline' };
const toneOf = (bin: LibraryBin) => bin === 'unsure' ? UNSURE : bins[bin];
interface LibrarySection { key: LibraryBin; total: number; expanded: boolean; data: SortItem[] }

export default function LibraryScreen() {
  const router = useRouter();
  const { saved, libraryLoading, libraryError, retryLibrary } = useApp();
  const { t, binLabel } = useT();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<LibraryBin | null>(null);
  const [openBin, setOpenBin] = useState<LibraryBin | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const list = useRef<ComponentRef<typeof SectionList<SortItem, LibrarySection>>>(null);
  const groups = useMemo(() => groupLibraryItems(saved, deferredQuery), [saved, deferredQuery]);
  const counts = useMemo(() => groupLibraryItems(saved, ''), [saved]);
  const searching = deferredQuery.trim().length > 0;
  const labelOf = (bin: LibraryBin) => bin === 'unsure' ? t('Needs verification') : bin === 'special' ? t('Special drop-off') : binLabel(bin);
  const sections = useMemo(() => BINS.filter((bin) => !filter || filter === bin).map((bin) => ({
    key: bin,
    total: groups[bin].length,
    expanded: searching || openBin === bin,
    data: searching || openBin === bin ? groups[bin] : [],
  })).filter((section) => !searching || section.total > 0), [groups, filter, searching, openBin]);
  const matches = sections.reduce((n, section) => n + section.total, 0);

  const chooseBin = (bin: LibraryBin | null) => {
    setFilter(bin);
    setOpenBin(bin);
    setOpenItem(null);
    list.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
  };

  return (
    <Screen>
      <View style={styles.back}>
        <CircleButton icon="arrow-back" label={t('Back')} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/scan'))} />
      </View>
      <ScreenHeader eyebrow={t("Everything you've sorted")} title={t('My library')} style={{ paddingTop: 12 }} />

      <View style={styles.tools}>
        <View style={styles.totalRow}>
          <T size="sm" weight="semibold">{t(saved.length === 1 ? '{n} item' : '{n} items', { n: saved.length })}</T>
          <T size="xs" color={colors.inkMuted}>{t('Newest first')}</T>
        </View>
        <View style={styles.search}>
          <Icon name="search" size={20} color={colors.inkMuted} />
          <TextInput value={query} onChangeText={(value) => { setQuery(value); setOpenItem(null); list.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false }); }} placeholder={t('Search your items')} placeholderTextColor={colors.inkMuted} accessibilityLabel={t('Search your items')} returnKeyType="search" autoCorrect={false} style={styles.input} />
          {!!query && <Spring onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t('Clear search')} style={styles.clear}><Icon name="close" size={18} color={colors.inkMuted} /></Spring>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} keyboardShouldPersistTaps="handled">
          <Spring onPress={() => chooseBin(null)} accessibilityRole="button" accessibilityState={{ selected: filter === null }} style={[styles.filter, filter === null && styles.selected]}>
            <T size="xs" weight="semibold" color={filter === null ? colors.white : colors.ink}>{t('All bins')}</T>
          </Spring>
          {BINS.map((bin) => (
            <Spring key={bin} onPress={() => chooseBin(bin)} accessibilityRole="button" accessibilityState={{ selected: filter === bin }} style={[styles.filter, filter === bin && styles.selected]}>
              <Icon name={toneOf(bin).icon} size={16} color={filter === bin ? colors.white : toneOf(bin).deep} />
              <T size="xs" weight="semibold" color={filter === bin ? colors.white : colors.ink}>{labelOf(bin)} · {counts[bin].length}</T>
            </Spring>
          ))}
        </ScrollView>
        {libraryLoading && <View style={styles.status}><ActivityIndicator size="small" color={colors.forest} /><T size="xs" color={colors.inkMuted}>{t('Loading your saved items…')}</T></View>}
        {libraryError && <Spring onPress={retryLibrary} accessibilityRole="button" style={styles.status}><Icon name="refresh" size={18} color={colors.forest} /><T size="xs" color={colors.forest}>{t("Couldn't load your full library. Tap to retry.")}</T></Spring>}
        {searching && <T size="xs" color={colors.inkMuted} accessibilityLiveRegion="polite">{t('{n} matching items', { n: matches })}</T>}
      </View>

      {saved.length === 0 && !libraryLoading && !libraryError ? (
        <Glass style={styles.empty}>
          <Icon name="inventory-2" size={32} color={colors.forest} />
          <T size="base" weight="semibold">{t('Nothing here yet')}</T>
          <T size="sm" color={colors.inkMuted} style={{ textAlign: 'center' }}>{t('Every item you scan is saved here, with where it goes and why.')}</T>
          <PrimaryButton label={t('Analyze items')} size="md" onPress={() => router.push('/camera')} style={{ marginTop: 8 }} />
        </Glass>
      ) : (
        <SectionList<SortItem, LibrarySection>
          ref={list}
          sections={sections}
          extraData={openItem}
          keyExtractor={(item) => item.id}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          stickySectionHeadersEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.main}
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section }) => {
            const tone = toneOf(section.key);
            return (
              <Pressable onPress={() => { if (!searching) setOpenBin(openBin === section.key ? null : section.key); }} accessibilityRole={searching ? 'header' : 'button'} accessibilityState={{ expanded: section.expanded }} style={[styles.section, { borderColor: tone.border }]}>
                <View style={[styles.binIcon, { backgroundColor: tone.bg }]}><Icon name={tone.icon} size={20} color={tone.deep} /></View>
                <T size="sm" weight="bold" style={{ flex: 1 }}>{labelOf(section.key)}</T>
                <T size="xs" weight="semibold" color={colors.inkMuted}>{section.total}</T>
                {!searching && <Icon name={section.expanded ? 'expand-less' : 'expand-more'} size={22} color={colors.inkMuted} />}
              </Pressable>
            );
          }}
          renderItem={({ item, section }) => <View style={styles.item}><BinItemRow item={item} tone={toneOf(section.key)} expanded={openItem === item.id} onPress={() => setOpenItem(openItem === item.id ? null : item.id)} /></View>}
          renderSectionFooter={({ section }) => section.expanded && section.total === 0 ? <T size="sm" color={colors.inkMuted} style={styles.noResults}>{t('No saved items in this bin yet.')}</T> : null}
          ListEmptyComponent={libraryLoading ? null : <T size="sm" color={colors.inkMuted} style={styles.noResults}>{t('No items match “{query}”.', { query })}</T>}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingHorizontal: 20, paddingTop: 12 },
  tools: { paddingHorizontal: 20, gap: 10, paddingBottom: 12 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filters: { gap: 8 },
  filter: { minHeight: 44, paddingHorizontal: 12, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(18,41,31,0.1)' },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  main: { paddingHorizontal: 20, paddingBottom: 40 },
  section: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.mintCanvas, borderRadius: radius['2xl'], borderWidth: 1, paddingHorizontal: 14, marginBottom: 8 },
  binIcon: { width: 36, height: 36, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  item: { marginBottom: 8 },
  status: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 8 },
  noResults: { textAlign: 'center', paddingVertical: 24 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: colors.white },
  clear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink, paddingVertical: 10 },
  empty: { margin: 20, borderRadius: radius['3xl'], padding: 28, alignItems: 'center', gap: 8 },
});
