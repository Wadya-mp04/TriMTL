/**
 * Full-screen neighbourhood behind the Play screen. The landmarks sit above the bins and the
 * sidewalk runs to the bottom of the screen; `groundY` (px from the top of the screen) is where
 * the bins' wheels touch down, reported by SortGame so the street lines up with them.
 *
 * Changing theme fills the new neighbourhood in from the ground up, like a glass filling: the
 * new layer's container slides up while its contents counter-slide down, which wipes it in
 * without masks and runs entirely on the native driver.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, LinearGradient, Rect, Stop, SvgXml } from 'react-native-svg';

import { type GameTheme, isDark, SKY_EXT, skyTopOf, streetDark } from './themes';

/** The bottom 35 of each backdrop's 300 viewBox units is street level, drawn behind the bins.
 *  Landmarks start near the top of the viewBox (y≈20); `landmarkTop` keeps them below the header
 *  instead of under the status bar, and the space above is filled with the theme's own sky. */
const STREET = 35, TOP_UNITS = 20;

/** The runway in front of the bins: plain sidewalk, hazier toward the street. */
function sidewalk(theme: GameTheme, w: number, h: number) {
  let s = `<defs><linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${theme.snow}" stop-opacity=".45"/><stop offset=".45" stop-color="${theme.snow}" stop-opacity="0"/></linearGradient></defs>`;
  s += `<rect width="${w}" height="${h}" fill="url(#haze)"/>`;
  return `<svg viewBox="0 0 ${w} ${h}">${s}</svg>`;
}

/** Mix two #rrggbb colours; t is the share of `b`. */
const mix = (a: string, b: string, t: number) =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');

/** The street between the buildings and the bins: far curb, road with a worn centre line, near curb. */
function street(theme: GameTheme, w: number, h: number) {
  const dark = streetDark(theme);
  const road = mix(theme.lane, dark ? '#000000' : '#2E3438', dark ? 0.25 : 0.2);
  const line = dark ? '#C9B26A' : '#E6D9A8';
  let s = `<rect width="${w}" height="${h}" fill="${road}"/>`;
  s += `<rect width="${w}" height="3" fill="${mix(theme.lane, '#000000', 0.12)}"/>`;
  for (let x = -10; x < w; x += 46) s += `<rect x="${x}" y="${(h * 0.42).toFixed(1)}" width="24" height="2.5" rx="1.2" fill="${line}" opacity=".7"/>`;
  s += `<rect y="${h * 0.42 - 10}" width="${w}" height="3" fill="${theme.snow}" opacity=".18"/>`;
  return `<svg viewBox="0 0 ${w} ${h}">${s}</svg>`;
}

/** How far behind the bins the buildings stand: a street's width, in px. */
const SETBACK = 48;

function Layer({ theme, groundY, height, width, top }: { theme: GameTheme; groundY: number; height: number; width: number; top: number }) {
  const base = groundY - SETBACK; // where the buildings meet their own sidewalk
  const scale = Math.max(0.5, (base - top) / (300 - STREET - TOP_UNITS));
  const skyH = 300 * scale, skyTop = base + STREET * scale - skyH;
  const air = streetDark(theme) ? '#1E2433' : '#F3F1EA';
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.lane }]}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, skyTop) + 2, backgroundColor: skyTopOf(theme) }} />
      {/* the backdrop carries its own sky SKY_EXT units above the scene, so it runs up behind the header */}
      <SvgXml xml={theme.backdrop} width="100%" height={skyH + SKY_EXT * scale} style={{ position: 'absolute', top: skyTop - SKY_EXT * scale, left: 0 }} />
      {/* distance haze: the buildings sit back across the street */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: base + 2, backgroundColor: air, opacity: 0.16 }} />
      <SvgXml xml={street(theme, width, SETBACK + 10)} width={width} height={SETBACK + 10} style={{ position: 'absolute', left: 0, top: base }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: groundY + 8, height: Math.max(0, height - groundY), backgroundColor: theme.lane }} />
      <SvgXml xml={sidewalk(theme, width, Math.max(1, height - groundY))} width={width} height={Math.max(1, height - groundY)} style={{ position: 'absolute', left: 0, top: groundY + 6 }} />
      <SvgXml
        xml={`<svg viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M-10 10Q50 -4 110 10z" fill="${theme.snow}"/><path d="M-10 10Q50 2 110 10z" fill="${theme.snowShade}"/></svg>`}
        width="130%"
        height={34}
        style={{ position: 'absolute', left: '-15%', top: groundY - 18 }}
      />
    </View>
  );
}

/** `landmarkTop`: px from the top of the screen where buildings may start (below the screen's header). */
export function Backdrop({ theme, groundY, landmarkTop = 110 }: { theme: GameTheme; groundY: number; landmarkTop?: number }) {
  const { height, width } = useWindowDimensions();
  const [layers, setLayers] = useState<{ id: number; theme: GameTheme }[]>([]);
  const fill = useRef(new Animated.Value(1)).current;
  const next = useRef(0);

  useEffect(() => {
    let alive = true;
    const id = ++next.current;
    setLayers((v) => [...v.slice(-1), { id, theme }]);
    fill.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!alive) return;
      Animated.timing(fill, { toValue: 1, duration: reduced ? 1 : 900, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start(() => {
        if (alive) setLayers((v) => v.filter((l) => l.id === id));
      });
    });
    return () => { alive = false; };
  }, [theme, fill]);

  const g = groundY || height * 0.42;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {layers.map((l, i) => {
        const top = i === layers.length - 1;
        if (!top) return <Layer key={l.id} theme={l.theme} groundY={g} height={height} width={width} top={landmarkTop} />;
        const up = fill.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
        const down = fill.interpolate({ inputRange: [0, 1], outputRange: [-height, 0] });
        return (
          <Animated.View key={l.id} style={[StyleSheet.absoluteFill, { overflow: 'hidden', transform: [{ translateY: up }] }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: down }] }]}>
              <Layer theme={l.theme} groundY={g} height={height} width={width} top={landmarkTop} />
            </Animated.View>
            {/* the rising edge: a soft band of the new theme's snow, so the fill reads as a surface */}
            <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 6, backgroundColor: l.theme.snow, opacity: fill.interpolate({ inputRange: [0, 0.9, 1], outputRange: [0.9, 0.9, 0] }) }} />
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Scan and Community: the Play scene's sky image (stars, snow, beams) behind the header, fading into Play's ground. */
export function SkyBackdrop({ theme }: { theme: GameTheme }) {
  const { width, height } = useWindowDimensions();
  const skyH = Math.round(height * 0.5);
  const xml = theme.backdrop.replace(/viewBox="[^"]*"/, `viewBox="0 -${SKY_EXT} 480 ${SKY_EXT}"`);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.lane }]}>
      <StatusBar style={isDark(skyTopOf(theme)) ? 'light' : 'dark'} />
      <SvgXml xml={xml} width={width} height={skyH} />
      <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={width} height={skyH + 2}>
        <Defs>
          <LinearGradient id="skyfade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.4" stopColor={theme.lane} stopOpacity={0} />
            <Stop offset="1" stopColor={theme.lane} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={skyH + 2} fill="url(#skyfade)" />
      </Svg>
    </View>
  );
}
