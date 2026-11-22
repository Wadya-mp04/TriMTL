/**
 * Map: eco drop-offs and lane collection days. A Leaflet map in a WebView is the hero; search, filter chips
 * and a draggable sheet float over it. All data comes from src/data/map.ts (sample data for now).
 */
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Keyboard,
  Linking,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import { TAB_BAR_SPACE } from '../../components/TabBar';
import { CircleButton, Glass, Icon, IconBubble, PrimaryButton, SecondaryButton, Segmented, Spring, T } from '../../components/ui';
import { geocode, loadMapData, type DropoffType, type Lane, type MapData } from '../../data/map';
import { BottomSheet } from '../../map/BottomSheet';
import { Chip, DropoffDetails, DropoffRow, LaneDetails, LaneRow, Legend } from '../../map/Details';
import { DROPOFF_STYLE, mapHtml } from '../../map/mapHtml';
import { addDays, humanDay, localKey, upcoming } from '../../map/schedule';
import { colors, glass, radius, shadow } from '../../theme';

type Selection = { kind: 'lane' | 'dropoff'; id: string } | null;
type Notice = { icon: string; text: string; action?: { label: string; run: () => void } } | null;

const TYPES = Object.keys(DROPOFF_STYLE) as DropoffType[];
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  return Math.hypot(x, (b.lat - a.lat) * r) * 6_371_000;
}
const laneDistance = (l: Lane, p: { lat: number; lng: number }) => Math.min(...l.path.map(([lat, lng]) => metres(p, { lat, lng })));

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // WebView's typings default P to undefined, which collapses every prop to never; `object` restores them.
  const web = useRef<WebView<object>>(null);

  const [data, setData] = useState<MapData | null>(null);
  const [dataError, setDataError] = useState(false);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [webKey, setWebKey] = useState(0);
  const [filter, setFilter] = useState<DropoffType | 'all'>('all');
  const [when, setWhen] = useState<'today' | 'week'>('week');
  const [selected, setSelected] = useState<Selection>(null);
  const [sheet, setSheet] = useState(0);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [tilt, setTilt] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const today = localKey(now);

  // Keep "today" and open/closed honest if the tab stays open across a minute or midnight.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const load = useCallback(() => {
    setDataError(false);
    loadMapData().then(setData, () => setDataError(true));
  }, []);
  useEffect(load, [load]);

  const send = useCallback((m: object) => web.current?.injectJavaScript(`window.receive && window.receive(${JSON.stringify(m)});true;`), []);

  // Sheet heights: peek clears the floating tab bar; full stops below the search bar.
  const TOP = insets.top + 112;
  const [headerH, setHeaderH] = useState(150);
  const snaps = useMemo(() => [TAB_BAR_SPACE + 28 + headerH, Math.round(height * 0.52), height - insets.top - 64], [height, insets.top, headerH]);

  const laneLook = useMemo(() => {
    if (!data) return [];
    return data.lanes.map((l) => {
      const next = upcoming(l, today, 56)[0];
      const todays = next?.date === today;
      const streams = next?.streams ?? ['garbage'];
      return {
        id: l.id,
        kind: streams.length === 2 ? 'both' : streams[0],
        dim: when === 'today' ? !todays : !next || next.date > addDays(today, 6),
      };
    });
  }, [data, today, when]);

  const pins = useMemo(
    () =>
      (data?.dropoffs ?? [])
        .filter((d) => filter === 'all' || d.type === filter)
        .map((d) => ({
          id: d.id, lat: d.lat, lng: d.lng, name: d.name,
          icon: DROPOFF_STYLE[d.type].icon.replace(/-/g, '_'),
          color: DROPOFF_STYLE[d.type].color,
          a11y: `${d.name}, ${DROPOFF_STYLE[d.type].label}`,
        })),
    [data, filter],
  );

  // Push data to the page once it is ready, and again whenever filters or the day change.
  const pushed = useRef(false);
  useEffect(() => {
    if (mapState === 'loading' || !data) return;
    if (!pushed.current) {
      send({ type: 'motion', reduce: reduceMotion });
      send({ type: 'pad', top: TOP, bottom: snaps[sheet] });
      send({ type: 'data', lanes: data.lanes.map((l, i) => ({ ...laneLook[i], name: l.name, path: l.path })), pins });
      pushed.current = true;
    } else send({ type: 'data', lanes: data.lanes.map((l, i) => ({ ...laneLook[i], name: l.name, path: l.path })), pins });
    if (selected) send({ type: 'select', ...selected });
  }, [mapState, data, pins, laneLook, reduceMotion, send]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => send({ type: 'pad', top: TOP, bottom: snaps[sheet] }), [sheet, snaps, TOP, send]);

  // A map that never says ready is a map that did not load (offline, or a CDN down).
  useEffect(() => {
    if (mapState !== 'loading') return;
    const t = setTimeout(() => setMapState((s) => (s === 'loading' ? 'offline' : s)), 15_000);
    return () => clearTimeout(t);
  }, [mapState, webKey]);

  const select = useCallback(
    (s: Selection) => {
      Keyboard.dismiss();
      setFocused(false);
      setSelected(s);
      if (s) {
        const idx = Math.max(sheet, 1);
        setSheet(idx);
        send({ type: 'pad', top: TOP, bottom: snaps[idx] });
      }
      send({ type: 'select', ...(s ?? { id: null }) });
    },
    [sheet, snaps, TOP, send],
  );

  const onMessage = (e: WebViewMessageEvent) => {
    const m = JSON.parse(e.nativeEvent.data);
    if (m.type === 'ready') setMapState('ready');
    if (m.type === 'tiles' && !m.ok) setNotice({ icon: 'cloud-off', text: "Map tiles didn't load. The list below still works.", action: { label: 'Retry', run: retryMap } });
    if (m.type === 'tiles' && m.ok) setNotice((n) => (n?.icon === 'cloud-off' ? null : n));
    if (m.type === 'tap') m.kind ? select({ kind: m.kind, id: m.id }) : selected && select(null);
  };

  const retryMap = () => {
    pushed.current = false;
    setNotice(null);
    setMapState('loading');
    setWebKey((k) => k + 1);
  };

  const locate = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setNotice({
          icon: 'location-off',
          text: 'Location is off for TriMTL. Search an address instead, or turn it on in Settings.',
          action: perm.canAskAgain ? undefined : { label: 'Settings', run: () => Linking.openSettings() },
        });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMe(p);
      const far = data && Math.min(...data.dropoffs.map((d) => metres(p, d))) > 5000;
      if (far) setNotice({ icon: 'near-me', text: "You're outside the sample area, so the map stays on the Plateau." });
      else {
        setNotice(null);
        send({ type: 'me', ...p });
      }
    } catch {
      setNotice({ icon: 'location-searching', text: "Couldn't find your location. Try again outside, or search an address." });
    } finally {
      setLocating(false);
    }
  };

  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q || !data) return [];
    const lanes = data.lanes.filter((l) => fold(l.name).includes(q)).map((l) => ({ kind: 'lane' as const, id: l.id, title: l.name, sub: 'Lane', icon: 'route' }));
    const drops = data.dropoffs
      .filter((d) => fold(`${d.name} ${d.address}`).includes(q))
      .map((d) => ({ kind: 'dropoff' as const, id: d.id, title: d.name, sub: d.address, icon: DROPOFF_STYLE[d.type].icon }));
    return [...lanes, ...drops].slice(0, 6);
  }, [query, data]);

  const submitSearch = async () => {
    if (matches[0]) return select({ kind: matches[0].kind, id: matches[0].id });
    if (!query.trim() || !data) return;
    setSearching(true);
    try {
      const hit = await geocode(query.trim());
      if (hit === 'off-island') return setNotice({ icon: 'search-off', text: 'This trial covers the Island of Montréal only. Try a street or address on the island.' });
      if (!hit) return setNotice({ icon: 'search-off', text: `No street or address called "${query.trim()}" on the island. Try a street and number.` });
      const near = data.lanes.map((l) => ({ l, d: laneDistance(l, hit) })).sort((a, b) => a.d - b.d)[0];
      if (near && near.d < 150) select({ kind: 'lane', id: near.l.id });
      else {
        Keyboard.dismiss();
        setFocused(false);
        send({ type: 'place', ...hit });
        setNotice({ icon: 'info-outline', text: `${hit.label} isn't on a sample lane yet.` });
      }
    } catch {
      setNotice({ icon: 'cloud-off', text: "Search couldn't reach the map service. Check your connection and try again.", action: { label: 'Retry', run: submitSearch } });
    } finally {
      setSearching(false);
    }
  };

  const lane = selected?.kind === 'lane' ? data?.lanes.find((l) => l.id === selected.id) : undefined;
  const drop = selected?.kind === 'dropoff' ? data?.dropoffs.find((d) => d.id === selected.id) : undefined;
  const visibleDrops = useMemo(() => {
    const list = (data?.dropoffs ?? []).filter((d) => filter === 'all' || d.type === filter);
    return me ? [...list].sort((a, b) => metres(me, a) - metres(me, b)) : list;
  }, [data, filter, me]);

  const todayLanes = data?.lanes.filter((l) => upcoming(l, today, 1).length) ?? [];
  const nextAny = data?.lanes.map((l) => upcoming(l, today, 56)[0]).filter(Boolean).sort((a, b) => a!.date.localeCompare(b!.date))[0];
  const summary = !data
    ? ' '
    : when === 'today'
      ? todayLanes.length
        ? `${todayLanes.length} ${todayLanes.length === 1 ? 'lane is' : 'lanes are'} collected today`
        : `No pickups today on these lanes. Next: ${nextAny ? humanDay(nextAny.date, today) : 'none scheduled'}.`
      : `${data.lanes.length} lanes · ${data.dropoffs.length} drop-offs`;

  const header = (
    <View style={styles.sheetHeader} onLayout={(e) => !selected && setHeaderH(Math.round(e.nativeEvent.layout.height))}>
      {lane || drop ? (
        <View style={styles.titleRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>
              {lane ? `Lane · ${lane.borough}` : `${DROPOFF_STYLE[drop!.type].label} drop-off`} · Sample
            </T>
            <T display style={styles.title} numberOfLines={2} accessibilityRole="header">{lane ? lane.name : drop!.name}</T>
          </View>
          <CircleButton icon="close" label="Close details" onPress={() => select(null)} />
        </View>
      ) : (
        <>
          <View style={styles.titleRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>Plateau · Sample data</T>
              <T display style={styles.title} accessibilityRole="header">Pickups</T>
            </View>
            <Segmented
              options={[{ key: 'today', label: 'Today' }, { key: 'week', label: 'This week' }]}
              value={when}
              onChange={setWhen}
              style={{ width: 176 }}
            />
          </View>
          <Legend />
          <T size="xs" color={colors.inkMuted} accessibilityLiveRegion="polite">{summary}</T>
        </>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.mintCanvas }}>
      <WebView<object>
        key={webKey}
        ref={web}
        source={{ html: mapHtml(), baseUrl: 'https://trimtl.local/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        onError={() => setMapState('offline')}
        style={StyleSheet.absoluteFill}
        containerStyle={{ backgroundColor: colors.mintCanvas }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        accessibilityLabel="Map of lanes and drop-offs"
      />

      {mapState !== 'ready' && <MapCover state={mapState} onRetry={retryMap} top={TOP} bottom={snaps[0]} />}

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View style={styles.searchRow}>
          <View style={[glass, shadow.lg, styles.search]}>
            <Icon name="search" size={20} color={colors.inkMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={submitSearch}
              placeholder="Search a street or address"
              placeholderTextColor={colors.inkMuted}
              returnKeyType="search"
              accessibilityLabel="Search a street or address"
              style={styles.input}
            />
            {searching ? (
              <ActivityIndicator color={colors.inkMuted} />
            ) : query ? (
              <Spring onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} style={styles.clear}>
                <Icon name="close" size={16} color={colors.inkMuted} />
              </Spring>
            ) : null}
          </View>
          <Spring onPress={locate} pressedScale={0.95} accessibilityRole="button" accessibilityLabel="Use my location" style={[glass, shadow.lg, styles.locate]}>
            {locating ? <ActivityIndicator color={colors.forest} /> : <Icon name={me ? 'my-location' : 'near-me'} size={20} color={colors.forest} />}
          </Spring>
        </View>

        {focused && query.trim() !== '' && (
          <Glass style={[styles.results, shadow.lg]}>
            {matches.map((m) => (
              <Spring key={m.kind + m.id} onPress={() => select({ kind: m.kind, id: m.id })} pressedScale={0.98} accessibilityRole="button" accessibilityLabel={`${m.title}, ${m.sub}`} style={styles.result}>
                <Icon name={m.icon} size={18} color={colors.inkMuted} />
                <View style={{ flex: 1 }}>
                  <T size="sm" weight="semibold" numberOfLines={1}>{m.title}</T>
                  <T size="xs" color={colors.inkMuted} numberOfLines={1}>{m.sub}</T>
                </View>
              </Spring>
            ))}
            <Spring onPress={submitSearch} pressedScale={0.98} accessibilityRole="button" style={styles.result}>
              <Icon name="travel-explore" size={18} color={colors.forest} />
              <T size="sm" weight="semibold" color={colors.forest} numberOfLines={1} style={{ flex: 1 }}>Find "{query.trim()}" on the island</T>
            </Spring>
          </Glass>
        )}

        {!focused && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
            <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
            {TYPES.map((t) => (
              <Chip key={t} label={DROPOFF_STYLE[t].label} icon={DROPOFF_STYLE[t].icon} tint={DROPOFF_STYLE[t].color} active={filter === t} onPress={() => setFilter(filter === t ? 'all' : t)} />
            ))}
          </ScrollView>
        )}

        {notice && !focused && (
          <Glass style={[styles.notice, shadow.md]}>
            <Icon name={notice.icon} size={18} color={colors.inkMuted} />
            <T size="xs" weight="medium" style={{ flex: 1 }} accessibilityLiveRegion="polite">{notice.text}</T>
            {notice.action && (
              <Spring onPress={notice.action.run} accessibilityRole="button" hitSlop={8} style={styles.noticeAction}>
                <T size="xs" weight="bold" color={colors.forest}>{notice.action.label}</T>
              </Spring>
            )}
            <Spring onPress={() => setNotice(null)} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10} style={styles.clear}>
              <Icon name="close" size={16} color={colors.inkMuted} />
            </Spring>
          </Glass>
        )}
        <Spring
          onPress={() => { send({ type: 'tilt', on: !tilt }); setTilt(!tilt); }}
          pressedScale={0.95}
          accessibilityRole="switch"
          accessibilityState={{ checked: tilt }}
          accessibilityLabel="3D buildings and terrain"
          style={[glass, shadow.lg, styles.locate, styles.tilt]}
        >
          <T size="xs" weight="bold" color={tilt ? colors.forest : colors.inkMuted}>{tilt ? '3D' : '2D'}</T>
        </Spring>
      </View>

      <BottomSheet snaps={snaps} index={sheet} onIndexChange={setSheet} reduceMotion={reduceMotion} header={header}>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: TAB_BAR_SPACE + 24 }]} showsVerticalScrollIndicator={false}>
          {dataError ? (
            <View style={styles.empty}>
              <T size="sm" color={colors.inkMuted}>Lanes and drop-offs didn't load.</T>
              <SecondaryButton label="Try again" icon="refresh" onPress={load} />
            </View>
          ) : !data ? (
            <SkeletonRows />
          ) : lane ? (
            <LaneDetails lane={lane} today={today} />
          ) : drop ? (
            <DropoffDetails d={drop} now={now} />
          ) : (
            <>
              <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>
                {filter === 'all' ? 'Drop-offs' : `${DROPOFF_STYLE[filter].label} drop-offs`}{me ? ' · nearest first' : ''}
              </T>
              {visibleDrops.length ? (
                visibleDrops.map((d) => <DropoffRow key={d.id} d={d} now={now} distance={me ? metres(me, d) : undefined} onPress={() => select({ kind: 'dropoff', id: d.id })} />)
              ) : (
                <Glass style={styles.emptyCard}>
                  <T size="sm" color={colors.inkMuted}>No {DROPOFF_STYLE[filter as DropoffType].label.toLowerCase()} drop-offs in the sample yet.</T>
                  <Spring onPress={() => setFilter('all')} accessibilityRole="button" hitSlop={8}>
                    <T size="sm" weight="bold" color={colors.forest}>Show all</T>
                  </Spring>
                </Glass>
              )}
              <T size="xs" weight="semibold" color={colors.inkMuted} style={[styles.eyebrow, { marginTop: 12 }]}>Lanes</T>
              {data.lanes.map((l) => <LaneRow key={l.id} lane={l} today={today} onPress={() => select({ kind: 'lane', id: l.id })} />)}
              <T size="xs" color={colors.inkMuted} style={{ marginTop: 8 }}>
                Street shapes from OpenStreetMap. Schedules, drop-offs and hours are sample data for this trial, not the city's.
              </T>
            </>
          )}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

/** Calm placeholder while tiles arrive; a designed state, with a way out, if they never do. */
function MapCover({ state, onRetry, top, bottom }: { state: 'loading' | 'offline'; onRetry: () => void; top: number; bottom: number }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.mintCanvas, paddingTop: top, paddingBottom: bottom }]}>
      {state === 'loading' ? (
        <Animated.View style={[styles.skelMap, { opacity: pulse }]} accessibilityLabel="Loading the map">
          {[0, 1, 2, 3].map((i) => <View key={i} style={[styles.skelLine, { top: 40 + i * 70, transform: [{ rotate: '-34deg' }] }]} />)}
          {[0, 1].map((i) => <View key={`v${i}`} style={[styles.skelLine, { top: 120, left: 40 + i * 120, width: 260, transform: [{ rotate: '56deg' }] }]} />)}
        </Animated.View>
      ) : (
        <View style={styles.offline}>
          <IconBubble icon="cloud-off" color={colors.inkMuted} />
          <T display style={styles.title}>The map didn't load</T>
          <T size="sm" color={colors.inkMuted} style={{ textAlign: 'center' }}>You might be offline. Lanes and drop-offs are still listed below.</T>
          <PrimaryButton label="Try again" icon="refresh" size="md" onPress={onRetry} style={{ width: 200 }} />
        </View>
      )}
    </View>
  );
}

function SkeletonRows() {
  return (
    <View style={{ gap: 10 }} accessibilityLabel="Loading">
      {[0, 1, 2].map((i) => <View key={i} style={styles.skelRow} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0, top: 0, gap: 10 },
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  search: { flex: 1, height: 48, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  input: { flex: 1, height: 48, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, color: colors.ink },
  clear: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  locate: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tilt: { alignSelf: 'flex-end', marginRight: 16 },
  results: { marginHorizontal: 16, borderRadius: radius['2xl'], paddingVertical: 6 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 2 },
  notice: { marginHorizontal: 16, borderRadius: radius['2xl'], paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeAction: { paddingHorizontal: 6, minHeight: 28, justifyContent: 'center' },
  sheetHeader: { paddingHorizontal: 20, paddingBottom: 14, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 28, lineHeight: 34, color: colors.ink },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.6 },
  body: { paddingHorizontal: 20, gap: 10 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  emptyCard: { borderRadius: radius['2xl'], padding: 16, gap: 8 },
  skelMap: { flex: 1, overflow: 'hidden' },
  skelLine: { position: 'absolute', left: -60, width: 600, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.75)' },
  skelRow: { height: 64, borderRadius: radius['2xl'], backgroundColor: 'rgba(255,255,255,0.6)' },
  offline: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
});
