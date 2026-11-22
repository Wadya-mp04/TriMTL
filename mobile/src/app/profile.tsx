/**
 * My Profile (ui-references/.../frosted_mint_my_profile): identity, stats, area and theme.
 * Opened from the avatar on Community; no tab bar here.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AreaSheet } from '../components/AreaSheet';
import { CircleButton, Glass, Icon, Screen, ScreenHeader, Segmented, Spring, T } from '../components/ui';
import { boroughName } from '../data/rules';
import { useT } from '../i18n';
import { levelFor, useApp } from '../state/AppState';
import { THEME_ORDER, THEMES } from '../game/themes';
import { APP_PALETTES, colors, radius, shadow } from '../theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { username, initials, xp, stats, playTheme, setPlayTheme, signOut, borough, hasBrownBin, lang, setLang } = useApp();
  const { t } = useT();
  const [areaOpen, setAreaOpen] = useState(false);
  const { level, next, progress } = levelFor(xp);
  const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;

  return (
    <Screen>
      <View style={styles.back}>
        <CircleButton icon="arrow-back" label={t('Back')} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/community'))} />
      </View>
      <ScreenHeader eyebrow={t('Level {level} · {borough}', { level, borough: boroughName(borough) })} title={t('My profile')} style={{ paddingTop: 12 }} />

      <ScrollView contentContainerStyle={styles.main} showsVerticalScrollIndicator={false}>
        <Glass style={styles.identity}>
          <View style={[styles.row, { gap: 16 }]}>
            <View style={[styles.bigAvatar, shadow.md, { backgroundColor: colors.forest }]}>
              <T size="xl" weight="bold" color={colors.white}>{initials}</T>
            </View>
            {/* flex + minWidth 0 keep long names inside the card; they end with "…" instead of overflowing. */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size="xl" weight="bold" numberOfLines={1}>{username}</T>
              <View style={[styles.levelChip, shadow.sm]}>
                <T size="xs" weight="semibold" color={colors.forest} numberOfLines={1}>{t('Level {level} • {borough}', { level, borough: boroughName(borough) })}</T>
              </View>
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <T size="xs" weight="semibold" color={colors.inkMuted}>{t('Level progress')}</T>
              <T size="xs" weight="semibold" color={colors.forest} style={{ fontVariant: ['tabular-nums'] }}>{xp} / {next} XP</T>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.forest }]} />
            </View>
          </View>
        </Glass>

        <View accessibilityLabel={t('Stats')} style={[styles.row, { gap: 10 }]}>
          {[
            { v: String(xp), l: t('Total XP'), c: colors.forest },
            { v: `${accuracy}%`, l: t('Accuracy'), c: colors.ink },
            { v: String(stats.games), l: t('Games'), c: colors.ink },
          ].map((s) => (
            <Glass key={s.l} style={styles.stat}>
              <T size="xl" weight="bold" color={s.c} style={{ fontVariant: ['tabular-nums'] }}>{s.v}</T>
              <T size="xs" color={colors.inkMuted}>{s.l}</T>
            </Glass>
          ))}
        </View>

        <Spring onPress={() => setAreaOpen(true)} accessibilityRole="button" accessibilityLabel={t('Change your area')} pressedScale={0.98} style={styles.area}>
          <View style={[styles.areaIcon, { backgroundColor: colors.forest }]}>
            <Icon name="location-city" size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <T size="sm" weight="bold" numberOfLines={2}>{boroughName(borough)}</T>
            <T size="xs" color={colors.inkMuted}>{t('{bin} · answers match your area', { bin: t(hasBrownBin ? 'Brown bin' : 'No brown bin') })}</T>
          </View>
          <Icon name="chevron-right" size={20} color={colors.inkMuted} />
        </Spring>

        <View style={{ gap: 8 }}>
          <View style={[styles.row, { justifyContent: 'space-between', paddingHorizontal: 4 }]}>
            <T size="sm" weight="bold">{t('Language')}</T>
            <T size="xs" color={colors.inkMuted}>{t('App, scans and tips')}</T>
          </View>
          <Segmented options={[{ key: 'en', label: 'English' }, { key: 'fr', label: 'Français' }]} value={lang} onChange={setLang} />
        </View>

        <View style={{ gap: 8 }}>
          <View style={[styles.row, { justifyContent: 'space-between', paddingHorizontal: 4 }]}>
            <T size="sm" weight="bold" color={colors.ink}>{t('Neighbourhood theme')}</T>
            <T size="xs" color={colors.inkMuted}>{t('Game and app')}</T>
          </View>
          <View style={[styles.row, { gap: 10, flexWrap: 'wrap' }]}>
            {THEME_ORDER.map((key) => {
              const tile = { key, label: THEMES[key].name[lang], color: APP_PALETTES[key].forest };
              const active = playTheme === tile.key;
              return (
                <Spring
                  key={tile.key}
                  onPress={() => setPlayTheme(tile.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.themeTile, active && { borderWidth: 2, borderColor: colors.forest }]}
                >
                  <View style={[styles.swatch, { backgroundColor: tile.color }]}>
                    {active && <Icon name="check" size={16} color={colors.white} />}
                  </View>
                  <T size="xs" weight={active ? 'bold' : 'semibold'} numberOfLines={1}>{tile.label}</T>
                </Spring>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={() => { signOut(); router.replace('/'); }}
          style={styles.signOut}
        >
          <T size="xs" weight="semibold" color={colors.inkMuted}>{t('Sign out')}</T>
        </Pressable>
      </ScrollView>
      <AreaSheet visible={areaOpen} onClose={() => setAreaOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  main: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40, gap: 16 },
  back: { paddingHorizontal: 20, paddingTop: 12 },
  identity: { borderRadius: radius['3xl'], padding: 20, gap: 16 },
  bigAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  levelChip: { alignSelf: 'flex-start', maxWidth: '100%', marginTop: 4, paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.white },
  track: { height: 10, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.8)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  stat: { flex: 1, borderRadius: radius['2xl'], padding: 12, alignItems: 'center' },
  themeTile: {
    flexBasis: '30%',
    flexGrow: 1,
    borderRadius: radius['2xl'],
    padding: 12,
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.88)',
  },
  area: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius['2xl'],
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.88)',
    boxShadow: '0px 10px 30px -10px rgba(20, 92, 64, 0.12), inset 0px 1px 0px rgba(255, 255, 255, 0.9)',
  },
  areaIcon: { width: 40, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  signOut: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
});
