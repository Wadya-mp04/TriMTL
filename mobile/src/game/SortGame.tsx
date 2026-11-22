/**
 * The throw-to-sort game. One item at a time: flick it up into a bin, drag it onto one, or tap a bin.
 * Right bin: the lid flips open, the item drops in behind the bin's front, the lid slams and
 * bounces, confetti. Wrong bin: the lid stays shut, the bin rattles, the item bounces back to
 * your hand and the right bin is ringed; throw it there to move on. Points only on the first try.
 *
 * Each cart is drawn in two layers (opening + lid behind, body in front) so the item can drop
 * between them, which is how it disappears "into" the bin without any clipping.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type HostInstance,
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Icon, T } from '../components/ui';
import type { SortItem } from '../data/items';
import { BIN_ORDER, BinKey, bins, colors } from '../theme';
import {
  BIN_TOP,
  binBackXml,
  binFrontXml,
  binLidUnderXml,
  binLidXml,
  CART,
  CONFETTI,
  hasArt,
  itemXml,
  latchOrigin,
  latchXml,
  lidOrigin,
  markXml,
} from './art';
import { type GameTheme, skyInk, streetDark } from './themes';

export type Origin = 'today' | 'past' | 'never';
export interface DeckEntry { item: SortItem; origin: Origin }
export interface RoundResult { item: SortItem; first: boolean }

const S = 104; // item size
/** Clear sidewalk between the item and the bin labels: room for a thumb to flick. */
const RUNWAY = 118;
const THE: Record<BinKey, string> = { recycling: 'the recycling', compost: 'the brown bin', garbage: 'the garbage', special: 'special drop-off' };
const RIGHT = ['Right bin.', "That's the one.", 'Spot on.'];
const REVIEW = '#F6C945';
const BAD = '#D9785E'; // clay, readable on light and dark streets

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const run = (a: Animated.CompositeAnimation) => new Promise<void>((res) => a.start(() => res()));
const tm = (v: Animated.Value, toValue: number, duration: number, easing = Easing.linear) =>
  Animated.timing(v, { toValue, duration, easing, useNativeDriver: true });

type Feedback = { kind: 'idle' | 'good' | 'bad'; title: string; body: string; note?: string };

export function SortGame({
  deck,
  theme,
  xpPerHit,
  onHit,
  onFinish,
  onGround,
  onProgress,
}: {
  deck: DeckEntry[];
  theme: GameTheme;
  xpPerHit: number;
  onHit: () => void;
  onFinish: (results: RoundResult[]) => void;
  /** Where the bins' wheels meet the street, in window coordinates, so the backdrop can line up. */
  onGround?: (y: number) => void;
  /** Current item (0-based) and deck size, for the screen header's "Item 1 of 4". */
  onProgress?: (index: number, total: number) => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [idx, setIdx] = useState(0);
  const [reveal, setReveal] = useState<BinKey | null>(null);
  const [hover, setHover] = useState<BinKey | null>(null);
  const [itemZ, setItemZ] = useState(30);
  const [, setFeedback] = useState<Feedback>({ kind: 'idle', title: 'Ready when you are.', body: 'Flick each item into its bin, or tap a bin.' });
  useEffect(() => { onProgress?.(Math.min(idx, deck.length - 1), deck.length); }, [idx, deck.length, onProgress]);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const [floats, setFloats] = useState<{ id: number; x: number; y: number }[]>([]);
  const [reduced, setReduced] = useState(false);

  const busy = useRef(false);
  const tries = useRef(0);
  const results = useRef<RoundResult[]>([]);
  const rightN = useRef(0);
  const pos = useRef({ x: 0, y: 0, s: 1, r: 0 });

  // Item motion. translateY is ty + arc, so a throw can add a parabola on top of a straight move.
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const arc = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(1)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(1)).current;
  const per = useRef(
    Object.fromEntries(
      BIN_ORDER.map((b) => [b, { lid: new Animated.Value(1), shake: new Animated.Value(0), squash: new Animated.Value(1), mark: new Animated.Value(0) }]),
    ) as Record<BinKey, { lid: Animated.Value; shake: Animated.Value; squash: Animated.Value; mark: Animated.Value }>,
  ).current;
  const latch = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  const ms = (n: number) => (reduced ? Math.min(n, 160) : n);

  // ---------- Geometry, all in scene coordinates
  const geo = useMemo(() => {
    const { w, h } = size;
    const pad = 10, gap = 6;
    const colW = (w - 2 * pad - 3 * gap) / 4;
    const binW = Math.min(colW, 96), binH = binW * 1.3, k = binW / 100;
    // Stack from the bottom: name under the item, item under the bin labels, bins on the street. Everything above is backdrop.
    const homeY = h - S / 2 - 64, rowTop = Math.max(h * 0.12, homeY - S / 2 - RUNWAY - binH);
    const box = Object.fromEntries(
      BIN_ORDER.map((b, i) => {
        const left = pad + i * (colW + gap) + (colW - binW) / 2;
        return [b, { left, cx: left + binW / 2, mouth: rowTop + (BIN_TOP[b] + 7) * k, lidTop: rowTop + (BIN_TOP[b] - 2) * k }];
      }),
    ) as Record<BinKey, { left: number; cx: number; mouth: number; lidTop: number }>;
    return { colW, binW, binH, rowTop, box, home: { x: w / 2, y: homeY } };
  }, [size]);
  const geoRef = useRef(geo);
  geoRef.current = geo;

  const entry = deck[Math.min(idx, deck.length - 1)];
  const entryRef = useRef(entry);
  entryRef.current = entry;

  const setPos = (p: Partial<typeof pos.current>) => {
    pos.current = { ...pos.current, ...p };
    if (p.x !== undefined) tx.setValue(p.x);
    if (p.y !== undefined) ty.setValue(p.y);
    if (p.s !== undefined) sc.setValue(p.s);
    if (p.r !== undefined) rot.setValue(p.r);
  };

  // ---------- Round flow
  async function bringIn() {
    const { home } = geoRef.current;
    tries.current = 0;
    setReveal(null);
    setItemZ(30);
    op.setValue(1);
    arc.setValue(0);
    setPos({ x: home.x, y: home.y + 90, s: 0.5, r: -8 });
    await run(Animated.parallel([
      Animated.spring(ty, { toValue: home.y, useNativeDriver: true, speed: 14, bounciness: 9 }),
      Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 9 }),
      tm(rot, 0, ms(300), Easing.out(Easing.cubic)),
    ]));
    // The scene may have resized while the item was entering: settle on the current home.
    const now = geoRef.current.home;
    setPos({ x: now.x, y: now.y, s: 1, r: 0 });
    busy.current = false;
  }

  useEffect(() => {
    results.current = [];
    setIdx(0);
  }, [deck]);
  const ready = size.w > 0;
  useEffect(() => {
    if (!ready || !deck.length) return;
    busy.current = true;
    if (idx >= deck.length) onFinish(results.current);
    else bringIn();
    // bringIn reads refs only; re-running it on every render would restart the entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, deck, ready]);
  // The feedback card changes height and so resizes the scene: re-home a resting item, keep the round.
  useEffect(() => {
    if (ready && !busy.current) setPos({ x: geo.home.x, y: geo.home.y, s: 1, r: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  useEffect(() => {
    if (!reveal) return;
    const loop = Animated.loop(Animated.sequence([tm(ring, 0.35, 700, Easing.inOut(Easing.quad)), tm(ring, 1, 700, Easing.inOut(Easing.quad))]));
    loop.start();
    return () => loop.stop();
  }, [reveal, ring]);

  const say = (f: Feedback) => {
    setFeedback(f);
    AccessibilityInfo.announceForAccessibility(`${f.title} ${f.body}`);
  };

  // ---------- Animations
  function flight(x: number, y: number, s: number, duration: number, spin: number) {
    const from = pos.current;
    const h = reduced ? 0 : Math.max(50, (from.y - y) * 0.35 + 30);
    const d = ms(duration);
    pos.current = { x, y, s, r: from.r + spin };
    return run(Animated.parallel([
      tm(tx, x, d),
      tm(ty, y, d, Easing.out(Easing.cubic)),
      Animated.sequence([tm(arc, -h, d / 2, Easing.out(Easing.quad)), tm(arc, 0, d / 2, Easing.in(Easing.quad))]),
      tm(sc, s, d),
      tm(rot, from.r + spin, d),
    ]));
  }

  function openLid(b: BinKey) {
    const lid = per[b].lid;
    const steps: Animated.CompositeAnimation[] = [];
    if (b === 'compost') steps.push(tm(latch, 0.12, ms(110), Easing.in(Easing.quad)));
    steps.push(tm(lid, -1.75, ms(170), Easing.out(Easing.quad)), tm(lid, -1.45, ms(80)));
    Animated.sequence(steps).start();
  }
  function closeLid(b: BinKey) {
    const lid = per[b].lid;
    if (reduced) { lid.setValue(1); latch.setValue(1); return; }
    Animated.sequence([
      tm(lid, 1, 240, Easing.in(Easing.quad)),
      tm(lid, -0.6, 110, Easing.out(Easing.quad)),
      tm(lid, 1, 110, Easing.in(Easing.quad)),
      tm(lid, -0.2, 70, Easing.out(Easing.quad)),
      tm(lid, 1, 70, Easing.in(Easing.quad)),
    ]).start();
    if (b === 'compost') Animated.sequence([Animated.delay(520), tm(latch, 1.08, 140), tm(latch, 1, 80)]).start();
    Animated.sequence([tm(per[b].squash, 0.9, 90), tm(per[b].squash, 1.05, 120), tm(per[b].squash, 1, 140)]).start();
  }
  function rattle(b: BinKey) {
    const { shake, lid, mark } = per[b];
    if (!reduced) {
      Animated.sequence([tm(shake, -5, 70), tm(shake, 4, 90), tm(shake, -2, 90), tm(shake, 0, 90)]).start();
      Animated.sequence([tm(lid, 0.45, 80), tm(lid, 1, 90), tm(lid, 0.8, 70), tm(lid, 1, 70)]).start(); // jumps, stays shut
    }
    Animated.sequence([Animated.spring(mark, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 12 }), Animated.delay(1200), tm(mark, 0, 300)]).start();
  }
  async function bounceBack() {
    const { home } = geoRef.current;
    const d = ms(620);
    const r0 = pos.current.r;
    await run(Animated.parallel([
      tm(tx, home.x, d),
      tm(ty, home.y, d, Easing.in(Easing.quad)),
      Animated.sequence([tm(arc, reduced ? 0 : -50, d / 2, Easing.out(Easing.quad)), tm(arc, 0, d / 2, Easing.in(Easing.quad))]),
      tm(sc, 1, d, Easing.out(Easing.cubic)),
      tm(rot, r0 - (reduced ? 0 : 200), d),
    ]));
    if (!reduced) {
      await run(Animated.sequence([
        tm(arc, -24, 120, Easing.out(Easing.quad)), tm(arc, 0, 120, Easing.in(Easing.quad)),
        tm(arc, -9, 70, Easing.out(Easing.quad)), tm(arc, 0, 70, Easing.in(Easing.quad)),
      ]));
    }
    setPos({ x: home.x, y: home.y, s: 1, r: 0 });
  }
  function springHome() {
    const { home } = geoRef.current;
    busy.current = true;
    pos.current = { x: home.x, y: home.y, s: 1, r: 0 };
    Animated.parallel([
      Animated.spring(tx, { toValue: home.x, useNativeDriver: true, speed: 18, bounciness: 8 }),
      Animated.spring(ty, { toValue: home.y, useNativeDriver: true, speed: 18, bounciness: 8 }),
      Animated.spring(sc, { toValue: 1, useNativeDriver: true }),
      Animated.spring(rot, { toValue: 0, useNativeDriver: true }),
    ]).start(() => { busy.current = false; });
  }

  // ---------- The throw
  async function throwTo(b: BinKey, vx = 0) {
    if (busy.current || !entryRef.current) return;
    busy.current = true;
    setHover(null);
    const { box, binW } = geoRef.current;
    const item = entryRef.current.item;
    const g = box[b];
    const s = (binW * 0.62) / S;
    const spin = reduced ? 0 : (vx >= 0 ? 1 : -1) * 300;
    if (b === item.bin) {
      const t = setTimeout(() => openLid(b), ms(560) * 0.55);
      await flight(g.cx, g.mouth - 6, s, 560, spin);
      clearTimeout(t);
      openLid(b);
      setItemZ(2); // between the opening and the front of the cart
      await run(Animated.parallel([tm(ty, g.mouth + S * s * 1.05, ms(240), Easing.in(Easing.quad)), Animated.sequence([Animated.delay(ms(180)), tm(op, 0, ms(60))])]));
      landed(b, item);
    } else {
      await flight(g.cx, g.lidTop - (S * s) / 2, s, 520, spin);
      rattle(b);
      await bounceBack();
      missedBin(b, item);
    }
  }

  function landed(b: BinKey, item: SortItem) {
    const g = geoRef.current.box[b];
    closeLid(b);
    if (!reduced) setBursts((v) => [...v, { id: Date.now(), x: g.cx, y: g.mouth, color: CART[b] }]);
    const first = tries.current === 0;
    if (first) {
      onHit();
      setFloats((v) => [...v, { id: Date.now(), x: g.cx, y: g.lidTop - 14 }]);
      results.current.push({ item, first: true });
    } else {
      results.current.push({ item, first: false });
    }
    const title = first ? RIGHT[rightN.current++ % RIGHT.length] : `In ${THE[b]} now.`;
    const note = item.detail && item.detail !== 'Needs verification' ? item.detail : undefined;
    say({ kind: 'good', title, body: item.note, note });
    setTimeout(() => setIdx((i) => i + 1), ms(700));
  }

  function missedBin(chosen: BinKey, item: SortItem) {
    tries.current += 1;
    const right = item.bin as BinKey;
    setReveal(right);
    say({ kind: 'bad', title: `Not ${THE[chosen]}. It goes in ${THE[right]}.`, body: `${item.note} Throw it into ${bins[right].label} to keep going.` });
    busy.current = false;
  }

  async function missAll(xl: number) {
    const { rowTop, binH } = geoRef.current;
    busy.current = true;
    await flight(clamp(xl, -40, size.w + 40), rowTop + binH * 0.6, 0.6, 480, 240);
    await bounceBack();
    say({ kind: 'idle', title: 'Missed the bins.', body: 'Flick a little straighter, or tap a bin.' });
    busy.current = false;
  }

  // ---------- Drag and flick
  const binAt = (x: number, y: number): BinKey | null => {
    const { box, binW, binH, rowTop } = geoRef.current;
    for (const b of BIN_ORDER) {
      const l = box[b].left;
      if (x >= l - 8 && x <= l + binW + 8 && y >= rowTop - 10 && y <= rowTop + binH + 24) return b;
    }
    return null;
  };
  const start = useRef(pos.current);
  const hoverRef = useRef<BinKey | null>(null);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !busy.current,
        onMoveShouldSetPanResponder: () => !busy.current,
        onPanResponderGrant: () => { start.current = { ...pos.current }; },
        onPanResponderMove: (_, g) => {
          const { home, box } = geoRef.current;
          const x = start.current.x + g.dx, y = start.current.y + g.dy;
          const lift = clamp((home.y - y) / (home.y - box.recycling.mouth), 0, 1);
          setPos({ x, y, s: 1 - lift * 0.35, r: clamp(g.vx * 20, -18, 18) });
          const over = binAt(x, y);
          if (over !== hoverRef.current) { hoverRef.current = over; setHover(over); }
        },
        onPanResponderRelease: (_, g) => {
          hoverRef.current = null;
          setHover(null);
          const { home, box, colW } = geoRef.current;
          const { x, y } = pos.current;
          const over = binAt(x, y);
          if (over) return void throwTo(over, g.vx);
          if (g.vy < -0.3 && home.y - y > 20) {
            const rowY = box.recycling.mouth;
            const xl = x + g.vx * ((y - rowY) / -g.vy);
            let best: BinKey = 'recycling';
            for (const b of BIN_ORDER) if (Math.abs(box[b].cx - xl) < Math.abs(box[best].cx - xl)) best = b;
            if (Math.abs(box[best].cx - xl) < colW * 0.75) return void throwTo(best, g.vx);
            return void missAll(xl);
          }
          springHome();
        },
        onPanResponderTerminate: () => springHome(),
      }),
    // throwTo and friends read refs; the responder only needs creating once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const sceneRef = useRef<HostInstance>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - size.w) > 1 || Math.abs(height - size.h) > 1) setSize({ w: width, h: height });
  };
  useEffect(() => {
    if (!size.w || !onGround) return;
    sceneRef.current?.measureInWindow((_x, y) => onGround(y + geo.rowTop + geo.binH * 0.94));
  }, [geo, size.w, onGround]);

  // ---------- Render
  const { box, binW, binH, rowTop, home } = geo;
  const binTransform = (b: BinKey) => [
    { translateY: hover === b ? -6 : 0 },
    { rotate: per[b].shake.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] }) },
    { scaleY: per[b].squash },
  ];
  const binBox = (b: BinKey) => ({ left: box[b].left, top: rowTop, width: binW, height: binH, transformOrigin: '50% 100%' });
  const item = entry?.item;
  const ink = skyInk(theme), dark = streetDark(theme);

  return (
    <View style={{ flex: 1, gap: 10 }}>
      <View ref={sceneRef} style={styles.scene} onLayout={onLayout}>
        {size.w > 0 && BIN_ORDER.map((b) => (
          <Animated.View key={`back-${b}`} pointerEvents="none" style={[styles.abs, binBox(b), { zIndex: 1, transform: binTransform(b) }]}>
            <SvgXml xml={binBackXml(b)} width="100%" height="100%" />
            <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: lidOrigin(b), transform: [{ scaleY: per[b].lid }] }]}>
              <SvgXml xml={binLidXml(b)} width="100%" height="100%" />
              {/* past upright the lid is seen from below */}
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: per[b].lid.interpolate({ inputRange: [-0.05, 0.05], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
                <SvgXml xml={binLidUnderXml(b)} width="100%" height="100%" />
              </Animated.View>
            </Animated.View>
          </Animated.View>
        ))}

        {size.w > 0 && BIN_ORDER.map((b) => (
          <Animated.View key={`front-${b}`} pointerEvents="none" style={[styles.abs, binBox(b), { zIndex: 3, transform: binTransform(b) }]}>
            <SvgXml xml={binFrontXml(b)} width="100%" height="100%" />
            {b === 'compost' && (
              <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: latchOrigin, transform: [{ scaleY: latch }] }]}>
                <SvgXml xml={latchXml()} width="100%" height="100%" />
              </Animated.View>
            )}
            <Animated.View style={[styles.mark, { opacity: per[b].mark, transform: [{ scale: per[b].mark.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]}>
              <SvgXml xml={markXml} width="100%" height="100%" />
            </Animated.View>
          </Animated.View>
        ))}

        {size.w > 0 && reveal && (
          <Animated.View
            pointerEvents="none"
            style={[styles.abs, styles.ring, { borderColor: theme.accent, opacity: ring, left: box[reveal].left - 6, top: rowTop - 4, width: binW + 12, height: binH + 6 }]}
          />
        )}

        {size.w > 0 && BIN_ORDER.map((b) => (
          <Pressable
            key={`tap-${b}`}
            onPress={() => throwTo(b)}
            accessibilityRole="button"
            accessibilityLabel={`Throw into ${bins[b].label}`}
            style={[styles.abs, { zIndex: 25, left: box[b].left - 4, top: rowTop, width: binW + 8, height: binH + 40, alignItems: 'center', justifyContent: 'flex-end' }]}
          >
            <T size="xs" weight="bold" color={reveal === b ? theme.accent : theme.laneInk}>{bins[b].label}</T>
            <View style={[styles.underline, { backgroundColor: reveal === b ? theme.accent : 'transparent' }]} />
          </Pressable>
        ))}

        {size.w > 0 && item && (
          <View pointerEvents="none" style={[styles.labels, { top: home.y + S / 2 + 6 }]}>
            <T size="2xl" display color={theme.laneInk} style={{ textAlign: 'center' }} numberOfLines={1}>{item.name}</T>
            {idx === 0 && <T size="xs" color={theme.laneMuted}>Flick it into a bin, or tap a bin.</T>}
          </View>
        )}

        {size.w > 0 && item && (
          <Animated.View
            {...pan.panHandlers}
            accessible
            accessibilityLabel={`${item.name}. Drag it to a bin, or tap a bin above.`}
            style={[
              styles.item,
              {
                zIndex: itemZ,
                opacity: op,
                transform: [
                  { translateX: tx },
                  { translateY: Animated.add(ty, arc) },
                  { rotate: rot.interpolate({ inputRange: [-3600, 3600], outputRange: ['-3600deg', '3600deg'] }) },
                  { scale: sc },
                ],
              },
            ]}
          >
            {hasArt(item.art) ? (
              <SvgXml xml={itemXml(item.art!)} width="100%" height="100%" />
            ) : (
              <View style={styles.token}><Icon name={item.icon} size={52} color={theme.accent} /></View>
            )}
          </Animated.View>
        )}

        {bursts.map((b) => (
          <Confetti key={b.id} x={b.x} y={b.y} colors={[b.color, ...CONFETTI, theme.accent]} onDone={() => setBursts((v) => v.filter((o) => o.id !== b.id))} />
        ))}
        {floats.map((f) => (
          <Float key={f.id} x={f.x} y={f.y} text={`+${xpPerHit}`} color={theme.accent} onDone={() => setFloats((v) => v.filter((o) => o.id !== f.id))} />
        ))}
      </View>
    </View>
  );
}

// ---------- Confetti: precomputed physics, sampled into interpolations so it runs on the native driver.
function Confetti({ x, y, colors: cols, onDone }: { x: number; y: number; colors: string[]; onDone: () => void }) {
  const t = useRef(new Animated.Value(0)).current;
  const parts = useMemo(() => {
    const FRAMES = 80, SAMPLES = 8;
    return Array.from({ length: 40 }, (_, i) => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9, sp = 4 + Math.random() * 7;
      let vx = Math.cos(a) * sp, vy = Math.sin(a) * sp, px = 0, py = 0;
      const xs = [0], ys = [0];
      for (let f = 1; f <= FRAMES; f++) {
        vy += 0.22; vx *= 0.985; vy *= 0.985; px += vx; py += vy;
        if (f % (FRAMES / SAMPLES) === 0) { xs.push(px); ys.push(py); }
      }
      const spin = (Math.random() - 0.5) * 900;
      return { xs, ys, spin, w: 5 + Math.random() * 5, h: 8 + Math.random() * 6, color: cols[i % cols.length], round: Math.random() < 0.25, ph: Math.random() * 6 };
    });
  }, [cols]);
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 1350, easing: Easing.linear, useNativeDriver: true }).start(onDone);
  }, [t, onDone]);
  const steps = parts[0].xs.map((_, i) => i / (parts[0].xs.length - 1));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 40 }]}>
      {parts.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute', left: x - p.w / 2, top: y - p.h / 2, width: p.w, height: p.round ? p.w : p.h,
            borderRadius: p.round ? p.w : 1, backgroundColor: p.color,
            opacity: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: t.interpolate({ inputRange: steps, outputRange: p.xs }) },
              { translateY: t.interpolate({ inputRange: steps, outputRange: p.ys }) },
              { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              { scaleX: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [Math.cos(p.ph), Math.cos(p.ph + 2), Math.cos(p.ph + 4), Math.cos(p.ph + 6), Math.cos(p.ph + 8)] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

function Float({ x, y, text, color, onDone }: { x: number; y: number; text: string; color: string; onDone: () => void }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(onDone);
  }, [t, onDone]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: x - 30, top: y, width: 60, alignItems: 'center', zIndex: 41,
        opacity: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] }),
        transform: [{ translateY: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [10, -14, -46] }) }],
      }}
    >
      <T size="xl" weight="bold" color={color}>{text}</T>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1 },
  abs: { position: 'absolute' },
  item: { position: 'absolute', left: -S / 2, top: -S / 2, width: S, height: S },
  token: {
    flex: 1, margin: 10, borderRadius: 999, backgroundColor: colors.white, borderWidth: 3.5, borderColor: '#1A2620',
    alignItems: 'center', justifyContent: 'center',
  },
  underline: { width: 22, height: 2, borderRadius: 1, marginTop: 2 },
  mark: { position: 'absolute', width: '46%', aspectRatio: 1, left: '27%', top: '18%' },
  ring: { borderWidth: 3, borderRadius: 18, zIndex: 4 },
  labels: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 2 },
});
