/** Searchable library with collapsed bins and virtualized rows; newest scans stay first. */
import { useRouter } from 'expo-router';
import { type ComponentRef, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, LayoutAnimation, SectionList, StyleSheet, TextInput, View } from 'react-native';

import { BinItemRow } from '../components/BinSections';
import { CircleButton, Glass, Icon, PrimaryButton, Screen, ScreenHeader, Spring, T } from '../components/ui';
import type { SortItem } from '../data/items';
import { useT } from '../i18n';
import { groupLibraryItems, type LibraryBin } from '../library/items';
import { motionMs } from '../lib/motion';
import { useApp } from '../state/AppState';
import { BIN_ORDER, bins, colors, fonts, glass, radius } from '../theme';

const BINS: LibraryBin[] = [...BIN_ORDER, 'unsure'];
const UNSURE = { fg: colors.inkMuted, deep: colors.inkMuted, bg: '#F3F4F6', border: '#D1D5DB', icon: 'help-outline' };
const toneOf = (bin: LibraryBin) => bin === 'unsure' ? UNSURE : bins[bin];
interface LibrarySection { key: LibraryBin; total: number; expanded: boolean; data: SortItem[] }

const animateDropdown = () => LayoutAnimation.configureNext({
  ...LayoutAnimation.Presets.easeInEaseOut,
  duration: motionMs(280),
});

function DropdownChevron({ expanded }: { expanded: boolean }) {
  const [progress] = useState(() => new Animated.Value(expanded ? 1 : 0));
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: motionMs(280),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [expanded, progress]);
  return (
    <Animated.View style={{ transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
      <Icon name="expand-more" size={22} color={colors.inkMuted} />
    </Animated.View>
  );
}

export default function LibraryScreen() {
  const router = useRouter();
  const { saved, libraryLoading, libraryError, retryLibrary } = useApp();
  const { t, binLabel } = useT();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [openBin, setOpenBin] = useState<LibraryBin | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const list = useRef<ComponentRef<typeof SectionList<SortItem, LibrarySection>>>(null);
  const groups = useMemo(() => groupLibraryItems(saved, deferredQuery), [saved, deferredQuery]);
  const searching = deferredQuery.trim().length > 0;
  const labelOf = (bin: LibraryBin) => bin === 'unsure' ? t('Needs verification') : bin === 'special' ? t('Special drop-off') : binLabel(bin);
  const sections = useMemo(() => BINS.filter((bin) => bin !== 'unsure' || groups.unsure.length > 0).map((bin) => ({
    key: bin,
    total: groups[bin].length,
    expanded: searching || openBin === bin,
    data: searching || openBin === bin ? groups[bin] : [],
  })).filter((section) => !searching || section.total > 0), [groups, searching, openBin]);
  const scrollToTop = () => list.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
  const changeQuery = (value: string) => {
    setQuery(value);
    setOpenItem(null);
    scrollToTop();
  };
  const toggleBin = (bin: LibraryBin) => {
    animateDropdown();
    setOpenBin(openBin === bin ? null : bin);
    setOpenItem(null);
    scrollToTop();
  };

  return (
    <Screen>
      <View style={styles.back}>
        <CircleButton icon="arrow-back" label={t('Back')} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/scan'))} />
      </View>
      <ScreenHeader eyebrow={t("Everything you've sorted")} title={t('My library')} style={{ paddingTop: 12 }} />

      <View style={styles.tools}>
        <View style={styles.search}>
          <Icon name="search" size={20} color={colors.inkMuted} />
          <TextInput value={query} onChangeText={changeQuery} placeholder={t('Search your items')} placeholderTextColor={colors.inkMuted} accessibilityLabel={t('Search your items')} returnKeyType="search" autoCorrect={false} style={styles.input} />
          {!!query && <Spring onPress={() => changeQuery('')} accessibilityRole="button" accessibilityLabel={t('Clear search')} style={styles.clear}><Icon name="close" size={18} color={colors.inkMuted} /></Spring>}
        </View>
        {libraryLoading && <View style={styles.status}><ActivityIndicator size="small" color={colors.forest} /><T size="xs" color={colors.inkMuted}>{t('Loading your saved items…')}</T></View>}
        {libraryError && <Spring onPress={retryLibrary} accessibilityRole="button" style={styles.status}><Icon name="refresh" size={18} color={colors.forest} /><T size="xs" color={colors.forest}>{t("Couldn't load your full library. Tap to retry.")}</T></Spring>}
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
              <Spring
                onPress={() => toggleBin(section.key)}
                pressedScale={0.99}
                disabled={searching}
                accessibilityRole={searching ? 'header' : 'button'}
                accessibilityState={searching ? undefined : { expanded: section.expanded }}
                style={[glass, styles.section, section.expanded && styles.openSection]}
              >
                <View style={[styles.binIcon, { backgroundColor: tone.bg }]}>
                  <Icon name={tone.icon} size={22} color={tone.deep} />
                </View>
                <T size="base" weight="semibold" style={{ flex: 1 }}>{labelOf(section.key)}</T>
                <T size="sm" color={colors.inkMuted}>{section.total}</T>
                {!searching && <DropdownChevron expanded={section.expanded} />}
              </Spring>
            );
          }}
          renderItem={({ item, section }) => <View style={styles.item}><BinItemRow item={item} tone={toneOf(section.key)} expanded={openItem === item.id} onPress={() => { animateDropdown(); setOpenItem(openItem === item.id ? null : item.id); }} /></View>}
          renderSectionFooter={({ section }) => section.expanded && section.total === 0 ? <T size="sm" color={colors.inkMuted} style={styles.noResults}>{t('No saved items in this bin yet.')}</T> : null}
          ListEmptyComponent={libraryLoading ? undefined : <T size="sm" color={colors.inkMuted} style={styles.noResults}>{t('No items match “{query}”.', { query })}</T>}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingHorizontal: 20, paddingTop: 12 },
  tools: { paddingHorizontal: 20, gap: 10, paddingBottom: 12 },
  main: { paddingHorizontal: 20, paddingBottom: 40 },
  section: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius['3xl'], paddingHorizontal: 16, marginBottom: 12 },
  openSection: { backgroundColor: 'rgba(255,255,255,0.98)' },
  binIcon: { width: 44, height: 44, borderRadius: radius['2xl'], alignItems: 'center', justifyContent: 'center' },
  item: { marginBottom: 8 },
  status: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 8 },
  noResults: { textAlign: 'center', paddingVertical: 24 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: colors.white },
  clear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink, paddingVertical: 10 },
  empty: { margin: 20, borderRadius: radius['3xl'], padding: 28, alignItems: 'center', gap: 8 },
});
