/**
 * Backgrounds.
 * - `CanvasBackground`: the soft gradient tinted by the neighbourhood, drawn by every non-tab page (opaque, so
 *   the native page fade crossfades whole pages cleanly). Crossfades when the theme changes.
 * - `TabsWorld`: wraps the three tabs (Scan, Play, Community) with one still background: the neighbourhood's
 *   sky (with its stars) and ground. Play adds the game's full scene (src/game/Backdrop) on top, sliding with
 *   the Play page; its sky comes from the same picture at the same place, so only buildings and street move.
 */
import { StatusBar } from 'expo-status-bar';
import { createContext, memo, ReactNode, useContext, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop, SvgXml } from 'react-native-svg';

import { Backdrop } from '../game/Backdrop';
import { type GameTheme, isDark, SKY_EXT, skyTopOf, streetDark, type ThemeKey, THEMES } from '../game/themes';
import { useApp } from '../state/AppState';
import { APP_PALETTES } from '../theme';

const THEME_FADE_MS = 350;

/** Reduce Motion, read once and kept current, so starting a fade never waits on an async lookup. */
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduceMotion = v; });
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduceMotion = v; });

/**
 * On a theme change, keeps the previous theme as a layer on top that fades out. The old layer is derived in
 * the same render as the change and the fade starts before the first paint, so colours never snap first.
 */
function useThemeLayers(key: ThemeKey) {
  const fade = useRef(new Animated.Value(0)).current;
  const next = useRef(1);
  const [state, setState] = useState<{ key: ThemeKey; prev: { id: number; key: ThemeKey } | null }>({ key, prev: null });
  if (state.key !== key) setState({ key, prev: { id: next.current++, key: state.key } });
  const prevId = state.prev?.id;
  useLayoutEffect(() => {
    if (prevId === undefined) return;
    fade.setValue(1);
    const anim = Animated.timing(fade, { toValue: 0, duration: reduceMotion ? 1 : THEME_FADE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    anim.start(({ finished }) => {
      if (finished) setState((v) => (v.prev?.id === prevId ? { ...v, prev: null } : v));
    });
    return () => anim.stop();
  }, [prevId, fade]);
  return { prev: state.prev, fade };
}

const Gradient = memo(function Gradient({ themeKey }: { themeKey: ThemeKey }) {
  const stops = APP_PALETTES[themeKey].canvas;
  return (
    <Svg style={[StyleSheet.absoluteFill, { backgroundColor: stops[1] }]} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={`canvas-${themeKey}`} cx="0.15" cy="0" rx="1.2" ry="0.8" fx="0.15" fy="0" gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor={stops[0]} />
          <Stop offset="0.48" stopColor={stops[1]} />
          <Stop offset="1" stopColor={stops[2]} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#canvas-${themeKey})`} />
    </Svg>
  );
});

/** The calm page background (opaque). Older theme layers fade out on top of the new one. */
export function CanvasBackground() {
  const { playTheme } = useApp();
  const { prev, fade } = useThemeLayers(playTheme);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <StatusBar style="dark" />
      <Gradient themeKey={playTheme} />
      {prev && (
        <Animated.View key={prev.id} style={[StyleSheet.absoluteFill, { opacity: fade }]}>
          <Gradient themeKey={prev.key} />
        </Animated.View>
      )}
    </View>
  );
}

type Position = Animated.AnimatedInterpolation<number>;

/**
 * Play reports where its header ends and where the bins stand, so the scene lines up with them; the tab bar
 * shares its slide position, so Play's buildings move in step with the Play page.
 */
const Ctx = createContext<{
  setGroundY: (y: number) => void;
  setLandmarkTop: (y: number) => void;
  setTabPosition: (p: { position: Position; playIndex: number } | null) => void;
}>({ setGroundY: () => {}, setLandmarkTop: () => {}, setTabPosition: () => {} });
export const useWorld = () => useContext(Ctx);

// Same geometry as Backdrop's Layer (src/game/Backdrop.tsx), so the two skies line up exactly.
const STREET = 35, TOP_UNITS = 20, SETBACK = 48;

/**
 * Stars and snowflakes in the backdrops: small dots with opacity (the star loops in themes.ts). Matched by
 * shape, not colour, because themes.ts mutes every colour after building the picture.
 */
const STAR = /<circle cx="-?\d+" cy="-?\d+" r="(\d+(?:\.\d+)?)" fill="#[0-9a-fA-F]{6}" opacity="[\d.]+"\/>/g;

/** The backdrop's sky gradient (always its first element, see `sky()` in themes.ts) plus its stars only. */
const skyAndStars = (xml: string) => {
  const end = xml.indexOf('/>', xml.indexOf('<rect')) + 2;
  const stars = [...xml.matchAll(STAR)].filter((m) => Number(m[1]) <= 3).map((m) => m[0]).join('');
  return `${xml.slice(0, end)}${stars}</svg>`;
};

/** The neighbourhood's sky (with its stars) and ground, placed exactly like the game scene's, with no buildings. */
const SkyAndGround = memo(function SkyAndGround({ theme, groundY, top, height }: { theme: GameTheme; groundY: number; top: number; height: number }) {
  const base = groundY - SETBACK;
  const scale = Math.max(0.5, (base - top) / (300 - STREET - TOP_UNITS));
  const skyH = 300 * scale, skyTop = base + STREET * scale - skyH;
  const skyBottom = skyTop + skyH;
  const air = streetDark(theme) ? '#1E2433' : '#F3F1EA';
  const xml = useMemo(() => skyAndStars(theme.backdrop), [theme]);
  const settleH = Math.max(1, height - skyBottom + 120);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.lane }]}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, skyTop) + 2, backgroundColor: skyTopOf(theme) }} />
      <SvgXml xml={xml} width="100%" height={skyH + SKY_EXT * scale} style={{ position: 'absolute', top: skyTop - SKY_EXT * scale, left: 0 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: base + 2, backgroundColor: air, opacity: 0.16 }} />
      {/* the sky settles softly into the ground instead of ending on a line */}
      <Svg style={{ position: 'absolute', left: 0, right: 0, top: skyBottom - 120 }} width="100%" height={settleH}>
        <Defs>
          <LinearGradient id={`settle-${theme.key}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.lane} stopOpacity={0} />
            <Stop offset={String(Math.min(0.9, 120 / settleH))} stopColor={theme.lane} stopOpacity={1} />
            <Stop offset="1" stopColor={theme.lane} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#settle-${theme.key})`} />
      </Svg>
    </View>
  );
});

const Street = memo(Backdrop);

/** Wraps the tab navigator: one still background for all three tabs (an opaque page as a whole). */
export function TabsWorld({ children }: { children: ReactNode }) {
  const { playTheme } = useApp();
  const theme = THEMES[playTheme];
  const { width, height } = useWindowDimensions();
  const [groundY, setGroundY] = useState(0);
  const [landmarkTop, setLandmarkTop] = useState(150);
  const [tabs, setTabPosition] = useState<{ position: Position; playIndex: number } | null>(null);
  // The street is only seen on Play: draw it just after the page fade (350 ms), so it costs no frames during it.
  const [streetReady, setStreetReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setStreetReady(true), 450);
    return () => clearTimeout(t);
  }, []);
  const { prev, fade } = useThemeLayers(playTheme);
  // The street is heavy and only seen on Play: it takes a theme change in a later, low-priority pass.
  const streetTheme = THEMES[useDeferredValue(playTheme)];

  // Play's buildings ride with the Play page: in place at Play's index, one screen-width away otherwise.
  const i = tabs?.playIndex ?? 0;
  const translateX = tabs
    ? tabs.position.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [width, 0, -width], extrapolate: 'clamp' })
    : width;
  const g = groundY || height * 0.42;
  const value = useMemo(() => ({ setGroundY, setLandmarkTop, setTabPosition }), []);

  return (
    <Ctx.Provider value={value}>
      <View style={{ flex: 1, backgroundColor: theme.lane }}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <SkyAndGround theme={theme} groundY={g} top={landmarkTop} height={height} />
        </View>
        {prev && (
          <Animated.View key={prev.id} pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 1, opacity: fade }]}>
            <SkyAndGround theme={THEMES[prev.key]} groundY={g} top={landmarkTop} height={height} />
          </Animated.View>
        )}
        {streetReady && groundY > 0 && (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 2, transform: [{ translateX }] }]}>
            <Street theme={streetTheme} groundY={groundY} landmarkTop={landmarkTop} />
          </Animated.View>
        )}
        <StatusBar style={isDark(skyTopOf(theme)) ? 'light' : 'dark'} />
        <View style={{ flex: 1, zIndex: 3 }}>{children}</View>
      </View>
    </Ctx.Provider>
  );
}
