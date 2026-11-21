/**
 * My Profile (ui-references/.../frosted_mint_my_profile). No tab bar on this screen.
 */
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BentoBackdrop, CircleButton, Glass, Icon, Screen, Spring, T } from '../components/ui';
import { levelFor, useApp } from '../state/AppState';
import { colors, radius, shadow } from '../theme';

const THEMES = [
  { key: 'forest', label: 'Forest', color: colors.forest },
  { key: 'ocean', label: 'Ocean', color: colors.ocean },
  { key: 'lavender', label: 'Lavender', color: colors.lavender },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { username, initials, xp, stats, games, theme, setTheme, signOut } = useApp();
  const { level, next, progress } = levelFor(xp);
  const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;

  return (
    <Screen variant="pearl">
      <BentoBackdrop rows={1} opacity={0.55} />
      <View style={styles.header}>
        <CircleButton icon="arrow-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/scan'))} />
        <T size="2xl" display>My Profile</T>
        <CircleButton icon="settings" label="Settings" />
      </View>

      <ScrollView contentContainerStyle={styles.main} showsVerticalScrollIndicator={false}>
        <Glass style={styles.identity}>
          <View style={[styles.row, { gap: 16 }]}>
            <View style={[styles.bigAvatar, shadow.md]}>
              <T size="xl" weight="bold" color={colors.white}>{initials}</T>
            </View>
            <View>
              <T size="xl" weight="bold">{username}</T>
              <View style={[styles.levelChip, shadow.sm]}>
                <T size="xs" weight="semibold" color={colors.forest}>Level {level} • Montréal</T>
              </View>
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <T size="xs" weight="semibold" color={colors.inkMuted}>Level progress</T>
              <T size="xs" weight="semibold" color={colors.forest} style={{ fontVariant: ['tabular-nums'] }}>{xp} / {next} XP</T>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        </Glass>

        <View accessibilityLabel="Stats" style={[styles.row, { gap: 10 }]}>
          {[
            { v: String(xp), l: 'Total XP', c: colors.forest },
            { v: `${accuracy}%`, l: 'Accuracy', c: colors.ink },
            { v: String(stats.games), l: 'Games', c: colors.ink },
          ].map((s) => (
            <Glass key={s.l} style={styles.stat}>
              <T size="xl" weight="bold" color={s.c} style={{ fontVariant: ['tabular-nums'] }}>{s.v}</T>
              <T size="xs" color={colors.inkMuted}>{s.l}</T>
            </Glass>
          ))}
        </View>

        <View style={{ gap: 8 }}>
          <View style={[styles.row, { justifyContent: 'space-between', paddingHorizontal: 4 }]}>
            <T size="sm" weight="bold">App theme</T>
            <T size="xs" weight="semibold" color={colors.forest}>All 3 unlocked</T>
          </View>
          <View style={[styles.row, { gap: 10 }]}>
            {THEMES.map((t) => {
              const active = theme === t.key;
              return (
                <Spring
                  key={t.key}
                  onPress={() => setTheme(t.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.themeTile, active && { borderWidth: 2, borderColor: colors.forest }]}
                >
                  <View style={[styles.swatch, { backgroundColor: t.color }]}>
                    {active && <Icon name="check" size={16} color={colors.white} />}
                  </View>
                  <T size="xs" weight={active ? 'bold' : 'semibold'}>{t.label}</T>
                </Spring>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <T size="sm" weight="bold" style={{ paddingHorizontal: 4 }}>Recent games</T>
          {games.slice(0, 3).map((g, i) => {
            const score = Math.round((g.correct / Math.max(1, g.items)) * 100);
            return (
              <Glass key={`${g.title}-${i}`} style={styles.game}>
                <View>
                  <T size="sm" weight="semibold">{g.title}</T>
                  <T size="xs" color={colors.inkMuted}>{g.items} items • {g.when}</T>
                </View>
                <T size="xs" weight="bold" color={score === 100 ? colors.forest : colors.inkMuted} style={{ fontVariant: ['tabular-nums'] }}>
                  {score} / 100
                </T>
              </Glass>
            );
          })}
        </View>

        <Pressable
          onPress={() => { signOut(); router.dismissTo('/'); }}
          style={styles.signOut}
        >
          <T size="xs" weight="semibold" color={colors.inkMuted}>Sign out</T>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center' },
  main: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40, gap: 16 },
  identity: { borderRadius: radius['3xl'], padding: 20, gap: 16 },
  bigAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  levelChip: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.white },
  track: { height: 10, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.8)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.forest },
  stat: { flex: 1, borderRadius: radius['2xl'], padding: 12, alignItems: 'center' },
  themeTile: {
    flex: 1,
    borderRadius: radius['2xl'],
    padding: 12,
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.88)',
  },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  game: { borderRadius: radius['2xl'], paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  signOut: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
});
