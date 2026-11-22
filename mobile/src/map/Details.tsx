/**
 * Sheet content for the Map tab: legend, list rows, and the lane and drop-off detail views.
 */
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { Glass, Icon, PrimaryButton, Spring, T } from '../components/ui';
import type { Dropoff, Zone } from '../data/map';
import { bins, colors, radius, shadow } from '../theme';
import { appLabel, chooseAndGo, goTo, useMapsApp } from './directions';
import { LANE_STYLE, PLACE_STYLE } from './mapHtml';
import { addDays, countdown, humanDay, shortWeekday, upcoming, weekdayOf, weekly, type Stream } from './schedule';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** A short stroke drawn the way the map draws it. */
function Stroke({ streams, width = 22 }: { streams: Stream[]; width?: number }) {
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
  const items: { streams: Stream[]; label: string }[] = [
    { streams: ['garbage'], label: 'Garbage sector' },
    { streams: ['recycling'], label: 'Recycling sector' },
  ];
  return (
    <View accessible accessibilityLabel="Legend. Solid grey outline: garbage sector. Dashed blue outline: recycling sector." style={styles.legend}>
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
  return (
    <Spring
      onPress={onPress}
      pressedScale={0.95}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Show places that take ${label.toLowerCase()}`}
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
  return (
    <Spring onPress={onPress} pressedScale={0.98} accessibilityRole="button" accessibilityLabel={`${d.name}, ${d.area}${distance !== undefined ? `, ${distanceLabel(distance)} away` : ''}`}>
      <Glass style={styles.listRow}>
        <PlaceBubble kind={d.kind} />
        <View style={{ flex: 1, gap: 2 }}>
          <T size="sm" weight="semibold" numberOfLines={1}>{d.name}</T>
          <T size="xs" color={colors.inkMuted} numberOfLines={1}>{d.area}</T>
        </View>
        {distance !== undefined && <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.num}>{distanceLabel(distance)}</T>}
        <Spring
          onPress={() => goTo(d)}
          pressedScale={0.92}
          accessibilityRole="button"
          accessibilityLabel={`Directions to ${d.name}`}
          style={[styles.go, { backgroundColor: colors.ink }]}
        >
          <Icon name="directions" size={20} color={colors.white} />
        </Spring>
      </Glass>
    </Spring>
  );
}

export type Area = { garbage?: Zone; recycling?: Zone };

/** Weekly rules for the sectors whose weeks are known; every-other-week sectors cannot be dated. */
export const areaRules = (a: Area) =>
  (['garbage', 'recycling'] as Stream[]).flatMap((stream) => {
    const z = a[stream];
    return z && !z.biweekly ? z.days.map((d) => ({ stream, rule: weekly(d), exceptions: z.exceptions })) : [];
  });

/** Seven days from today; a pickup day shows its stream marks, today gets a soft forest ring. */
function WeekStrip({ area, today }: { area: Area; today: string }) {
  const days = upcoming(areaRules(area), today, 7);
  return (
    <View style={styles.strip} accessibilityLabel="Next seven days" accessibilityRole="summary">
      {Array.from({ length: 7 }, (_, i) => {
        const key = addDays(today, i);
        const p = days.find((d) => d.date === key);
        const isToday = i === 0;
        const label = `${isToday ? 'Today' : WEEKDAYS[weekdayOf(key)]}: ${p ? p.streams.join(' and ') : 'no pickup'}`;
        return (
          <View key={key} accessible accessibilityLabel={label} style={[styles.day, isToday && { borderColor: colors.forest, backgroundColor: 'rgba(255,255,255,0.9)' }]}>
            <T size="xs" weight={isToday ? 'bold' : 'medium'} color={isToday ? colors.forest : colors.inkMuted}>{shortWeekday(key).slice(0, 2)}</T>
            <T size="sm" weight="bold" style={styles.num} color={p ? colors.ink : colors.inkMuted}>{Number(key.slice(8))}</T>
            <View style={styles.marks}>
              {p?.streams.includes('garbage') && <View style={[styles.mark, { backgroundColor: bins.garbage.fg }]} />}
              {p?.streams.includes('recycling') && <View style={[styles.mark, styles.markRing, { borderColor: bins.recycling.fg }]} />}
              {!p && <View style={styles.markNone} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const dayList = (days: number[]) => days.map((d) => WEEKDAYS[d]).join(' and ');

function NextRow({ stream, zone, today }: { stream: Stream; zone?: Zone; today: string }) {
  const b = bins[stream];
  const next = zone && !zone.biweekly ? upcoming(areaRules({ [stream]: zone }), today, 56)[0] : undefined;
  const isToday = next?.date === today;
  const headline = !zone
    ? 'No city schedule here'
    : !zone.days.length
      ? 'Shared container, any day'
      : zone.biweekly
        ? `Every other ${dayList(zone.days)}`
        : next ? humanDay(next.date, today) : 'None in the next 8 weeks';
  return (
    <View style={[styles.nextRow, isToday && { backgroundColor: 'rgba(255,255,255,0.9)', borderColor: colors.forest }]}>
      <View style={[styles.bubble, { width: 36, height: 36, borderRadius: 18, backgroundColor: b.bg }]}>
        <Icon name={b.icon} size={18} color={b.deep} />
      </View>
      <View style={{ flex: 1 }}>
        <T size="xs" weight="semibold" color={colors.inkMuted}>{b.label}</T>
        <T size="base" weight="bold" color={isToday ? colors.forest : colors.ink}>{headline}</T>
        {zone?.biweekly && <T size="xs" color={colors.inkMuted}>The city's calendar shows which weeks.</T>}
        {next?.note && <T size="xs" color={colors.inkMuted}>{next.note}</T>}
      </View>
      {next && (
        <View style={[styles.count, isToday && { backgroundColor: colors.forest }]}>
          <T size="xs" weight="semibold" color={isToday ? colors.white : colors.ink}>{countdown(next.date, today)}</T>
        </View>
      )}
    </View>
  );
}

export function AreaDetails({ area, today, fetchedOn, sourceUrl }: { area: Area; today: string; fetchedOn: string; sourceUrl: string }) {
  const [open, setOpen] = useState(false);
  const zones = (['garbage', 'recycling'] as Stream[]).flatMap((s) => (area[s] ? [area[s]!] : []));
  const ex = zones.flatMap((z) => z.exceptions.filter((e) => e.date >= today).map((e) => ({ ...e, stream: z.stream })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const anyBiweekly = zones.some((z) => z.biweekly);
  return (
    <View style={{ gap: 16 }}>
      <Glass style={styles.card}>
        <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>Next pickup</T>
        <NextRow stream="garbage" zone={area.garbage} today={today} />
        <NextRow stream="recycling" zone={area.recycling} today={today} />
      </Glass>
      {areaRules(area).length > 0 && <WeekStrip area={area} today={today} />}
      {ex.length > 0 && (
        <Glass style={styles.card}>
          <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>Holiday changes</T>
          {ex.map((e) => (
            <View key={e.stream + e.date} style={styles.row}>
              <Icon name="event" size={16} color={colors.inkMuted} />
              <T size="sm" style={{ flex: 1 }}>
                <T size="sm" weight="semibold">{humanDay(e.date, today)}</T>
                {` · ${bins[e.stream as Stream].label}: ${e.moveTo ? `moved to ${humanDay(e.moveTo, today)}` : 'no pickup'}`}
              </T>
            </View>
          ))}
        </Glass>
      )}
      <Glass style={styles.card}>
        <Spring onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} pressedScale={0.98} style={styles.kv}>
          <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>The city's instructions</T>
          <Icon name={open ? 'expand-less' : 'expand-more'} size={20} color={colors.inkMuted} />
        </Spring>
        {open && zones.map((z) => (
          <View key={z.stream} style={{ gap: 4 }}>
            <T size="xs" weight="semibold">{bins[z.stream].label} · sector {z.id}</T>
            <T size="xs" color={colors.inkMuted}>{z.note}</T>
          </View>
        ))}
        {anyBiweekly && (
          <Spring onPress={() => Linking.openURL('https://montreal.ca/info-collectes')} accessibilityRole="link" hitSlop={8}>
            <T size="sm" weight="bold" color={colors.forest}>Open the city's collection calendar</T>
          </Spring>
        )}
        <Spring onPress={() => Linking.openURL(sourceUrl)} accessibilityRole="link" hitSlop={8}>
          <T size="xs" color={colors.inkMuted}>
            Ville de Montréal open data, downloaded {new Date(`${fetchedOn}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}.
          </T>
        </Spring>
      </Glass>
    </View>
  );
}

export function DropoffDetails({ d }: { d: Dropoff }) {
  const app = useMapsApp();
  const hoursLink = d.kind === 'ecocentre' ? (d.city === 'Montréal' ? "Check today's hours on montreal.ca" : `Check hours with ${d.city}`) : 'Find more battery drop-offs';
  return (
    <View style={{ gap: 16 }}>
      {d.address && (
        <View style={styles.row}>
          <Icon name="place" size={16} color={colors.inkMuted} />
          <T size="sm" color={colors.inkMuted} style={{ flex: 1 }}>{d.address}</T>
        </View>
      )}
      <View style={{ gap: 8 }}>
        <PrimaryButton label={app ? `Directions in ${appLabel(app)}` : 'Get directions'} icon="directions" size="md" onPress={() => goTo(d)} />
        {app && (
          <Spring onPress={() => chooseAndGo(d)} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'center', minHeight: 32, justifyContent: 'center' }}>
            <T size="xs" weight="semibold" color={colors.inkMuted}>Use another app</T>
          </Spring>
        )}
      </View>
      <Glass style={styles.card}>
        <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>Hours</T>
        {d.hours ? (
          <>
            <T size="sm" weight="semibold" style={styles.num}>{d.hours}</T>
            <T size="xs" color={colors.inkMuted}>As listed on OpenStreetMap; worth a call before a special trip.</T>
          </>
        ) : (
          <T size="sm" color={colors.inkMuted}>
            {d.kind === 'ecocentre' ? "Hours change with the season and aren't in the open data." : "Hours aren't listed for this one."}
          </T>
        )}
        {d.infoUrl && (
          <Spring onPress={() => Linking.openURL(d.infoUrl!)} accessibilityRole="link" hitSlop={8}>
            <T size="sm" weight="bold" color={colors.forest}>{hoursLink}</T>
          </Spring>
        )}
      </Glass>
      <Glass style={styles.card}>
        <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>Takes</T>
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
          <T size="sm" color={colors.inkMuted}>Run by {d.city}, which sets its own list and who can use it.</T>
        )}
      </Glass>
      <T size="xs" color={colors.inkMuted}>
        Location: {d.source}.{d.kind !== 'battery' && d.items ? " Items: TriMTL's Montréal sorting rules." : ''}
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
  strip: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: radius['2xl'], backgroundColor: 'rgba(255, 255, 255, 0.6)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.88)' },
  marks: { flexDirection: 'row', gap: 3, height: 8, alignItems: 'center' },
  mark: { width: 8, height: 8, borderRadius: 4 },
  markRing: { backgroundColor: 'transparent', borderWidth: 2, borderStyle: 'dashed' },
  markNone: { width: 8, height: 2, borderRadius: 1, backgroundColor: 'rgba(18,41,31,0.12)' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  material: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(18,41,31,0.08)' },
});
