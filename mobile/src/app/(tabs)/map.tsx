/**
 * Map: garbage and recycling days for any spot on the island, and where to take what the bins can't.
 * A 3D MapLibre map in a WebView is the hero; search, material chips and a draggable sheet float over it.
 * Data: src/data/map.ts (all open data).
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
import { BATTERY_LOCATOR, geocode, loadMapData, zoneKey, zonesAt, type MapData, type Material } from '../../data/map';
import { BottomSheet } from '../../map/BottomSheet';
import { AreaDetails, Chip, zonePickups, DropoffDetails, DropoffRow, Legend, type Area } from '../../map/Details';
import { mapHtml, PLACE_STYLE } from '../../map/mapHtml';
import { localKey } from '../../map/schedule';
import { colors, glass, radius, shadow } from '../../theme';

type Selection = { kind: 'dropoff'; id: string } | { kind: 'area'; lat: number; lng: number; label: string; area: Area } | null;
type Notice = { icon: string; text: string; action?: { label: string; run: () => void } } | null;

/** Filters by what you are carrying; icons and tints reuse the place colours. */
const MATERIALS: { key: Material; label: string; icon: string; tint: string }[] = [
  { key: 'batteries', label: 'Batteries', icon: 'battery-full', tint: PLACE_STYLE.battery.color },
  { key: 'hazardous', label: 'Hazardous', icon: 'warning', tint: PLACE_STYLE.ecocentre.color },
  { key: 'electronics', label: 'Electronics', icon: 'devices', tint: PLACE_STYLE.ecocentre.color },
  { key: 'medicines', label: 'Medicines', icon: 'medication', tint: PLACE_STYLE.pharmacy.color },
];
const LIST_CAP = 25;
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  return Math.hypot(x, (b.lat - a.lat) * r) * 6_371_000;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // WebView's typings default P to undefined, which collapses every prop to never; `object` restores them.
  const web = useRef<WebView<object>>(null);

  const [data, setData] = useState<MapData | null>(null);
  const [dataError, setDataError] = useState(false);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [webKey, setWebKey] = useState(0);
  const [when, setWhen] = useState<'today' | 'week'>('week');
  const [selected, setSelected] = useState<Selection>(null);
  const [sheet, setSheet] = useState(0);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [filter, setFilter] = useState<Material | 'all'>('all');
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

  // The map draws garbage and recycling sectors only; the other streams show in a spot's details.
  const mapZones = useMemo(() => (data?.zones ?? []).filter((z) => z.stream === 'garbage' || z.stream === 'recycling'), [data]);
  // Which sectors collect today, and which are selected; drawn on the map as feature state.
  const todayKeys = useMemo(
    () => new Set(mapZones.filter((z) => zonePickups(z, today, 1).length).map(zoneKey)),
    [mapZones, today],
  );
  const zoneStates = useMemo(() => {
    const out: Record<string, { hot?: boolean; dim?: boolean; sel?: boolean }> = {};
    if (!data) return out;
    if (when === 'today') for (const z of mapZones) out[zoneKey(z)] = todayKeys.has(zoneKey(z)) ? { hot: true } : { dim: true };
    if (selected?.kind === 'area') {
      // Everything else recedes so the selected block stands out.
      for (const z of mapZones) out[zoneKey(z)] = { dim: true };
      for (const z of [selected.area.garbage, selected.area.recycling]) if (z) out[zoneKey(z)] = { sel: true };
    }
    return out;
  }, [data, mapZones, when, todayKeys, selected]);

  const pins = useMemo(
    () =>
      (data?.dropoffs ?? []).filter((d) => filter === 'all' || d.takes.includes(filter)).map((d) => ({
          id: d.id, lat: d.lat, lng: d.lng, name: d.name,
          icon: PLACE_STYLE[d.kind].icon.replace(/-/g, '_'),
          color: PLACE_STYLE[d.kind].color,
          a11y: `${d.name}, ${d.area}`,
        })),
    [data, filter],
  );

  // The sectors go to the page once per load (they are large); pins and highlight state on every change.
  const pushed = useRef(false);
  useEffect(() => {
    if (mapState === 'loading' || !data || pushed.current) return;
    send({ type: 'motion', reduce: reduceMotion });
    send({ type: 'pad', top: TOP, bottom: snaps[sheet] });
    send({ type: 'zones', zones: mapZones.map((z) => ({ key: zoneKey(z), stream: z.stream, polygons: z.polygons })) });
    pushed.current = true;
  }, [mapState, data, reduceMotion, send]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mapState !== 'loading') send({ type: 'pins', pins }); }, [mapState, pins, send]);
  useEffect(() => { if (mapState !== 'loading') send({ type: 'zoneState', states: zoneStates }); }, [mapState, zoneStates, send]);

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
        // Half height always: at full the sheet would hide what was just selected.
        const idx = 1;
        setSheet(idx);
        send({ type: 'pad', top: TOP, bottom: snaps[idx] });
      }
      send(s?.kind === 'area' ? { type: 'select', kind: 'area', id: 'area', lat: s.lat, lng: s.lng } : { type: 'select', ...(s ?? { id: null }) });
    },
    [sheet, snaps, TOP, send],
  );

  /** Look up the city sectors at a spot; outside them, say why rather than showing an empty card. */
  const pickSpot = (p: { lat: number; lng: number }, label: string) => {
    if (!data) return;
    const area = zonesAt(data.zones, p);
    if (!area.garbage && !area.recycling) {
      setNotice({ icon: 'info-outline', text: "No Ville de Montréal schedule here. Westmount, Mount Royal and the island's other cities run their own collection." });
      return;
    }
    setNotice(null);
    select({ kind: 'area', ...p, label, area });
  };

  const onMessage = (e: WebViewMessageEvent) => {
    const m = JSON.parse(e.nativeEvent.data);
    if (m.type === 'ready') setMapState('ready');
    if (m.type === 'tiles' && !m.ok) setNotice({ icon: 'cloud-off', text: "Map tiles didn't load. The list below still works.", action: { label: 'Retry', run: retryMap } });
    if (m.type === 'tiles' && m.ok) setNotice((n) => (n?.icon === 'cloud-off' ? null : n));
    if (m.type === 'tap') m.kind === 'dropoff' ? select({ kind: 'dropoff', id: m.id }) : pickSpot({ lat: m.lat, lng: m.lng }, 'Spot you picked');
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
      send({ type: 'me', ...p });
      pickSpot(p, 'Your location');
    } catch {
      setNotice({ icon: 'location-searching', text: "Couldn't find your location. Try again outside, or search an address." });
    } finally {
      setLocating(false);
    }
  };

  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q || !data) return [];
    const drops = data.dropoffs
      .filter((d) => fold(`${d.name} ${d.address}`).includes(q))
      .map((d) => ({ kind: 'dropoff' as const, id: d.id, title: d.name, sub: d.address, icon: PLACE_STYLE[d.kind].icon }));
    return drops.slice(0, 4);
  }, [query, data]);

  const submitSearch = async () => {
    if (matches[0]) return select({ kind: matches[0].kind, id: matches[0].id });
    if (!query.trim() || !data) return;
    setSearching(true);
    try {
      const hit = await geocode(query.trim());
      if (hit === 'off-island') return setNotice({ icon: 'search-off', text: 'This trial covers the Island of Montréal only. Try a street or address on the island.' });
      if (!hit) return setNotice({ icon: 'search-off', text: `No street or address called "${query.trim()}" on the island. Try a street and number.` });
      Keyboard.dismiss();
      setFocused(false);
      send({ type: 'place', ...hit });
      pickSpot(hit, hit.label);
    } catch {
      setNotice({ icon: 'cloud-off', text: "Search couldn't reach the map service. Check your connection and try again.", action: { label: 'Retry', run: submitSearch } });
    } finally {
      setSearching(false);
    }
  };

  const area = selected?.kind === 'area' ? selected : undefined;
  const drop = selected?.kind === 'dropoff' ? data?.dropoffs.find((d) => d.id === selected.id) : undefined;
  const visibleDrops = useMemo(() => {
    const list = (data?.dropoffs ?? []).filter((d) => filter === 'all' || d.takes.includes(filter));
    return me ? [...list].sort((a, b) => metres(me, a) - metres(me, b)) : list;
  }, [data, filter, me]);

  const todayCount = (stream: 'garbage' | 'recycling') => [...todayKeys].filter((k) => k.startsWith(stream)).length;
  const summary = !data
    ? ' '
    : when === 'today'
      ? todayKeys.size
        ? `Today: garbage in ${todayCount('garbage')} sectors, recycling in ${todayCount('recycling')}.`
        : 'No collections anywhere in the city today.'
      : 'Tap any spot on the island, or search an address, to see its days.';

  const header = (
    <View style={styles.sheetHeader} onLayout={(e) => !selected && setHeaderH(Math.round(e.nativeEvent.layout.height))}>
      {area || drop ? (
        <View style={styles.titleRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>
              {area ? 'Collection days · Ville de Montréal' : `${PLACE_STYLE[drop!.kind].label} · ${drop!.area}`}
            </T>
            <T display style={styles.title} numberOfLines={2} accessibilityRole="header">{area ? area.label : drop!.name}</T>
          </View>
          <CircleButton icon="close" label="Close details" onPress={() => select(null)} />
        </View>
      ) : (
        <>
          <View style={styles.titleRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>Island of Montréal</T>
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
        accessibilityLabel="Map of collection sectors and drop-offs"
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
            {MATERIALS.map((m) => (
              <Chip key={m.key} label={m.label} icon={m.icon} tint={m.tint} active={filter === m.key} onPress={() => setFilter(filter === m.key ? 'all' : m.key)} />
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
              <T size="sm" color={colors.inkMuted}>Collection days and drop-offs didn't load.</T>
              <SecondaryButton label="Try again" icon="refresh" onPress={load} />
            </View>
          ) : !data ? (
            <SkeletonRows />
          ) : area ? (
            <AreaDetails area={area.area} today={today} fetchedOn={data.fetchedOn} sourceUrl={data.sourceUrl} />
          ) : drop ? (
            <DropoffDetails d={drop} />
          ) : (
            <>
              <Glass style={styles.emptyCard}>
                <View style={styles.titleRow}>
                  <Icon name="touch-app" size={20} color={colors.forest} />
                  <T size="sm" weight="semibold" style={{ flex: 1 }}>Find your collection days</T>
                </View>
                <T size="sm" color={colors.inkMuted}>
                  Tap your block on the map, search your address, or use your location. Days come from the City of Montréal's own sector data.
                </T>
              </Glass>
              <T size="xs" weight="semibold" color={colors.inkMuted} style={[styles.eyebrow, { marginTop: 12 }]}>
                {filter === 'all' ? 'Drop-off places' : `Takes ${MATERIALS.find((m) => m.key === filter)!.label.toLowerCase()}`} · {visibleDrops.length}{me ? ' · nearest first' : ''}
              </T>
              {filter === 'batteries' && (
                <Glass style={styles.emptyCard}>
                  <T size="sm" color={colors.inkMuted}>Many shops host battery bins that aren't mapped here yet.</T>
                  <Spring onPress={() => Linking.openURL(BATTERY_LOCATOR)} accessibilityRole="link" hitSlop={8}>
                    <T size="sm" weight="bold" color={colors.forest}>Open the official battery locator</T>
                  </Spring>
                </Glass>
              )}
              {visibleDrops.slice(0, LIST_CAP).map((d) => <DropoffRow key={d.id} d={d} distance={me ? metres(me, d) : undefined} onPress={() => select({ kind: 'dropoff', id: d.id })} />)}
              {visibleDrops.length > LIST_CAP && (
                <T size="xs" color={colors.inkMuted}>
                  Showing {LIST_CAP} of {visibleDrops.length}.{me ? '' : ' Use your location to see the nearest first.'}
                </T>
              )}
              <T size="xs" color={colors.inkMuted} style={{ marginTop: 8 }}>
                Collection days: Ville de Montréal open data, {data.fetchedOn}. Écocentres: RECYC-QUÉBEC. Pharmacies and battery points: OpenStreetMap contributors.
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
          <T size="sm" color={colors.inkMuted} style={{ textAlign: 'center' }}>You might be offline. Drop-off places are still listed below.</T>
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
