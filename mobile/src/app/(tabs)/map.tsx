/**
 * Map: garbage and recycling days for any spot on the island, and where to take what the bins can't.
 * A 3D MapLibre map in a WebView is the hero; search, material chips and a draggable sheet float over it.
 * Data: src/data/map.ts (all open data).
 */
import * as Location from 'expo-location';
import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { CircleButton, Glass, Icon, IconBubble, PrimaryButton, SecondaryButton, Spring, T } from '../../components/ui';
import { BATTERY_LOCATOR, loadMapData, zoneKey, zonesAt, type MapData, type Material } from '../../data/map';
import { suggest, type Suggestion } from '../../map/addressSearch';
import { boundsOf } from '../../map/bounds';
import { BottomSheet } from '../../map/BottomSheet';
import { AreaDetails, DropoffDetails, DropoffRow, Legend, type Area } from '../../map/Details';
import { mapHtml, PLACE_STYLE } from '../../map/mapHtml';
import { localKey } from '../../map/schedule';
import { useT, type TKey } from '../../i18n';
import { useApp } from '../../state/AppState';
import { colors, radius, shadow } from '../../theme';

type Selection = { kind: 'dropoff'; id: string } | { kind: 'area'; lat: number; lng: number; label: string; area: Area } | null;
type Notice = { icon: string; text: string; action?: { label: string; run: () => void } } | null;

/** Filters by what you are carrying; icons and tints reuse the place colours. */
const MATERIALS: { key: Material; label: TKey; icon: string; tint: string }[] = [
  { key: 'batteries', label: 'Batteries', icon: 'battery-full', tint: PLACE_STYLE.battery.color },
  { key: 'medicines', label: 'Medicine', icon: 'medication', tint: PLACE_STYLE.pharmacy.color },
  { key: 'electronics', label: 'Electronics', icon: 'devices', tint: PLACE_STYLE.ecocentre.color },
  { key: 'hazardous', label: 'Paint & chemicals', icon: 'format-paint', tint: PLACE_STYLE.ecocentre.color },
];
/** What each kind of place is for, in plain words (shown in the list intro and on a selected place). */
const PURPOSE: Record<keyof typeof PLACE_STYLE, TKey> = {
  ecocentre: 'Big items, paint, electronics and hazardous waste',
  pharmacy: 'Old or unused medicine',
  battery: 'Used batteries',
};
/** Nearest places listed for the chosen material. */
const NEAREST = 5;
const MIN_CHARS = 3;
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
  const sheetScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // The map page is built in the chosen neighbourhood's colours; it's rebuilt only when the theme changes.
  const { playTheme } = useApp();
  const { t, lang } = useT();
  const html = useMemo(() => mapHtml(playTheme), [playTheme]);

  const [data, setData] = useState<MapData | null>(null);
  const [dataError, setDataError] = useState(false);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [webKey, setWebKey] = useState(0);
  const [selected, setSelected] = useState<Selection>(null);
  const [sheet, setSheet] = useState(0);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Suggestion[]>([]);
  const [offIsland, setOffIsland] = useState(false);
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'error'>('idle');
  const [retry, setRetry] = useState(0);
  const searching = lookup === 'loading';
  const [focused, setFocused] = useState(false);
  const searchInput = useRef<ComponentRef<typeof TextInput>>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  // Show all places; material icons narrow the map and the list.
  const [filter, setFilter] = useState<Material | null>(null);
  const [tilt, setTilt] = useState(true);
  const [address, setAddress] = useState<Extract<Selection, { kind: 'area' }> | null>(null);
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
    loadMapData(lang).then(setData, () => setDataError(true));
  }, [lang]);
  useEffect(() => {
    let active = true;
    loadMapData(lang).then((value) => {
      if (active) { setData(value); setDataError(false); }
    }, () => { if (active) setDataError(true); });
    return () => { active = false; };
  }, [lang]);

  const send = useCallback((m: object) => web.current?.injectJavaScript(`window.receive && window.receive(${JSON.stringify(m)});true;`), []);

  // Sheet heights: peek clears the floating tab bar; full stops below the search bar.
  const TOP = insets.top + 112;
  const [headerH, setHeaderH] = useState(150);
  const snaps = useMemo(() => {
    const full = height - insets.top - 64;
    const peek = Math.min(TAB_BAR_SPACE + 28 + headerH, full - 80);
    return [peek, Math.max(peek + 40, Math.min(Math.round(height * 0.52), full - 40)), full];
  }, [height, insets.top, headerH]);

  // Reopening the sheet should always reveal its first card, not a stale scroll position.
  useEffect(() => {
    if (sheet === 0) sheetScroll.current?.scrollTo({ y: 0, animated: false });
  }, [sheet]);

  // The map draws garbage and recycling sectors only; the other streams show in a spot's details.
  const mapZones = useMemo(() => (data?.zones ?? []).filter((z) => z.stream === 'garbage' || z.stream === 'recycling'), [data]);
  // Which sectors are selected; drawn on the map as feature state.
  const zoneStates = useMemo(() => {
    const out: Record<string, { hot?: boolean; dim?: boolean; sel?: boolean }> = {};
    if (!data) return out;
    if (selected?.kind === 'area') {
      // Everything else recedes so the selected block stands out.
      for (const z of mapZones) out[zoneKey(z)] = { dim: true };
      for (const z of [selected.area.garbage, selected.area.recycling]) if (z) out[zoneKey(z)] = { sel: true };
    }
    return out;
  }, [data, mapZones, selected]);

  const pins = useMemo(
    () =>
      (data?.dropoffs ?? []).filter((d) => !filter || d.takes.includes(filter)).map((d) => ({
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
  useEffect(() => {
    if (mapState === 'ready') send({ type: 'language', lang, spot: t('Spot you picked'), location: t('Your location'), cluster: t('drop-offs, zoom in') });
  }, [mapState, lang, t, send]);
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
      sheetScroll.current?.scrollTo({ y: 0, animated: false });
      if (s?.kind === 'area') setAddress(s);
      if (s) {
        // Half height always: at full the sheet would hide what was just selected.
        const idx = 1;
        setSheet(idx);
        send({ type: 'pad', top: TOP, bottom: snaps[idx] });
      }
      send(
        s?.kind === 'area'
          // Fit the whole highlighted area, not just the tapped point.
          ? { type: 'select', kind: 'area', id: 'area', lat: s.lat, lng: s.lng, bounds: boundsOf([s.area.garbage, s.area.recycling].flatMap((z) => (z ? [z] : []))) }
          : { type: 'select', ...(s ?? { id: null }) },
      );
    },
    [snaps, TOP, send],
  );

  /** Look up the city sectors at a spot; outside them, say why rather than showing an empty card. */
  const pickSpot = (p: { lat: number; lng: number }, label: string) => {
    Keyboard.dismiss();
    setFocused(false);
    if (!data) return;
    const area = zonesAt(data.zones, p);
    if (!area.garbage && !area.recycling) {
      setNotice({ icon: 'info-outline', text: t("No Ville de Montréal schedule here. Westmount, Mount Royal and the island's other cities run their own collection.") });
      return;
    }
    setNotice(null);
    select({ kind: 'area', lat: p.lat, lng: p.lng, label, area });
  };

  const onMessage = (e: WebViewMessageEvent) => {
    const m = JSON.parse(e.nativeEvent.data);
    if (m.type === 'ready') setMapState('ready');
    if (m.type === 'tiles' && !m.ok) setNotice({ icon: 'cloud-off', text: t("Map tiles didn't load. The list below still works."), action: { label: t('Retry'), run: retryMap } });
    if (m.type === 'tiles' && m.ok) setNotice((n) => (n?.icon === 'cloud-off' ? null : n));
    if (m.type === 'tap') {
      if (m.kind === 'dropoff') select({ kind: 'dropoff', id: m.id });
      else pickSpot({ lat: m.lat, lng: m.lng }, 'Spot you picked');
    }
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
          text: t('Location is off for TriMTL. Search an address instead, or turn it on in Settings.'),
          action: perm.canAskAgain ? undefined : { label: t('Settings'), run: () => Linking.openSettings() },
        });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMe(p);
      send({ type: 'me', ...p });
      pickSpot(p, 'Your location');
    } catch {
      setNotice({ icon: 'location-searching', text: t("Couldn't find your location. Try again outside, or search an address.") });
    } finally {
      setLocating(false);
    }
  };

  // Type-ahead: wait for a pause in typing, drop answers to questions that are no longer being asked.
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLookup('loading');
      suggest(q, ctrl.signal).then(
        (r) => { setPlaces(r.places); setOffIsland(r.offIsland); setLookup('idle'); },
        (e) => { if (e?.name !== 'AbortError') setLookup('error'); },
      );
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, retry]);

  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q || !data) return [];
    const drops = data.dropoffs
      .filter((d) => fold(`${d.name} ${d.address}`).includes(q))
      .map((d) => ({ kind: 'dropoff' as const, id: d.id, title: d.name, sub: d.address, icon: PLACE_STYLE[d.kind].icon }));
    return drops.slice(0, 2);
  }, [query, data]);

  const typed = query.trim().length >= MIN_CHARS;
  const shown = typed ? places.slice(0, 6) : [];

  /** Fly to a suggestion and show the days for that address. */
  const pickPlace = (p: Suggestion) => {
    Keyboard.dismiss();
    setFocused(false);
    setQuery(p.title);
    send({ type: 'place', lat: p.lat, lng: p.lng });
    pickSpot(p, p.title);
  };

  // Enter takes the first row on screen; if the suggestions have not arrived yet, ask straight away.
  const submitSearch = async () => {
    if (matches[0]) return select({ kind: matches[0].kind, id: matches[0].id });
    if (shown[0]) return pickPlace(shown[0]);
    if (!typed) return;
    setLookup('loading');
    try {
      const r = await suggest(query.trim());
      setLookup('idle');
      if (r.places[0]) return pickPlace(r.places[0]);
      setNotice({ icon: 'search-off', text: r.offIsland ? t('This trial covers the Island of Montréal only. Try a street or address on the island.') : t('No street or address called "{q}" on the island. Try a street and number.', { q: query.trim() }) });
    } catch {
      setLookup('error');
    }
  };

  const area = selected?.kind === 'area' ? selected : undefined;
  const drop = selected?.kind === 'dropoff' ? data?.dropoffs.find((d) => d.id === selected.id) : undefined;
  // Distances are measured from the address the user picked, or their location.
  const origin = address ?? me;
  const visibleDrops = useMemo(() => {
    const list = (data?.dropoffs ?? []).filter((d) => !filter || d.takes.includes(filter));
    return origin ? [...list].sort((a, b) => metres(origin, a) - metres(origin, b)) : list;
  }, [data, filter, origin?.lat, origin?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = (
    <View style={styles.sheetHeader} onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}>
      {area || drop ? (
        <View style={styles.titleRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>
              {area ? t('Collection days · Ville de Montréal') : `${t(PLACE_STYLE[drop!.kind].label)} · ${drop!.area}`}
            </T>
            <T display style={styles.title} numberOfLines={2} accessibilityRole="header">{area ? (area.label === 'Your location' || area.label === 'Spot you picked' ? t(area.label) : area.label) : drop!.name}</T>
            {drop && <T size="sm" color={colors.inkMuted}>{t('For: {what}', { what: t(PURPOSE[drop.kind]).toLowerCase() })}</T>}
          </View>
          <CircleButton icon="close" label={t("Close details")} onPress={() => select(null)} />
        </View>
      ) : (
        <>
          {/* First thing a user sees: what the map is for, and the one step to take. */}
          <View style={{ gap: 4 }}>
            <T display style={styles.title} accessibilityRole="header">{t('Garbage schedule & where to sort')}</T>
            <T size="sm" color={colors.inkMuted}>{t('Find your pickup days: use your location, search an address, or tap the map.')}</T>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PrimaryButton label={locating ? t('Finding…') : t('My location')} icon="near-me" size="md" onPress={locate} disabled={locating} style={{ flex: 1, width: 'auto', paddingHorizontal: 12 }} />
            <SecondaryButton label={t('Address')} icon="search" onPress={() => searchInput.current?.focus()} style={{ flex: 1, width: 'auto' }} />
          </View>
          {/* What the map shows, in one small line. */}
          <View style={styles.keyLine} accessible accessibilityLabel={t('On the map: grey line, garbage pickup area. Dashed blue line, recycling pickup area. Dots, drop-off places.')}>
            <Legend />
            <View style={styles.keyItem}>
              <View style={[styles.keyDot, { backgroundColor: PLACE_STYLE.ecocentre.color }]} />
              <T size="xs" weight="medium" color={colors.inkMuted}>{t('Drop-off place')}</T>
            </View>
          </View>
          {sheet === 0 && (
            <Spring onPress={() => setSheet(1)} accessibilityRole="button" style={styles.moreHint}>
              <Icon name="keyboard-arrow-up" size={18} color={colors.forest} />
              <T size="xs" weight="semibold" color={colors.forest}>{t('Swipe up: nearest drop-off places')}</T>
            </Spring>
          )}
        </>
      )}
    </View>
  );

  const chosen = MATERIALS.find((m) => m.key === filter);
  const finder = (
    <View style={{ gap: 8, marginTop: 4 }}>
      <T size="base" weight="bold">{chosen ? t('Places that take {what}', { what: t(chosen.label).toLowerCase() }) : t('Drop-off places')}</T>
      <T size="sm" color={colors.inkMuted}>{t("For what your bins can't take. Use the icons under the search bar to filter.")}</T>
      {visibleDrops.slice(0, NEAREST).map((d) => (
        <DropoffRow key={d.id} d={d} distance={origin ? metres(origin, d) : undefined} onPress={() => select({ kind: 'dropoff', id: d.id })} />
      ))}
      {!visibleDrops.length && <T size="sm" color={colors.inkMuted}>{t('No mapped places take this item. Try another filter.')}</T>}
      {!origin && <T size="xs" color={colors.inkMuted}>{t('Use your location to see the nearest first.')}</T>}
      {filter === 'batteries' && (
        <Spring onPress={() => Linking.openURL(BATTERY_LOCATOR)} accessibilityRole="link" hitSlop={8}>
          <T size="sm" weight="bold" color={colors.forest}>{t('More battery bins in shops: official locator')}</T>
        </Spring>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.mintCanvas }}>
      <WebView<object>
        key={webKey}
        ref={web}
        source={{ html, baseUrl: 'https://trimtl.local/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        onLoadStart={() => { pushed.current = false; setMapState('loading'); }}
        onError={() => setMapState('offline')}
        style={StyleSheet.absoluteFill}
        containerStyle={{ backgroundColor: colors.mintCanvas }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        accessibilityLabel={t("Map of collection sectors and drop-offs")}
      />

      {/* Until both the map and its data are ready (or the map fails), a clear loading screen covers it. */}
      {(mapState !== 'ready' || (!data && !dataError)) && (
        <MapCover state={mapState === 'offline' ? 'offline' : 'loading'} onRetry={retryMap} top={TOP} bottom={snaps[0]} />
      )}

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View style={styles.searchRow}>
          <View style={[shadow.lg, styles.search, styles.solid]}>
            <Icon name="search" size={20} color={colors.inkMuted} />
            <TextInput
              ref={searchInput}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={submitSearch}
              autoCorrect={false}
              autoCapitalize="words"
              placeholder={t("Search a street or address")}
              placeholderTextColor={colors.inkMuted}
              returnKeyType="search"
              accessibilityLabel={t("Search a street or address")}
              style={styles.input}
            />
            {searching ? (
              <ActivityIndicator color={colors.inkMuted} />
            ) : query ? (
              <Spring onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t("Clear search")} hitSlop={10} style={styles.clear}>
                <Icon name="close" size={16} color={colors.inkMuted} />
              </Spring>
            ) : null}
          </View>
          <Spring onPress={locate} pressedScale={0.95} accessibilityRole="button" accessibilityLabel={t("Use my location")} style={[shadow.lg, styles.locate, styles.solid]}>
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
            {shown.map((p) => (
              <Spring key={p.id + p.title} onPress={() => pickPlace(p)} pressedScale={0.98} accessibilityRole="button" accessibilityLabel={`${p.title}, ${p.subtitle}`} style={styles.result}>
                <Icon name={p.kind === 'street' ? 'signpost' : 'place'} size={18} color={colors.inkMuted} />
                <View style={{ flex: 1 }}>
                  <T size="sm" weight="semibold" numberOfLines={1}>{p.title}</T>
                  <T size="xs" color={colors.inkMuted} numberOfLines={1}>{p.subtitle}</T>
                </View>
              </Spring>
            ))}
            {!typed && !matches.length && (
              <View style={styles.result}>
                <Icon name="edit-location-alt" size={18} color={colors.inkMuted} />
                <T size="sm" color={colors.inkMuted} style={{ flex: 1 }}>{t("Keep typing an address, like 4200 Rue Saint-Denis")}</T>
              </View>
            )}
            {typed && lookup === 'loading' && !shown.length && [0, 1].map((i) => (
              <View key={i} style={styles.result} accessibilityLabel={t("Searching addresses")}>
                <View style={styles.skelDot} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={[styles.skelBar, { width: `${70 - i * 18}%` }]} />
                  <View style={[styles.skelBar, { width: '40%', height: 8 }]} />
                </View>
              </View>
            ))}
            {typed && lookup === 'error' && (
              <Spring onPress={() => { setLookup('idle'); setRetry((n) => n + 1); }} accessibilityRole="button" style={styles.result}>
                <Icon name="cloud-off" size={18} color={colors.inkMuted} />
                <T size="sm" color={colors.inkMuted} style={{ flex: 1 }}>{t("Address search isn't reachable.")}</T>
                <T size="sm" weight="bold" color={colors.forest}>{t("Try again")}</T>
              </Spring>
            )}
            {typed && lookup === 'idle' && !shown.length && !matches.length && (
              <View style={styles.result}>
                <Icon name="search-off" size={18} color={colors.inkMuted} />
                <T size="sm" color={colors.inkMuted} style={{ flex: 1 }}>
                  {offIsland ? t('This trial covers the Island of Montréal only.') : t('No street or address like that on the island.')}
                </T>
              </View>
            )}
          </Glass>
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
            <Spring onPress={() => setNotice(null)} accessibilityRole="button" accessibilityLabel={t("Dismiss")} hitSlop={10} style={styles.clear}>
              <Icon name="close" size={16} color={colors.inkMuted} />
            </Spring>
          </Glass>
        )}
        {!focused && (
          <View pointerEvents="box-none" style={styles.controls}>
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              {chosen && (
                <Spring onPress={() => setFilter(null)} accessibilityRole="button" accessibilityLabel={t('Clear filter')} style={[styles.activePill, styles.solid, shadow.md]}>
                  <Icon name={chosen.icon} size={16} color={chosen.tint} />
                  <T size="xs" weight="semibold">{t(chosen.label)}</T>
                  <Icon name="close" size={14} color={colors.inkMuted} />
                </Spring>
              )}
            </View>
            <View style={{ gap: 8 }}>
              <Spring onPress={() => { setTilt(!tilt); send({ type: 'tilt', on: !tilt }); }} accessibilityRole="button" accessibilityLabel={t('3D buildings and terrain')} accessibilityState={{ selected: tilt }} style={[styles.filterIcon, styles.solid, shadow.md]}>
                <T size="xs" weight="bold">{tilt ? '3D' : '2D'}</T>
              </Spring>
              {MATERIALS.map((m) => (
                <Spring key={m.key} onPress={() => { setFilter(filter === m.key ? null : m.key); select(null); setSheet(1); }} accessibilityRole="button" accessibilityLabel={t('Show places that take {what}', { what: t(m.label).toLowerCase() })} accessibilityState={{ selected: filter === m.key }} style={[styles.filterIcon, shadow.md, filter === m.key ? { backgroundColor: m.tint } : styles.solid]}>
                  <Icon name={m.icon} size={20} color={filter === m.key ? colors.white : m.tint} />
                </Spring>
              ))}
            </View>
          </View>
        )}
      </View>

      <BottomSheet snaps={snaps} index={sheet} onIndexChange={setSheet} reduceMotion={reduceMotion} header={header}>
        <ScrollView ref={sheetScroll} contentContainerStyle={[styles.body, { paddingBottom: TAB_BAR_SPACE + 24 }]} showsVerticalScrollIndicator={false}>
          {dataError ? (
            <View style={styles.empty}>
              <T size="sm" color={colors.inkMuted}>{t("Collection days and drop-offs didn't load.")}</T>
              <SecondaryButton label={t("Try again")} icon="refresh" onPress={load} />
            </View>
          ) : !data ? (
            <SkeletonRows />
          ) : area ? (
            <AreaDetails area={area.area} today={today} fetchedOn={data.fetchedOn} sourceUrl={data.sourceUrl} />
          ) : drop ? (
            <DropoffDetails d={drop} />
          ) : (
            <>
              {finder}
              <T size="xs" color={colors.inkMuted} style={{ marginTop: 8 }}>
                {t('Collection days: Ville de Montréal open data, {date}. Écocentres: RECYC-QUÉBEC. Pharmacies and battery points: OpenStreetMap contributors.', { date: data.fetchedOn })}
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
  const { t } = useT();
  const [pulse] = useState(() => new Animated.Value(0.5));
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
        <View style={{ flex: 1 }}>
          <Animated.View style={[styles.skelMap, { opacity: pulse }]}>
            {[0, 1, 2, 3].map((i) => <View key={i} style={[styles.skelLine, { top: 40 + i * 70, transform: [{ rotate: '-34deg' }] }]} />)}
            {[0, 1].map((i) => <View key={`v${i}`} style={[styles.skelLine, { top: 120, left: 40 + i * 120, width: 260, transform: [{ rotate: '56deg' }] }]} />)}
          </Animated.View>
          <View style={styles.loadingWrap} accessibilityLabel="Loading the map of Montréal" accessibilityLiveRegion="polite">
            <Glass style={[styles.loadingCard, shadow.lg]}>
              <IconBubble icon="map" size={56} iconSize={28} />
              <T size="base" weight="bold">{t("Loading the map of Montréal…")}</T>
              <T size="xs" color={colors.inkMuted} style={{ textAlign: 'center' }}>{t("Collection days and drop-off places")}</T>
              <ActivityIndicator color={colors.forest} style={{ marginTop: 4 }} />
            </Glass>
          </View>
        </View>
      ) : (
        <View style={styles.offline}>
          <IconBubble icon="cloud-off" color={colors.inkMuted} />
          <T display style={styles.title}>{t("The map didn't load")}</T>
          <T size="sm" color={colors.inkMuted} style={{ textAlign: 'center' }}>{t("You might be offline. Drop-off places are still listed below.")}</T>
          <PrimaryButton label={t("Try again")} icon="refresh" size="md" onPress={onRetry} style={{ width: 200 }} />
        </View>
      )}
    </View>
  );
}

function SkeletonRows() {
  const { t } = useT();
  return (
    <View style={{ gap: 10 }} accessibilityLabel={t("Loading")}>
      {[0, 1, 2].map((i) => <View key={i} style={styles.skelRow} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0, top: 0, gap: 10 },
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  search: { flex: 1, height: 48, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  input: { flex: 1, height: 48, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, color: colors.ink },
  skelDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(18,41,31,0.1)' },
  skelBar: { height: 12, borderRadius: 6, backgroundColor: 'rgba(18,41,31,0.1)' },
  clear: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  locate: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16 },
  filterIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: radius.full },
  keyLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.white },
  moreHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 32 },
  results: { marginHorizontal: 16, borderRadius: radius['2xl'], paddingVertical: 6, backgroundColor: 'rgba(255, 255, 255, 0.96)' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  // Solid white over the map, so search and buttons stay readable (glass was too see-through here).
  solid: { backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: colors.white },
  notice: { marginHorizontal: 16, borderRadius: radius['2xl'], paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeAction: { paddingHorizontal: 6, minHeight: 28, justifyContent: 'center' },
  sheetHeader: { paddingHorizontal: 20, paddingBottom: 14, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 28, lineHeight: 34, color: colors.ink },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.6 },
  body: { paddingHorizontal: 20, gap: 10 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  emptyCard: { borderRadius: radius['2xl'], padding: 16, gap: 8 },
  skelMap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loadingCard: { alignItems: 'center', gap: 8, paddingVertical: 24, paddingHorizontal: 28, borderRadius: radius['3xl'], backgroundColor: 'rgba(255,255,255,0.92)' },
  skelLine: { position: 'absolute', left: -60, width: 600, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.75)' },
  skelRow: { height: 64, borderRadius: radius['2xl'], backgroundColor: 'rgba(255,255,255,0.6)' },
  offline: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
});
