/**
 * Friends (owner: Juan): search a username, send a request, accept or decline, list, remove.
 * Opened from the Friends button on Community; no tab bar here.
 * Search is public.find_players (it finds private players too: private hides scores, never the name).
 * Everything else reads and writes public.friendships directly; row-level security limits each user to
 * rows they are part of, and only the person who was asked can accept (supabase/migrations/…_init.sql).
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { CircleButton, Glass, Icon, PrimaryButton, Screen, ScreenHeader, Spring, T } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useApp } from '../state/AppState';
import { colors, fonts, radius, shadow } from '../theme';

type Status = 'none' | 'sent' | 'received' | 'friends';
type Found = { id: string; username: string; friendship_status: Status };
/** One friendship row, seen from my side. */
type Link = { otherId: string; username: string; status: Status };

const initialsOf = (name: string) => name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';

// friendships has two keys to profiles, so each embed names the foreign key it follows.
const LINK_SELECT =
  'user_id, friend_id, status, asker:profiles!friendships_user_id_fkey(username), asked:profiles!friendships_friend_id_fkey(username)';
type LinkRow = {
  user_id: string; friend_id: string; status: 'pending' | 'accepted';
  asker: { username: string } | null; asked: { username: string } | null;
};

export default function FriendsScreen() {
  const router = useRouter();
  const { userId } = useApp();
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // id of the player an action is running for
  const [error, setError] = useState<string | null>(null);

  /** My friendship rows from my side, or null when the request failed. */
  const fetchLinks = useCallback(async (): Promise<Link[] | null> => {
    if (!supabase || !userId) return [];
    const { data, error: e } = await supabase.from('friendships').select(LINK_SELECT).order('created_at', { ascending: false });
    if (e) return null;
    return (data as unknown as LinkRow[]).map((r) => {
      const iAsked = r.user_id === userId;
      return {
        otherId: iAsked ? r.friend_id : r.user_id,
        username: (iAsked ? r.asked : r.asker)?.username ?? 'Player',
        status: r.status === 'accepted' ? 'friends' : iAsked ? 'sent' : 'received',
      };
    });
  }, [userId]);
  const applyLinks = (r: Link[] | null) => {
    setLoading(false);
    if (r) setLinks(r);
    else setError('Could not load your friends. Check your connection.');
  };
  const loadLinks = () => fetchLinks().then(applyLinks);

  // Replies can arrive out of order; only the latest search may update the results.
  const latest = useRef(0);
  const search = useCallback(async (q: string) => {
    const ticket = ++latest.current;
    if (!supabase || q.trim().length < 2) { setFound(null); setSearching(false); return; }
    setSearching(true);
    const { data, error: e } = await supabase.rpc('find_players', { q: q.trim() });
    if (ticket !== latest.current) return;
    setSearching(false);
    if (e) { setError('Search failed. Check your connection.'); return; }
    setFound(data as Found[]);
  }, []);

  useEffect(() => {
    let current = true;
    fetchLinks().then((r) => { if (current) applyLinks(r); });
    return () => { current = false; };
  }, [fetchLinks]);

  // Search 300 ms after the last keystroke.
  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  /** Runs one friendship change, then refreshes the list and the search results. */
  const act = async (otherId: string, run: () => PromiseLike<{ error: { code?: string } | null }>) => {
    setBusy(otherId);
    setError(null);
    const { error: e } = await run();
    // 23505 = unique pair: they sent you a request at the same moment; it now shows under Requests.
    if (e) setError(e.code === '23505' ? 'They already sent you a request. Accept it below.' : 'That did not work. Try again.');
    await Promise.all([loadLinks(), search(query)]);
    setBusy(null);
  };

  const sb = supabase;
  const add = (id: string) => sb && userId && act(id, () => sb.from('friendships').insert({ user_id: userId, friend_id: id }));
  const accept = (id: string) => sb && act(id, () => sb.from('friendships').update({ status: 'accepted' }).eq('user_id', id).eq('friend_id', userId!));
  // Decline, cancel and remove all delete the pair's row, whichever direction it was sent in.
  const drop = (id: string) => sb && act(id, () =>
    sb.from('friendships').delete().or(`and(user_id.eq.${userId},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${userId})`));
  const confirmRemove = (l: Link) => Alert.alert(`Remove ${l.username}?`, 'You will no longer see each other on the friends board.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => drop(l.otherId) },
  ]);

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/community'));
  const received = links.filter((l) => l.status === 'received');
  const sent = links.filter((l) => l.status === 'sent');
  const friends = links.filter((l) => l.status === 'friends');

  if (!supabase || !userId) {
    return (
      <Screen>
        <View style={styles.back}><CircleButton icon="arrow-back" label="Back" onPress={back} /></View>
        <ScreenHeader eyebrow="Sort together" title="Friends" style={{ paddingTop: 12 }} />
        <View style={styles.main}>
          <Glass style={styles.empty}>
            <Icon name="group-add" size={32} color={colors.forest} />
            <T size="sm" weight="semibold" style={{ textAlign: 'center' }}>Sign in to add friends</T>
            <T size="xs" color={colors.inkMuted} style={{ textAlign: 'center' }}>
              Friends see each other on the Community board, even when their scores are not public.
            </T>
            <PrimaryButton label="Sign in" size="md" onPress={() => router.navigate('/')} style={{ alignSelf: 'stretch' }} />
          </Glass>
        </View>
      </Screen>
    );
  }

  /** Right-hand action for a player, from my side of the friendship. */
  const action = (id: string, status: Status, username: string) => {
    if (busy === id) return <ActivityIndicator color={colors.forest} />;
    switch (status) {
      case 'none': return <Chip label="Add" icon="person-add" solid onPress={() => add(id)} hint={`Send ${username} a friend request`} />;
      case 'sent': return <Chip label="Requested" icon="schedule" onPress={() => drop(id)} hint={`Cancel your request to ${username}`} />;
      case 'received': return <Chip label="Accept" icon="check" solid onPress={() => accept(id)} hint={`Accept ${username}'s request`} />;
      case 'friends': return <View style={styles.friendTag}><Icon name="check-circle" size={16} color={colors.forest} /><T size="xs" weight="semibold" color={colors.forest}>Friends</T></View>;
    }
  };

  return (
    <Screen>
      <View style={styles.back}><CircleButton icon="arrow-back" label="Back" onPress={back} /></View>
      <ScreenHeader
        eyebrow={friends.length ? `${friends.length} friend${friends.length === 1 ? '' : 's'}` : 'Sort together'}
        title="Friends"
        style={{ paddingTop: 12 }}
      />

      <ScrollView contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.search, shadow.sm]}>
          <Icon name="search" size={20} color={colors.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search a username"
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search players by username"
            style={styles.input}
          />
          {searching ? <ActivityIndicator color={colors.forest} /> : query.length > 0 && (
            <Spring onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" pressedScale={0.9}>
              <Icon name="close" size={18} color={colors.inkMuted} />
            </Spring>
          )}
        </View>

        {error && (
          <View accessibilityLiveRegion="polite" style={styles.error}>
            <Icon name="error-outline" size={18} color="#9A3B24" />
            <T size="xs" color="#9A3B24" style={{ flex: 1 }}>{error}</T>
          </View>
        )}

        {found && (
          <Section title="Results">
            {found.length === 0
              ? <T size="sm" color={colors.inkMuted} style={styles.note}>No player called “{query.trim()}”.</T>
              : found.map((p) => <Row key={p.id} name={p.username} right={action(p.id, p.friendship_status, p.username)} />)}
          </Section>
        )}

        {received.length > 0 && (
          <Section title={`Requests · ${received.length}`}>
            {received.map((l) => (
              <Row key={l.otherId} name={l.username} sub="wants to be friends" right={busy === l.otherId ? <ActivityIndicator color={colors.forest} /> : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Chip label="Decline" onPress={() => drop(l.otherId)} hint={`Decline ${l.username}'s request`} />
                  <Chip label="Accept" icon="check" solid onPress={() => accept(l.otherId)} hint={`Accept ${l.username}'s request`} />
                </View>
              )} />
            ))}
          </Section>
        )}

        <Section title="Your friends">
          {loading ? <ActivityIndicator color={colors.forest} style={{ padding: 16 }} />
            : friends.length === 0
              ? <T size="sm" color={colors.inkMuted} style={styles.note}>No friends yet. Search a username above to send a request.</T>
              : friends.map((l) => (
                <Row key={l.otherId} name={l.username} right={busy === l.otherId ? <ActivityIndicator color={colors.forest} /> : (
                  <Spring onPress={() => confirmRemove(l)} accessibilityRole="button" accessibilityLabel={`Remove ${l.username}`} pressedScale={0.9} style={styles.iconBtn}>
                    <Icon name="person-remove" size={20} color={colors.inkMuted} />
                  </Spring>
                )} />
              ))}
        </Section>

        {sent.length > 0 && (
          <Section title="Sent">
            {sent.map((l) => (
              <Row key={l.otherId} name={l.username} sub="waiting for them" right={busy === l.otherId ? <ActivityIndicator color={colors.forest} /> : (
                <Chip label="Cancel" onPress={() => drop(l.otherId)} hint={`Cancel your request to ${l.username}`} />
              )} />
            ))}
          </Section>
        )}
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T size="xs" weight="semibold" color={colors.inkMuted} style={{ paddingHorizontal: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</T>
      <Glass style={styles.list}>{children}</Glass>
    </View>
  );
}

function Row({ name, sub, right }: { name: string; sub?: string; right: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: colors.forest }]}>
        <T size="xs" weight="bold" color={colors.white}>{initialsOf(name)}</T>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size="sm" weight="semibold" numberOfLines={1}>{name}</T>
        {sub && <T size="xs" color={colors.inkMuted}>{sub}</T>}
      </View>
      {right}
    </View>
  );
}

function Chip({ label, icon, solid, onPress, hint }: { label: string; icon?: string; solid?: boolean; onPress: () => void; hint: string }) {
  return (
    <Spring onPress={onPress} accessibilityRole="button" accessibilityLabel={hint} pressedScale={0.95}
      style={[styles.chip, solid ? { backgroundColor: colors.forest } : styles.chipGhost]}>
      {icon && <Icon name={icon} size={16} color={solid ? colors.white : colors.forest} />}
      <T size="xs" weight="semibold" color={solid ? colors.white : colors.forest}>{label}</T>
    </Spring>
  );
}

const styles = StyleSheet.create({
  back: { paddingHorizontal: 20, paddingTop: 8 },
  main: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48, gap: 20 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16,
    borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: colors.white,
  },
  input: { flex: 1, fontSize: 15, fontFamily: fonts.regular, color: colors.ink, paddingVertical: 12 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius['2xl'], backgroundColor: 'rgba(255, 236, 228, 0.92)' },
  list: { paddingVertical: 4, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 12, paddingVertical: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 14, borderRadius: radius.full },
  chipGhost: { backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: 'rgba(23,107,77,0.25)' },
  friendTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  note: { padding: 16, textAlign: 'center' },
  empty: { margin: 0, padding: 24, gap: 12, alignItems: 'center' },
});
