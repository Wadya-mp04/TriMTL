/**
 * Community (ui-references/.../frosted_mint_social_podium_classic): boroughs compete to sort right.
 * Players: today's real city leaderboard from Supabase (public.leaderboard) when signed in and at least
 * 3 players have scored today (the podium needs 3); otherwise the demo list plus "You".
 * shortcut: borough standings are demo data plus the user's real XP today (accounts don't store a borough yet).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, Share, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { TAB_BAR_SPACE } from '../../components/TabBar';
import { skyInk, THEMES } from '../../game/themes';
import { useRouter } from 'expo-router';

import { AvatarButton, Glass, Icon, PrimaryButton, Screen, ScreenHeader, Segmented, Spring, T } from '../../components/ui';
import { CITY, Ranked } from '../../data/items';
import { BOROUGHS } from '../../data/rules';
import { motionMs } from '../../lib/motion';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../state/AppState';
import { colors, radius, shadow } from '../../theme';
import { brand } from '../../brand';

type Scope = 'boroughs' | 'players';

/** Two letters from the borough's main words: "Le Plateau-Mont-Royal" -> "PM". */
const initialsOf = (name: string) =>
  name.split(/[\s–'-]+/).filter((w) => /^[A-ZÀ-Ý]/.test(w) && !['Le', 'La', 'L'].includes(w)).slice(0, 2).map((w) => w[0]).join('');

/** Stable demo points per borough, so the standings don't jump between renders. */
const demoPoints = (slug: string) => 300 + ([...slug].reduce((n, c) => n * 31 + c.charCodeAt(0), 7) % 600);

function Avatar({ p, size, bg, fg }: { p: Ranked; size: number; bg: string; fg: string }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }, size > 50 ? shadow.md : shadow.sm]}>
      <T size={size > 50 ? 'sm' : 'xs'} weight="bold" color={fg}>{p.initials}</T>
    </View>
  );
}

function RankBadge({ n, bg }: { n: number; bg: string }) {
  return (
    <View style={[styles.rankBadge, { backgroundColor: bg }]}>
      <T weight="bold" color={colors.white} style={{ fontSize: 10, lineHeight: 12 }}>{n}</T>
    </View>
  );
}

/** `.podium-first`: white → mint vertical glass gradient. */
function FirstBlock() {
  return (
    <View style={[styles.block, { height: 128, borderColor: 'rgba(255,255,255,0.95)', borderWidth: 1, boxShadow: '0px 14px 32px -10px rgba(20,92,64,0.18), inset 0px 1px 0px rgba(255,255,255,0.95)' }]}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="p1" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="1" stopColor="#E2F5E9" stopOpacity={0.78} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#p1)" />
      </Svg>
      <T size="3xl" display color={colors.forest}>1</T>
    </View>
  );
}

export default function CommunityScreen() {
  const router = useRouter();
  const { xpToday, initials, borough, userId, playTheme } = useApp();
  const [scope, setScope] = useState<Scope>('boroughs');
  // Switching Boroughs / Players: the new ranking fades in with a slight rise, in step with the switch's highlight.
  const swap = useRef(new Animated.Value(1)).current;
  const firstScope = useRef(true);
  useEffect(() => {
    if (firstScope.current) { firstScope.current = false; return; }
    swap.setValue(0);
    Animated.timing(swap, { toValue: 1, duration: motionMs(280), easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [scope, swap]);
  const swapStyle = { opacity: swap, transform: [{ translateY: swap.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] };
  const unit = scope === 'boroughs' ? 'pts' : 'XP';
  const [live, setLive] = useState<Ranked[] | null>(null);

  // Refetch the player board when it is shown or the player earns XP.
  useEffect(() => {
    if (!supabase || !userId || scope !== 'players') return;
    let current = true;
    supabase.rpc('leaderboard', { scope: 'city' }).then(({ data, error }) => {
      if (!current || error || !data) return;
      setLive((data as { username: string; xp_today: number; is_me: boolean }[]).map((r) => ({
        name: r.is_me ? 'You' : r.username, initials: initialsOf(r.username), xp: r.xp_today, you: r.is_me,
      })));
    });
    return () => { current = false; };
  }, [scope, userId, xpToday]);

  const ranking = useMemo(() => {
    if (scope === 'boroughs') {
      // Your XP today counts for your borough.
      return BOROUGHS.map((b) => ({
        name: b.name,
        initials: initialsOf(b.name),
        xp: demoPoints(b.slug) + (b.slug === borough ? xpToday : 0),
        you: b.slug === borough,
      })).sort((a, b) => b.xp - a.xp);
    }
    if (userId && live && live.length >= 3) return live;
    const me: Ranked = { name: 'You', initials, xp: xpToday, you: true };
    return [...CITY, me].sort((a, b) => b.xp - a.xp);
  }, [scope, xpToday, initials, borough, userId, live]);

  const [first, second, third] = ranking;
  // Always show your own row, even if you're outside the top 8.
  const mine = ranking.findIndex((r) => r.you);
  const rest = ranking.map((r, i) => ({ ...r, rank: i + 1 })).filter((r) => (r.rank > 3 && r.rank <= 8) || (r.you && r.rank > 3));

  const share = () => {
    const lines = ranking.slice(0, 3).map((p, i) => `${i + 1}. ${p.name} ${p.xp} ${unit}`);
    const what = scope === 'boroughs' ? 'borough podium' : 'player podium';
    Share.share({ message: `This week's ${brand.appName} ${what} ♻️\n${lines.join('\n')}` });
  };

  // Text sitting straight on the page (not on a card) takes the Play ground's ink, so it reads on Nuit too.
  const ground = THEMES[playTheme];
  const youTone = (p: Ranked, base: string) => (p.you ? colors.forest : base);

  return (
    <Screen edges={['top']} transparent>
      <ScreenHeader ink={skyInk(THEMES[playTheme])} eyebrow={`This week · ${brand.city}`} title="Community" right={<AvatarButton />} />

      <ScrollView contentContainerStyle={styles.main} showsVerticalScrollIndicator={false}>
        <Segmented
          options={[{ key: 'boroughs', label: 'Boroughs' }, { key: 'players', label: 'Players' }]}
          value={scope}
          onChange={setScope}
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.72)', borderColor: 'rgba(255, 255, 255, 0.88)', boxShadow: '0px 10px 30px -10px rgba(20, 92, 64, 0.12)' }}
        />

        <Animated.View style={[{ gap: 20 }, swapStyle]}>
        {scope === 'boroughs' && mine === -1 && (
          <Spring onPress={() => router.push('/profile')} accessibilityRole="button" pressedScale={0.98} style={styles.cta}>
            <Icon name="location-city" size={18} color={colors.forest} />
            <T size="sm" weight="semibold" style={{ flex: 1 }}>Pick your borough to sort for your neighbourhood</T>
            <Icon name="chevron-right" size={18} color={colors.inkMuted} />
          </Spring>
        )}

        <View accessibilityLabel="Top 3 this week" style={styles.podium}>
          {/* 2nd */}
          <View style={styles.col}>
            <View>
              <Avatar p={second} size={48} bg={second.you ? colors.forestDeep : colors.white} fg={second.you ? colors.white : colors.ink} />
              <RankBadge n={2} bg={second.you ? colors.forest : colors.ink} />
            </View>
            <View style={{ alignItems: 'center' }}>
              <T size="xs" weight={second.you ? 'bold' : 'semibold'} numberOfLines={2} color={ground.laneInk} style={styles.podiumName}>{second.name}</T>
              <T weight="semibold" color={youTone(second, ground.laneMuted)} style={{ fontSize: 11, lineHeight: 16 }}>{second.xp} {unit}</T>
            </View>
            {second.you ? (
              <View style={[styles.block, styles.youBlock, { height: 96, backgroundColor: colors.forest }]}><T size="2xl" display color={colors.white}>2</T></View>
            ) : (
              <Glass style={[styles.block, { height: 96 }]}><T size="2xl" display color={colors.inkMuted}>2</T></Glass>
            )}
          </View>

          {/* 1st */}
          <View style={styles.col}>
            <View>
              <Avatar p={first} size={56} bg={first.you ? colors.forestDeep : colors.forest} fg={colors.white} />
              <View style={[styles.trophy, shadow.sm]}>
                <Icon name="emoji-events" size={14} color={colors.forest} />
              </View>
            </View>
            <View style={{ alignItems: 'center' }}>
              <T size="xs" weight="bold" numberOfLines={2} color={ground.laneInk} style={styles.podiumName}>{first.name}</T>
              <T size="xs" weight="bold" color={colors.forest}>{first.xp} {unit}</T>
            </View>
            <FirstBlock />
          </View>

          {/* 3rd */}
          <View style={styles.col}>
            <View>
              <Avatar p={third} size={48} bg={third.you ? colors.forestDeep : colors.white} fg={third.you ? colors.white : colors.ink} />
              <RankBadge n={3} bg={third.you ? colors.forest : colors.ink} />
            </View>
            <View style={{ alignItems: 'center' }}>
              <T size="xs" weight={third.you ? 'bold' : 'semibold'} numberOfLines={2} color={ground.laneInk} style={styles.podiumName}>{third.name}</T>
              <T weight="semibold" color={youTone(third, ground.laneMuted)} style={{ fontSize: 11, lineHeight: 16 }}>{third.xp} {unit}</T>
            </View>
            {third.you ? (
              <View style={[styles.block, styles.youBlock, { height: 80, backgroundColor: colors.forest }]}><T size="2xl" display color={colors.white}>3</T></View>
            ) : (
              <Glass style={[styles.block, { height: 80 }]}><T size="2xl" display color={colors.inkMuted}>3</T></Glass>
            )}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <View style={[styles.row, { justifyContent: 'space-between', paddingHorizontal: 4 }]}>
            <T size="xs" weight="semibold" color={ground.laneMuted} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>{scope === 'boroughs' ? 'Other boroughs' : 'Also sorting'}</T>
            <T size="xs" color={ground.laneMuted}>Resets Monday</T>
          </View>
          {rest.map((p) => (
            <Glass key={p.name} style={[styles.listRow, p.you && { borderColor: colors.forest }]}>
              <View style={[styles.row, { flex: 1, marginRight: 8 }]}>
                <View style={[styles.listRank, p.you && { backgroundColor: colors.forest }]}>
                  <T size="xs" weight="bold" color={p.you ? colors.white : colors.ink}>{p.rank}</T>
                </View>
                <T size="sm" weight="semibold" numberOfLines={1} style={{ marginLeft: 4, flexShrink: 1 }}>{p.name}</T>
              </View>
              <T size="xs" weight="bold" color={youTone(p, colors.inkMuted)}>{p.xp} {unit}</T>
            </Glass>
          ))}
        </View>

        </Animated.View>

        <PrimaryButton label="Share this week's podium" icon="ios-share" onPress={share} style={{ gap: 8 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  podiumName: { maxWidth: 100, textAlign: 'center' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius['2xl'],
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.88)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  main: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: TAB_BAR_SPACE, gap: 20 },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 16 },
  col: { flex: 1, alignItems: 'center', gap: 8 },
  rankBadge: { position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  trophy: { position: 'absolute', top: -10, alignSelf: 'center', width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  block: {
    width: '100%',
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    borderBottomLeftRadius: radius['2xl'],
    borderBottomRightRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    overflow: 'hidden',
  },
  youBlock: { ...shadow.md },
  listRow: { borderRadius: radius['2xl'], paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
});
