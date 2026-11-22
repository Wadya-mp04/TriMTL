/**
 * Sheet content for the Map tab: legend, list rows, and the lane and drop-off detail views.
 */
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { Glass, Icon, PrimaryButton, Spring, T } from '../components/ui';
import { useT, type TKey } from '../i18n';
import type { Dropoff, Zone } from '../data/map';
import { bins, colors, radius, shadow } from '../theme';
import { appLabel, chooseAndGo, goTo, useMapsApp } from './directions';
import { LANE_STYLE, PLACE_STYLE } from './mapHtml';
import { addDays, countdown, humanDay, monthlyDates, upcoming, weekly, type Pickup, type Stream } from './schedule';

const WEEKDAYS = { en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] };

/** A short stroke drawn the way the map draws it. */
function Stroke({ streams, width = 22 }: { streams: (keyof typeof LANE_STYLE)[]; width?: number }) {
  const both = streams.length === 2;
  const base = LANE_STYLE[streams[0]];
  return (
    <Svg width={width} height={8} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Line x1={1} y1={4} x2={width - 1} y2={4} stroke={base.color} strokeWidth={4} strokeLinecap={base.dash ? 'butt' : 'round'} strokeDasharray={base.dash ? '5 4' : undefined} />
      {both && <Line x1={1} y1={4} x2={width - 1} y2={4} stroke={LANE_STYLE.recycling.color} strokeWidth={4} strokeDasharray="5 4" />}
    </Svg>
  );
}

export function Legend() {
  const { t } = useT();
  const items: { streams: (keyof typeof LANE_STYLE)[]; label: string }[] = [
    { streams: ['garbage'], label: t('Garbage pickup area') },
    { streams: ['recycling'], label: t('Recycling pickup area') },
  ];
  return (
    <View accessible accessibilityLabel={t("Legend. Solid grey outline: garbage sector. Dashed blue outline: recycling sector.")} style={styles.legend}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <Stroke streams={i.streams} />
          <T size="xs" weight="medium" color={colors.inkMuted}>{i.label}</T>
        </View>
      ))}
    </View>
  );
}

function PlaceBubble({ kind, size = 40 }: { kind: Dropoff['kind']; size?: number }) {
  return (
    <View style={[styles.bubble, shadow.sm, { width: size, height: size, borderRadius: size / 2 }]}>
      <Icon name={PLACE_STYLE[kind].icon} size={size * 0.5} color={PLACE_STYLE[kind].color} />
    </View>
  );
}

/** Pill with the designs' chip press; active chips are ink, like the tab bar highlight. */
export function Chip({ label, icon, tint, active, onPress }: { label: string; icon?: string; tint?: string; active: boolean; onPress: () => void }) {
  const { t } = useT();
  return (
    <Spring
      onPress={onPress}
      pressedScale={0.95}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={t('Show places that take {what}', { what: label.toLowerCase() })}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[styles.chip, active ? { backgroundColor: colors.ink, borderColor: colors.ink } : styles.chipIdle, shadow.sm]}
    >
      {icon && <Icon name={icon} size={16} color={active ? colors.white : tint} />}
      <T size="xs" weight="semibold" color={active ? colors.white : colors.ink}>{label}</T>
    </Spring>
  );
}

export const distanceLabel = (m: number) => (m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

export function DropoffRow({ d, distance, onPress }: { d: Dropoff; distance?: number; onPress: () => void }) {
  const { t, lang } = useT();
  return (
    <Spring onPress={onPress} pressedScale={0.98} accessibilityRole="button" accessibilityLabel={distance !== undefined ? t('{name}, {area}, {distance} away', { name: d.name, area: d.area, distance: distanceLabel(distance) }) : `${d.name}, ${d.area}`}>
      <Glass style={styles.listRow}>
        <PlaceBubble kind={d.kind} />
        <View style={{ flex: 1, gap: 2 }}>
          <T size="sm" weight="semibold" numberOfLines={1}>{d.name}</T>
          <T size="xs" color={colors.inkMuted} numberOfLines={1}>{d.area}</T>
        </View>
        {distance !== undefined && <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.num}>{distanceLabel(distance)}</T>}
        <Spring
          onPress={() => goTo(d, lang)}
          pressedScale={0.92}
          accessibilityRole="button"
          accessibilityLabel={t('Directions to {name}', { name: d.name })}
          style={[styles.go, { backgroundColor: colors.ink }]}
        >
          <Icon name="directions" size={20} color={colors.white} />
        </Spring>
      </Glass>
    </Spring>
  );
}

export type Area = Partial<Record<Stream, Zone>>;
export const STREAMS: Stream[] = ['garbage', 'recycling', 'food', 'bulky', 'yard'];

/** Each stream's look, from the existing bin tokens: food and yard are the compost bin's, bulky the special one's. */
export const STREAM_STYLE: Record<Stream, { label: string; icon: string; fg: string; bg: string; deep: string }> = {
  garbage: bins.garbage,
  recycling: bins.recycling,
  food: { ...bins.compost, label: 'Food scraps', icon: 'compost' },
  yard: { ...bins.compost, label: 'Yard waste and leaves', icon: 'yard', fg: colors.forest, deep: colors.forest },
  bulky: { ...bins.special, label: 'Bulky items and renovation debris', icon: 'chair' },
};

/** Every pickup of one sector in [today, today + days): listed dates, nth weekdays, or weekly days. */
export function zonePickups(z: Zone, today: string, days: number): { date: string; note?: string }[] {
  const end = addDays(today, days);
  if (z.dates) return z.dates.filter((d) => d >= today && d < end).map((date) => ({ date }));
  if (z.biweekly || !z.days.length) return [];
  if (z.monthly) return z.days.flatMap((d) => monthlyDates(d, z.monthly!, today, days)).sort().map((date) => ({ date }));
  return upcoming(z.days.map((d) => ({ stream: z.stream, rule: weekly(d), exceptions: z.exceptions })), today, days);
}

/** All of a spot's pickups, merged by day. */
export function areaPickups(a: Area, today: string, days: number): Pickup[] {
  const byDate = new Map<string, Pickup>();
  for (const s of STREAMS) {
    const z = a[s];
    if (!z) continue;
    for (const o of zonePickups(z, today, days)) {
      const p = byDate.get(o.date) ?? { date: o.date, streams: [] };
      p.streams.push(s);
      byDate.set(o.date, p);
    }
  }
  return [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date));
}

const dayList = (days: number[], lang: 'en' | 'fr') => days.map((d) => WEEKDAYS[lang][d]).join(lang === 'fr' ? ' et ' : ' and ');
const NTH = ['', '1st', '2nd', '3rd', '4th', '5th'];

function NextRow({ stream, zone: own, today, via }: { stream: Stream; zone?: Zone; today: string; via?: Zone }) {
  const { t, lang } = useT();
  const b = STREAM_STYLE[stream];
  // "Included in the organics collection": answer with the brown bin's day rather than a dead end.
  const shared = own?.seeOther && via && !via.seeOther ? via : undefined;
  const zone = shared ?? own;
  const next = zone ? zonePickups(zone, today, 120)[0] : undefined;
  const isToday = next?.date === today;
  const headline = !zone
    ? t('No city schedule here')
    : next
      ? humanDay(next.date, today, lang)
      : zone.biweekly
        ? t('Every other {days}', { days: dayList(zone.days, lang) })
        : zone.dates
          ? t('Season is over')
          : zone.seeOther || !zone.days.length
            ? t("See the city's instructions")
            : t('None in the next 4 months');
  const sub = shared
    ? t('Goes in the brown bin with food scraps.')
    : zone?.monthly && zone.days.length
    ? t('{nth} {days} of the month', { nth: zone.monthly.map((n) => lang === 'fr' ? `${n}${n === 1 ? 'er' : 'e'}` : NTH[n]).join(lang === 'fr' ? ' et ' : ' and '), days: dayList(zone.days, lang) })
    : zone?.dates && !next
      ? t('No more dates listed for {year}.', { year: zone.dates.at(-1)!.slice(0, 4) })
      : zone?.biweekly
        ? t("The city's calendar shows which weeks.")
        : next?.note;
  return (
    <View style={[styles.nextRow, isToday && { backgroundColor: 'rgba(255,255,255,0.9)', borderColor: colors.forest }]}>
      <View style={[styles.bubble, { width: 36, height: 36, borderRadius: 18, backgroundColor: b.bg }]}>
        <Icon name={b.icon} size={18} color={b.deep} />
      </View>
      <View style={{ flex: 1 }}>
        <T size="xs" weight="semibold" color={colors.inkMuted}>{t(b.label as TKey)}</T>
        <T size="base" weight="bold" color={isToday ? colors.forest : colors.ink}>{headline}</T>
        {sub && <T size="xs" color={colors.inkMuted}>{sub}</T>}
      </View>
      {next && (
        <View style={[styles.count, isToday && { backgroundColor: colors.forest }]}>
          <T size="xs" weight="semibold" color={isToday ? colors.white : colors.ink}>{countdown(next.date, today, lang)}</T>
        </View>
      )}
    </View>
  );
}

export function AreaDetails({ area, today, fetchedOn, sourceUrl }: { area: Area; today: string; fetchedOn: string; sourceUrl: string }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const zones = STREAMS.flatMap((s) => (area[s] ? [area[s]!] : []));
  const ex = zones.flatMap((z) => z.exceptions.filter((e) => e.date >= today).map((e) => ({ ...e, stream: z.stream })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const anyBiweekly = zones.some((z) => z.biweekly);
  return (
    <View style={{ gap: 16 }}>
      <Glass style={styles.card}>
        <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>{t("Next pickup")}</T>
        {STREAMS.filter((st) => st === 'garbage' || st === 'recycling' || area[st]).map((st) => (
          <NextRow key={st} stream={st} zone={area[st]} today={today} via={st === 'yard' ? area.food : undefined} />
        ))}
      </Glass>
      {ex.length > 0 && (
        <Glass style={styles.card}>
          <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>{t("Holiday changes")}</T>
          {ex.map((e) => (
            <View key={e.stream + e.date} style={styles.row}>
              <Icon name="event" size={16} color={colors.inkMuted} />
              <T size="sm" style={{ flex: 1 }}>
                <T size="sm" weight="semibold">{humanDay(e.date, today, lang)}</T>
                {` · ${t(STREAM_STYLE[e.stream as Stream].label as TKey)}: ${e.moveTo ? t('moved to {day}', { day: humanDay(e.moveTo, today, lang) }) : t('no pickup')}`}
              </T>
            </View>
          ))}
        </Glass>
      )}
      <Glass style={styles.card}>
        <Spring onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} pressedScale={0.98} style={styles.kv}>
          <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>{t("The city's instructions")}</T>
          <Icon name={open ? 'expand-less' : 'expand-more'} size={20} color={colors.inkMuted} />
        </Spring>
        {open && zones.map((z) => (
          <View key={z.stream} style={{ gap: 4 }}>
            <T size="xs" weight="semibold">{t('{stream} · sector {id}', { stream: t(STREAM_STYLE[z.stream].label as TKey), id: z.id.replace(/^MO:/, '') })}</T>
            <T size="xs" color={colors.inkMuted}>{z.note}</T>
          </View>
        ))}
        {anyBiweekly && (
          <Spring onPress={() => Linking.openURL('https://montreal.ca/info-collectes')} accessibilityRole="link" hitSlop={8}>
            <T size="sm" weight="bold" color={colors.forest}>{t("Open the city's collection calendar")}</T>
          </Spring>
        )}
        <Spring onPress={() => Linking.openURL(sourceUrl)} accessibilityRole="link" hitSlop={8}>
          <T size="xs" color={colors.inkMuted}>
            {t('Ville de Montréal open data, downloaded {date}.', { date: new Date(`${fetchedOn}T12:00:00`).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) })}
          </T>
        </Spring>
      </Glass>
    </View>
  );
}

export function DropoffDetails({ d }: { d: Dropoff }) {
  const { t, lang } = useT();
  const app = useMapsApp();
  const hoursLink = d.kind === 'ecocentre' ? (d.city === 'Montréal' ? t("Check today's hours on montreal.ca") : t('Check hours with {city}', { city: d.city ?? '' })) : t('Find more battery drop-offs');
  return (
    <View style={{ gap: 16 }}>
      {d.address && (
        <View style={styles.row}>
          <Icon name="place" size={16} color={colors.inkMuted} />
          <T size="sm" color={colors.inkMuted} style={{ flex: 1 }}>{d.address}</T>
        </View>
      )}
      <View style={{ gap: 8 }}>
        <PrimaryButton label={app ? t('Directions in {app}', { app: appLabel(app) }) : t('Get directions')} icon="directions" size="md" onPress={() => goTo(d, lang)} />
        {app && (
          <Spring onPress={() => chooseAndGo(d, lang)} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'center', minHeight: 32, justifyContent: 'center' }}>
            <T size="xs" weight="semibold" color={colors.inkMuted}>{t("Use another app")}</T>
          </Spring>
        )}
      </View>
      <Glass style={styles.card}>
        <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>{t("Hours")}</T>
        {d.hours ? (
          <>
            <T size="sm" weight="semibold" style={styles.num}>{d.hours}</T>
            <T size="xs" color={colors.inkMuted}>{t("As listed on OpenStreetMap; worth a call before a special trip.")}</T>
          </>
        ) : (
          <T size="sm" color={colors.inkMuted}>
            {d.kind === 'ecocentre' ? t("Hours change with the season and aren't in the open data.") : t("Hours aren't listed for this one.")}
          </T>
        )}
        {d.infoUrl && (
          <Spring onPress={() => Linking.openURL(d.infoUrl!)} accessibilityRole="link" hitSlop={8}>
            <T size="sm" weight="bold" color={colors.forest}>{hoursLink}</T>
          </Spring>
        )}
      </Glass>
      <Glass style={styles.card}>
        <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>{t("Takes")}</T>
        {d.items ? (
          <>
            <View style={styles.wrap}>
              {d.items.map((m) => (
                <View key={m} style={styles.material}><T size="xs" weight="semibold">{m}</T></View>
              ))}
            </View>
            {d.note && <T size="xs" color={colors.inkMuted}>{d.note}</T>}
          </>
        ) : (
          <T size="sm" color={colors.inkMuted}>{t('Run by {city}, which sets its own list and who can use it.', { city: d.city ?? '' })}</T>
        )}
      </Glass>
      <T size="xs" color={colors.inkMuted}>
        {t('Location: {source}.', { source: t(d.source as TKey) })}{d.kind !== 'battery' && d.items ? t(" Items: TriMTL's Montréal sorting rules.") : ''}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  num: { fontVariant: ['tabular-nums'] },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.6 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1 },
  chipIdle: { backgroundColor: 'rgba(255, 255, 255, 0.86)', borderColor: 'rgba(255, 255, 255, 0.95)' },
  go: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bubble: { backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  listRow: { borderRadius: radius['2xl'], paddingHorizontal: 14, paddingVertical: 12, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  strokeCell: { width: 40, alignItems: 'center' },
  card: { borderRadius: radius['2xl'], padding: 16, gap: 10 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius['2xl'], borderWidth: 1, borderColor: 'transparent' },
  count: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(18,41,31,0.08)' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  material: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(18,41,31,0.08)' },
});
