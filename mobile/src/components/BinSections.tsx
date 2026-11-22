/**
 * Items grouped by bin (Recycling, Compost, Garbage, Special, then Needs verification), as on the
 * "Where it goes" screen. Tap an item to show why it goes there. Used by Results and the Library.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SortItem } from '../data/items';
import { BIN_ORDER, BinKey, bins, colors, radius } from '../theme';
import { TKey, useT } from '../i18n';
import { Glass, Icon, T } from './ui';

const SECTION_LABEL: Record<BinKey, TKey> = {
  recycling: 'Recycling',
  compost: 'Compost',
  garbage: 'Garbage',
  special: 'Special drop-off',
};

const UNSURE = { fg: colors.inkMuted, deep: colors.inkMuted, bg: '#F3F4F6', border: '#D1D5DB', icon: 'help-outline' };

function Section({ label, icon, tone, items }: { label: string; icon: string; tone: typeof UNSURE; items: SortItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const { t } = useT();
  const n = items.length;
  return (
    <Glass style={[styles.section, { borderColor: tone.border }]}>
      <View style={styles.sectionHead}>
        <View style={[styles.chip, { backgroundColor: tone.bg }]}>
          <Icon name={icon} size={16} color={tone.deep} />
          <T size="xs" weight="bold" color={tone.deep}>{label}</T>
        </View>
        <T size="xs" weight="semibold" color={tone.deep}>{t(n === 1 ? '{n} item' : '{n} items', { n })}</T>
      </View>
      <View style={{ gap: 8 }}>
        {items.map((it) => {
          const expanded = open === it.id;
          return (
            <Pressable
              key={it.id}
              onPress={() => setOpen(expanded ? null : it.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityHint={t('Shows why it goes in this bin')}
              style={styles.row}
            >
              <View style={styles.rowTop}>
                <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
                  <Icon name={it.icon} size={20} color={tone.deep} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size="sm" weight="semibold">{it.name}</T>
                  {!!it.detail && <T size="xs" color={colors.inkMuted}>{it.detail === 'Needs verification' ? t('Needs verification') : it.detail}</T>}
                </View>
                {!!it.note && <Icon name={expanded ? 'expand-less' : 'expand-more'} size={20} color={colors.inkMuted} />}
              </View>
              {expanded && !!it.note && <T size="xs" color={colors.ink} style={styles.note}>{it.note}</T>}
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}

export function BinSections({ items }: { items: SortItem[] }) {
  const { t } = useT();
  const unsure = items.filter((i) => i.bin === null);
  return (
    <>
      {BIN_ORDER.map((bin) => {
        const inBin = items.filter((i) => i.bin === bin);
        if (!inBin.length) return null;
        const b = bins[bin];
        return <Section key={bin} label={t(SECTION_LABEL[bin])} icon={b.icon} tone={b} items={inBin} />;
      })}
      {unsure.length > 0 && <Section label={t('Needs verification')} icon={UNSURE.icon} tone={UNSURE} items={unsure} />}
    </>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: radius['3xl'], padding: 16, gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full },
  row: { backgroundColor: colors.white, borderRadius: radius['2xl'], paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  note: { paddingLeft: 48, lineHeight: 18 },
});
