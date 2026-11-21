/**
 * Social, "Today's podium" (ui-references/.../frosted_mint_social_podium_classic).
 * Signed in with Supabase: today's real leaderboard (public.leaderboard, today in Montréal time).
 * Otherwise, or with fewer than 3 players (the podium needs 3), the demo lists with "You" added.
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { TAB_BAR_SPACE } from '../../components/TabBar';
import { AvatarButton, Glass, Icon, PrimaryButton, Screen, Segmented, T, XpPill } from '../../components/ui';
import { CITY, FRIENDS, Ranked } from '../../data/items';
import { supabase } from '../../lib/supabase';
import { initialsOf, useApp } from '../../state/AppState';
import { colors, radius, shadow } from '../../theme';

type Scope = 'friends' | 'city';

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

export default function SocialScreen() {
  const { xpToday, initials, userId } = useApp();
  const [scope, setScope] = useState<Scope>('friends');
  const [live, setLive] = useState<{ scope: Scope; rows: Ranked[] } | null>(null);

  // Refetch when the scope changes or the player earns XP.
  useEffect(() => {
    if (!supabase || !userId) return;
    let current = true;
    supabase.rpc('leaderboard', { scope }).then(({ data, error }) => {
      if (!current || error || !data) return;
      const rows = (data as { username: string; xp_today: number; is_me: boolean }[]).map((r) => ({
        name: r.is_me ? 'You' : r.username, initials: initialsOf(r.username), xp: r.xp_today, you: r.is_me,
      }));
      setLive({ scope, rows });
    });
    return () => { current = false; };
  }, [scope, userId, xpToday]);

  const ranking = useMemo(() => {
    if (userId && live?.scope === scope && live.rows.length >= 3) return live.rows;
    const me: Ranked = { name: 'You', initials, xp: xpToday, you: true };
    return [...(scope === 'friends' ? FRIENDS : CITY), me].sort((a, b) => b.xp - a.xp);
  }, [scope, xpToday, initials, userId, live]);

  const [first, second, third] = ranking;
  const rest = ranking.slice(3, 8);

  const share = () => {
    const lines = ranking.slice(0, 3).map((p, i) => `${i + 1}. ${p.name} +${p.xp} XP`);
    Share.share({ message: `Today's TriMTL podium ♻️\n${lines.join('\n')}` });
  };

  const youTone = (p: Ranked, base: string) => (p.you ? colors.forest : base);

  return (
    <Screen variant="pearl" edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexShrink: 1 }}>
          <T size="3xl" display style={{ lineHeight: 36 }}>Today's podium</T>
          <T size="xs" color={colors.inkMuted}>{scope === 'friends' ? 'Your friend group' : 'All players'} · Montréal</T>
        </View>
        <View style={styles.row}>
          <XpPill />
          <AvatarButton />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.main} showsVerticalScrollIndicator={false}>
        <Segmented
          options={[{ key: 'friends', label: 'Friends' }, { key: 'city', label: 'Montréal' }]}
          value={scope}
          onChange={setScope}
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.72)', borderColor: 'rgba(255, 255, 255, 0.88)', boxShadow: '0px 10px 30px -10px rgba(20, 92, 64, 0.12)' }}
        />

        <View accessibilityLabel="Top 3 today" style={styles.podium}>
          {/* 2nd */}
          <View style={styles.col}>
            <View>
              <Avatar p={second} size={48} bg={second.you ? colors.forestDeep : colors.white} fg={second.you ? colors.white : colors.ink} />
              <RankBadge n={2} bg={second.you ? colors.forest : colors.ink} />
            </View>
            <View style={{ alignItems: 'center' }}>
              <T size="xs" weight={second.you ? 'bold' : 'semibold'} numberOfLines={1} style={{ maxWidth: 96 }}>{second.name}</T>
              <T weight="semibold" color={youTone(second, colors.inkMuted)} style={{ fontSize: 11, lineHeight: 16 }}>+{second.xp} XP</T>
            </View>
            {second.you ? (
              <View style={[styles.block, styles.youBlock, { height: 96 }]}><T size="2xl" display color={colors.white}>2</T></View>
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
              <T size="xs" weight="bold" numberOfLines={1} style={{ maxWidth: 100 }}>{first.name}</T>
              <T size="xs" weight="bold" color={colors.forest}>+{first.xp} XP</T>
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
              <T size="xs" weight={third.you ? 'bold' : 'semibold'} numberOfLines={1} style={{ maxWidth: 96 }}>{third.name}</T>
              <T weight="semibold" color={youTone(third, colors.inkMuted)} style={{ fontSize: 11, lineHeight: 16 }}>+{third.xp} XP</T>
            </View>
            {third.you ? (
              <View style={[styles.block, styles.youBlock, { height: 80 }]}><T size="2xl" display color={colors.white}>3</T></View>
            ) : (
              <Glass style={[styles.block, { height: 80 }]}><T size="2xl" display color={colors.inkMuted}>3</T></Glass>
            )}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <View style={[styles.row, { justifyContent: 'space-between', paddingHorizontal: 4 }]}>
            <T size="xs" weight="semibold" color={colors.inkMuted} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>Also sorting today</T>
            <T size="xs" color={colors.inkMuted}>Resets midnight</T>
          </View>
          {rest.map((p, i) => (
            <Glass key={p.name} style={[styles.listRow, p.you && { borderColor: colors.forest }]}>
              <View style={styles.row}>
                <View style={[styles.listRank, p.you && { backgroundColor: colors.forest }]}>
                  <T size="xs" weight="bold" color={p.you ? colors.white : colors.ink}>{i + 4}</T>
                </View>
                <T size="sm" weight="semibold" style={{ marginLeft: 4 }}>{p.name}</T>
              </View>
              <T size="xs" weight="bold" color={youTone(p, colors.inkMuted)}>+{p.xp} XP</T>
            </Glass>
          ))}
        </View>

        <PrimaryButton label="Share today's podium" icon="ios-share" onPress={share} style={{ gap: 8 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
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
  youBlock: { backgroundColor: colors.forest, ...shadow.md },
  listRow: { borderRadius: radius['2xl'], paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
});
