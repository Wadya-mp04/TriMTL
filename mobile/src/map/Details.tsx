/**
 * Sheet content for the Map tab: legend, list rows, and the lane and drop-off detail views.
 */
import { Linking, Platform, StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { Glass, Icon, PrimaryButton, Spring, T } from '../components/ui';
import type { Dropoff, Lane } from '../data/map';
import { bins, colors, radius, shadow } from '../theme';
import { DROPOFF_STYLE, LANE_STYLE } from './mapHtml';
import { addDays, clock, countdown, humanDay, nextPickup, openStatus, shortWeekday, upcoming, weekdayOf, type Stream } from './schedule';

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
    { streams: ['garbage'], label: 'Garbage' },
    { streams: ['recycling'], label: 'Recycling' },
    { streams: ['garbage', 'recycling'], label: 'Both' },
  ];
  return (
    <View accessible accessibilityLabel="Legend. Solid grey line: garbage. Dashed blue line: recycling. Grey and blue: both on the same day." style={styles.legend}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <Stroke streams={i.streams} />
          <T size="xs" weight="medium" color={colors.inkMuted}>{i.label}</T>
        </View>
      ))}
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
      accessibilityLabel={`${label} drop-offs`}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[styles.chip, active ? { backgroundColor: colors.ink, borderColor: colors.ink } : styles.chipIdle, shadow.sm]}
    >
      {icon && <Icon name={icon} size={16} color={active ? colors.white : tint} />}
      <T size="xs" weight="semibold" color={active ? colors.white : colors.ink}>{label}</T>
    </Spring>
  );
}

function TypeBubble({ type, size = 40 }: { type: Dropoff['type']; size?: number }) {
  const s = DROPOFF_STYLE[type];
  return (
    <View style={[styles.bubble, shadow.sm, { width: size, height: size, borderRadius: size / 2 }]}>
      <Icon name={s.icon} size={size * 0.5} color={s.color} />
    </View>
  );
}

function OpenLine({ hours, now }: { hours: Dropoff['hours']; now: Date }) {
  const st = openStatus(hours, now);
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: st.open ? colors.forest : 'rgba(65,94,82,0.45)' }]} />
      <T size="xs" weight="semibold" color={st.open ? colors.forest : colors.inkMuted}>{st.open ? 'Open now' : 'Closed'}</T>
      <T size="xs" color={colors.inkMuted}>· {st.label}</T>
    </View>
  );
}

export const distanceLabel = (m: number) => (m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

export function DropoffRow({ d, now, distance, onPress }: { d: Dropoff; now: Date; distance?: number; onPress: () => void }) {
  return (
    <Spring onPress={onPress} pressedScale={0.98} accessibilityRole="button" accessibilityLabel={`${d.name}, ${DROPOFF_STYLE[d.type].label}, ${openStatus(d.hours, now).label}`}>
      <Glass style={styles.listRow}>
        <TypeBubble type={d.type} />
        <View style={{ flex: 1, gap: 2 }}>
          <T size="sm" weight="semibold" numberOfLines={1}>{d.name}</T>
          <OpenLine hours={d.hours} now={now} />
        </View>
        {distance !== undefined && <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.num}>{distanceLabel(distance)}</T>}
        <Icon name="chevron-right" size={18} color={colors.inkMuted} />
      </Glass>
    </Spring>
  );
}

export function LaneRow({ lane, today, onPress }: { lane: Lane; today: string; onPress: () => void }) {
  const next = upcoming(lane, today, 56)[0];
  const when = next ? humanDay(next.date, today) : 'No pickup scheduled';
  const what = next ? next.streams.map((s) => LANE_STYLE[s].label.toLowerCase()).join(' and ') : '';
  return (
    <Spring onPress={onPress} pressedScale={0.98} accessibilityRole="button" accessibilityLabel={`${lane.name}. Next pickup ${when}, ${what}`}>
      <Glass style={styles.listRow}>
        <View style={styles.strokeCell}>{next && <Stroke streams={next.streams} width={28} />}</View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size="sm" weight="semibold" numberOfLines={1}>{lane.name}</T>
          <T size="xs" color={colors.inkMuted} numberOfLines={1}>
            <T size="xs" weight="semibold" color={next && next.date === today ? colors.forest : colors.ink}>{when}</T>
            {what ? ` · ${what[0].toUpperCase()}${what.slice(1)}` : ''}
          </T>
        </View>
        <Icon name="chevron-right" size={18} color={colors.inkMuted} />
      </Glass>
    </Spring>
  );
}

/** Seven days from today; a pickup day shows its stream marks, today gets a soft forest ring. */
function WeekStrip({ lane, today }: { lane: Lane; today: string }) {
  const days = upcoming(lane, today, 7);
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

function NextRow({ stream, lane, today }: { stream: Stream; lane: Lane; today: string }) {
  const p = nextPickup(lane[stream], stream, today, lane.exceptions);
  const b = bins[stream];
  const isToday = p?.date === today;
  return (
    <View style={[styles.nextRow, isToday && { backgroundColor: 'rgba(255,255,255,0.9)', borderColor: colors.forest }]}>
      <View style={[styles.bubble, { width: 36, height: 36, borderRadius: 18, backgroundColor: b.bg }]}>
        <Icon name={b.icon} size={18} color={b.deep} />
      </View>
      <View style={{ flex: 1 }}>
        <T size="xs" weight="semibold" color={colors.inkMuted}>{b.label}</T>
        <T size="base" weight="bold" color={isToday ? colors.forest : colors.ink}>{p ? humanDay(p.date, today) : 'None in the next 8 weeks'}</T>
        {p?.note && <T size="xs" color={colors.inkMuted}>{p.note}</T>}
      </View>
      {p && (
        <View style={[styles.count, isToday && { backgroundColor: colors.forest }]}>
          <T size="xs" weight="semibold" color={isToday ? colors.white : colors.ink}>{countdown(p.date, today)}</T>
        </View>
      )}
    </View>
  );
}

const freq = (r: Lane['garbage']) => `${r.every === 1 ? 'Every' : 'Every other'} ${WEEKDAYS[r.weekday]}`;

export function LaneDetails({ lane, today }: { lane: Lane; today: string }) {
  const ex = (lane.exceptions ?? []).filter((e) => e.date >= today);
  return (
    <View style={{ gap: 16 }}>
      <Glass style={styles.card}>
        <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>Next pickup</T>
        <NextRow stream="garbage" lane={lane} today={today} />
        <NextRow stream="recycling" lane={lane} today={today} />
      </Glass>
      <WeekStrip lane={lane} today={today} />
      <Glass style={styles.card}>
        <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>How often</T>
        <View style={styles.kv}><T size="sm" color={colors.inkMuted}>Garbage</T><T size="sm" weight="semibold">{freq(lane.garbage)}</T></View>
        <View style={styles.kv}><T size="sm" color={colors.inkMuted}>Recycling</T><T size="sm" weight="semibold">{freq(lane.recycling)}</T></View>
        <T size="xs" color={colors.inkMuted}>Put bins out after 7 pm the night before, or before 7 am on the day.</T>
      </Glass>
      {ex.length > 0 && (
        <Glass style={styles.card}>
          <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>Holiday changes</T>
          {ex.map((e) => (
            <View key={e.date + e.stream} style={styles.row}>
              <Icon name="event" size={16} color={colors.inkMuted} />
              <T size="sm" style={{ flex: 1 }}>
                <T size="sm" weight="semibold">{humanDay(e.date, today)}</T> · {e.note}
              </T>
            </View>
          ))}
        </Glass>
      )}
    </View>
  );
}

export function openDirections(d: Dropoff) {
  const q = encodeURIComponent(d.name);
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${d.lat},${d.lng}&q=${q}`,
    default: `geo:0,0?q=${d.lat},${d.lng}(${q})`,
  });
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`));
}

export function DropoffDetails({ d, now }: { d: Dropoff; now: Date }) {
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <View style={styles.row}><Icon name="place" size={16} color={colors.inkMuted} /><T size="sm" color={colors.inkMuted} style={{ flex: 1 }}>{d.address}</T></View>
        <OpenLine hours={d.hours} now={now} />
      </View>
      <PrimaryButton label="Get directions" icon="directions" size="md" onPress={() => openDirections(d)} />
      <Glass style={styles.card}>
        <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>Takes</T>
        <View style={styles.wrap}>
          {d.materials.map((m) => (
            <View key={m} style={styles.material}><T size="xs" weight="semibold">{m}</T></View>
          ))}
        </View>
      </Glass>
      <Glass style={styles.card}>
        <T size="xs" weight="semibold" color={colors.inkMuted} style={styles.eyebrow}>Hours</T>
        {[1, 2, 3, 4, 5, 6, 0].map((i) => {
          const h = d.hours[i];
          const isToday = i === now.getDay();
          const text = h === '00:00-24:00' ? 'Open 24 hours' : h ? `${clock(h.split('-')[0])} – ${clock(h.split('-')[1])}` : 'Closed';
          return (
            <View key={i} style={styles.kv}>
              <T size="sm" weight={isToday ? 'bold' : 'regular'} color={isToday ? colors.ink : colors.inkMuted}>{WEEKDAYS[i]}</T>
              <T size="sm" weight={isToday ? 'bold' : 'medium'} color={h ? colors.ink : colors.inkMuted} style={styles.num}>{text}</T>
            </View>
          );
        })}
      </Glass>
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
  bubble: { backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
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
