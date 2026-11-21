/**
 * Scan home (ui-references/.../frosted_mint_scan_viewfinder).
 */
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { TAB_BAR_SPACE } from '../../components/TabBar';
import {
  AvatarButton,
  BentoBackdrop,
  BrandMark,
  CornerBrackets,
  Glass,
  Icon,
  IconBubble,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Spring,
  T,
  XpPill,
} from '../../components/ui';
import { SortItem } from '../../data/items';
import { pickPhotos } from '../../lib/photos';
import { useApp } from '../../state/AppState';
import { bins, colors, radius } from '../../theme';

function SavedTile({ item }: { item: SortItem }) {
  const b = item.bin ? bins[item.bin] : null;
  const fg = b?.fg ?? colors.inkMuted;
  const bg = b?.bg ?? '#F3F4F6';
  return (
    <Spring pressedScale={0.98} style={styles.tile}>
      <View style={styles.tileTop}>
        <View style={[styles.tileIcon, { backgroundColor: bg }]}>
          <Icon name={item.icon} size={19} color={fg} />
        </View>
        <View style={[styles.badge, { backgroundColor: bg }]}>
          <T size="xs" weight="semibold" color={fg}>{b?.label ?? 'Check'}</T>
        </View>
      </View>
      <T size="sm" weight="semibold" numberOfLines={1}>{item.name}</T>
    </Spring>
  );
}

function pairs<X>(xs: X[]): [X, X | undefined][] {
  const out: [X, X | undefined][] = [];
  for (let i = 0; i < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

export default function ScanScreen() {
  const router = useRouter();
  const { saved, setPhotos } = useApp();

  const choose = async () => {
    const uris = await pickPhotos();
    if (uris.length) {
      setPhotos(uris);
      router.push('/analyzing');
    }
  };

  return (
    <Screen variant="pearl" edges={['top']}>
      <BentoBackdrop />
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.row}>
            <BrandMark />
            <T size="lg" weight="bold" style={{ letterSpacing: -0.45 }}>TriMTL</T>
          </View>
          <View style={styles.row}>
            <XpPill />
            <AvatarButton />
          </View>
        </View>

        <View style={styles.main}>
          <Glass style={styles.finderCard}>
            <View style={styles.finder}>
              <CornerBrackets color="rgba(23,107,77,0.5)" />
              <IconBubble icon="qr-code-scanner" />
              <T size="2xl" display style={{ marginTop: 12, textAlign: 'center' }}>Point at up to 5 items</T>
              <T size="xs" color={colors.inkMuted} style={{ marginTop: 4 }}>Instant Montréal bin match • 1–3 photos</T>
            </View>
            <View style={{ gap: 10 }}>
              <PrimaryButton label="Scan items" icon="photo-camera" onPress={() => router.push('/camera')} />
              <SecondaryButton label="Choose photos" icon="photo-library" onPress={choose} />
            </View>
          </Glass>

          <View style={{ gap: 12 }}>
            <View style={[styles.row, { justifyContent: 'space-between', paddingHorizontal: 4 }]}>
              <T size="sm" weight="bold">Saved items ({saved.length})</T>
              <Spring onPress={() => router.navigate('/play')} style={[styles.row, { gap: 2 }]}>
                <T size="xs" weight="semibold" color={colors.forest}>Practice deck</T>
                <Icon name="chevron-right" size={16} color={colors.forest} />
              </Spring>
            </View>
            <View style={{ gap: 10 }}>
              {pairs(saved.slice(0, 6)).map(([a, b]) => (
                <View key={a.id} style={styles.gridRow}>
                  <SavedTile item={a} />
                  {b ? <SavedTile item={b} /> : <View style={{ flex: 1 }} />}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  main: { paddingHorizontal: 20, paddingTop: 8, gap: 20 },
  finderCard: { borderRadius: radius['3xl'], padding: 16, gap: 16 },
  finder: {
    minHeight: 224,
    borderRadius: radius['2xl'],
    backgroundColor: 'rgba(18,54,41,0.05)',
    borderWidth: 1,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    overflow: 'hidden',
  },
  gridRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    borderRadius: radius['2xl'],
    padding: 14,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.88)',
    boxShadow: '0px 10px 30px -10px rgba(20, 92, 64, 0.12), inset 0px 1px 0px rgba(255, 255, 255, 0.9)',
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: { width: 36, height: 36, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
});
