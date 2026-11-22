/**
 * Community (ui-references/.../frosted_mint_social_podium_classic): boroughs compete to sort right.
 * Today (default) or This week, in Montréal time (week starts Monday); both boards follow the switch.
 * Players: public.board(period), one list. The podium is the top 3 by XP; below it, you and your friends
 * first, then everyone else, each keeping their overall rank. With fewer than 3 real players (the podium
 * needs 3), demo players fill in and a note says so; real friends are never replaced.
 * Boroughs: real totals from public.borough_board(period) for all 19 boroughs (0 where nobody lives).
 * Signed out, both boards are demo data plus your own XP.
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { TAB_BAR_SPACE } from '../../components/TabBar';
import { SkyBackdrop } from '../../game/Backdrop';
import { skyInk, THEMES } from '../../game/themes';
import { useRouter } from 'expo-router';

import { AvatarButton, CircleButton, Glass, Icon, PrimaryButton, Screen, ScreenHeader, Segmented, Spring, T } from '../../components/ui';
import { CITY, Ranked } from '../../data/items';
import { BOROUGHS } from '../../data/rules';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../state/AppState';
import { colors, radius, shadow } from '../../theme';
import { brand } from '../../brand';

type Scope = 'boroughs' | 'players';
type Period = 'today' | 'week';
/** A board row: friend = accepted friend (players only), demo = filler while fewer than 3 played. */
type Row = Ranked & { friend?: boolean; demo?: boolean };

/** Two characters from a username: "alice" -> "AL", "user_3333" -> "US". */
const userInitials = (name: string) => name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';

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
  const [period, setPeriod] = useState<Period>('today');
  const unit = scope === 'boroughs' ? 'pts' : 'XP';
  const when = period === 'today' ? 'Today' : 'This week';
  // Each reply is tagged with the period it answers, so switching never shows the other period's numbers.
  const [live, setLive] = useState<{ period: Period; rows: Row[] } | null>(null);
  const [areas, setAreas] = useState<{ period: Period; points: Map<string, number> } | null>(null);

  // Refetch the board on show, on a period switch, and when the player earns XP.
  useEffect(() => {
    if (!supabase || !userId) return;
    let current = true;
    if (scope === 'players') {
      supabase.rpc('board', { period }).then(({ data, error }) => {
        if (!current || error || !data) return;
        setLive({ period, rows: (data as { username: string; xp: number; is_me: boolean; is_friend: boolean }[]).map((r) => ({
          name: r.is_me ? 'You' : r.username, initials: r.is_me ? initials : userInitials(r.username), xp: r.xp, you: r.is_me, friend: r.is_friend,
        })) });
      });
    } else {
      supabase.rpc('borough_board', { period }).then(({ data, error }) => {
        if (!current || error || !data) return;
        setAreas({ period, points: new Map((data as { borough: string; points: number }[]).map((r) => [r.borough, r.points])) });
      });
    }
    return () => { current = false; };
  }, [scope, period, userId, xpToday, initials]);

  const ranking = useMemo((): Row[] => {
    const byXp = (a: Row, b: Row) => b.xp - a.xp || a.name.localeCompare(b.name);
    if (scope === 'boroughs') {
      const real = userId && areas?.period === period ? areas.points : null;
      return BOROUGHS.map((b) => ({
        name: b.name,
        initials: initialsOf(b.name),
        // Demo: your XP counts for your borough on top of stable made-up points.
        xp: real ? (real.get(b.slug) ?? 0) : demoPoints(b.slug) + (b.slug === borough ? xpToday : 0),
        you: b.slug === borough,
      })).sort(byXp);
    }
    const rows: Row[] = userId && live?.period === period ? live.rows : [{ name: 'You', initials, xp: xpToday, you: true }];
    const filler = rows.length < 3 ? CITY.map((c) => ({ ...c, demo: true })) : [];
    return [...rows, ...filler].sort(byXp);
  }, [scope, period, xpToday, initials, borough, userId, live, areas]);

  const [first, second, third] = ranking;
  const mine = ranking.findIndex((r) => r.you);
  const below = ranking.map((r, i) => ({ ...r, rank: i + 1 })).slice(3);
  // Players: you and your friends first, all of them; then the rest. Your own row always shows.
  const circle = scope === 'players' ? below.filter((r) => r.you || r.friend) : [];
  const others = below.filter((r) => !circle.includes(r)).filter((r) => r.rank <= (scope === 'players' ? 10 : 8) || r.you);
  const hasDemo = scope === 'players' && ranking.some((r) => r.demo);

  const share = () => {
    const lines = ranking.slice(0, 3).map((p, i) => `${i + 1}. ${p.name} ${p.xp} ${unit}`);
    const what = scope === 'boroughs' ? 'borough podium' : 'player podium';
    Share.share({ message: `${period === 'today' ? "Today's" : "This week's"} ${brand.appName} ${what} ♻️\n${lines.join('\n')}` });
  };

  const listRow = (p: Row & { rank: number }) => (
    <Glass key={`${p.rank}-${p.name}`} style={[styles.listRow, p.you && { borderColor: colors.forest }]}>
      <View style={[styles.row, { flex: 1, marginRight: 8 }]}>
        <View style={[styles.listRank, p.you && { backgroundColor: colors.forest }]}>
          <T size="xs" weight="bold" color={p.you ? colors.white : colors.ink}>{p.rank}</T>
        </View>
        <T size="sm" weight="semibold" numberOfLines={1} style={{ marginLeft: 4, flexShrink: 1 }}>{p.name}</T>
        {p.demo && <T size="xs" color={colors.inkMuted}>demo</T>}
      </View>
      <T size="xs" weight="bold" color={p.you ? colors.forest : colors.inkMuted}>{p.xp} {unit}</T>
    </Glass>
  );

  // Text sitting straight on the page (not on a card) takes the Play ground's ink, so it reads on Nuit too.
  const ground = THEMES[playTheme];
  const youTone = (p: Ranked, base: string) => (p.you ? colors.forest : base);

  return (
    <Screen edges={['top']} background={<SkyBackdrop theme={THEMES[playTheme]} />}>
      <ScreenHeader ink={skyInk(THEMES[playTheme])} eyebrow={`${when} · ${brand.city}`} title="Community" right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CircleButton icon="group-add" label="Friends" onPress={() => router.push('/friends')} />
          <AvatarButton />
        </View>
      } />

      <ScrollView contentContainerStyle={styles.main} showsVerticalScrollIndicator={false}>
        <Segmented
          options={[{ key: 'boroughs', label: 'Boroughs' }, { key: 'players', label: 'Players' }]}
          value={scope}
          onChange={setScope}
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.72)', borderColor: 'rgba(255, 255, 255, 0.88)', boxShadow: '0px 10px 30px -10px rgba(20, 92, 64, 0.12)' }}
        />
        <Segmented
          compact
          options={[{ key: 'today', label: 'Today' }, { key: 'week', label: 'This week' }]}
          value={period}
          onChange={setPeriod}
          style={{ alignSelf: 'center', marginTop: -8 }}
        />

        {scope === 'boroughs' && mine === -1 && (
          <Spring onPress={() => router.push('/profile')} accessibilityRole="button" pressedScale={0.98} style={styles.cta}>
            <Icon name="location-city" size={18} color={colors.forest} />
            <T size="sm" weight="semibold" style={{ flex: 1 }}>Pick your borough to sort for your neighbourhood</T>
            <Icon name="chevron-right" size={18} color={colors.inkMuted} />
          </Spring>
        )}

        <View accessibilityLabel={`Top 3 ${period === 'today' ? 'today' : 'this week'}`} style={styles.podium}>
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

        {circle.length > 0 && (
          <View style={{ gap: 8 }}>
            <View style={[styles.row, { justifyContent: 'space-between', paddingHorizontal: 4 }]}>
              <T size="xs" weight="semibold" color={ground.laneMuted} style={styles.sectionLabel}>You and friends</T>
              <T size="xs" color={ground.laneMuted}>{period === 'today' ? 'Resets at midnight' : 'Resets Monday'}</T>
            </View>
            {circle.map(listRow)}
          </View>
        )}

        {others.length > 0 && (
          <View style={{ gap: 8 }}>
            <View style={[styles.row, { justifyContent: 'space-between', paddingHorizontal: 4 }]}>
              <T size="xs" weight="semibold" color={ground.laneMuted} style={styles.sectionLabel}>{scope === 'boroughs' ? 'Other boroughs' : 'Also sorting'}</T>
              {circle.length === 0 && <T size="xs" color={ground.laneMuted}>{period === 'today' ? 'Resets at midnight' : 'Resets Monday'}</T>}
            </View>
            {others.map(listRow)}
          </View>
        )}

        {hasDemo && (
          <T size="xs" color={ground.laneMuted} style={{ textAlign: 'center', marginTop: -8 }}>
            {userId ? `Demo players fill in until 3 people play ${period === 'today' ? 'today' : 'this week'}.` : 'Demo players. Sign in to see real scores.'}
          </T>
        )}

        <PrimaryButton label={`Share ${period === 'today' ? "today's" : "this week's"} podium`} icon="ios-share" onPress={share} style={{ gap: 8 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  podiumName: { maxWidth: 100, textAlign: 'center' },
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 0.6 },
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
