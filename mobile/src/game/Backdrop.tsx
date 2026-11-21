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
import { SvgXml } from 'react-native-svg';

import { type GameTheme, skyTopOf } from './themes';

/** The bottom 35 of each backdrop's 300 viewBox units is street level, drawn behind the bins.
 *  Landmarks start near the top of the viewBox (y≈20); LANDMARK_TOP keeps them below the title row
 *  instead of under the status bar, and the space above is filled with the theme's own sky. */
const STREET = 35, TOP_UNITS = 20, LANDMARK_TOP = 110;

function Layer({ theme, groundY, height }: { theme: GameTheme; groundY: number; height: number }) {
  const scale = Math.max(0.6, (groundY - LANDMARK_TOP) / (300 - STREET - TOP_UNITS));
  const skyH = 300 * scale, skyTop = groundY + STREET * scale - skyH;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.lane }]}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, skyTop) + 2, backgroundColor: skyTopOf(theme) }} />
      <SvgXml xml={theme.backdrop} width="100%" height={skyH} style={{ position: 'absolute', top: skyTop, left: 0 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: groundY + 8, height: Math.max(0, height - groundY), backgroundColor: theme.lane }} />
      <SvgXml
        xml={`<svg viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M-10 10Q50 -4 110 10z" fill="${theme.snow}"/><path d="M-10 10Q50 2 110 10z" fill="${theme.snowShade}"/></svg>`}
        width="130%"
        height={34}
        style={{ position: 'absolute', left: '-15%', top: groundY - 18 }}
      />
    </View>
  );
}

export function Backdrop({ theme, groundY }: { theme: GameTheme; groundY: number }) {
  const { height } = useWindowDimensions();
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
        if (!top) return <Layer key={l.id} theme={l.theme} groundY={g} height={height} />;
        const up = fill.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
        const down = fill.interpolate({ inputRange: [0, 1], outputRange: [-height, 0] });
        return (
          <Animated.View key={l.id} style={[StyleSheet.absoluteFill, { overflow: 'hidden', transform: [{ translateY: up }] }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: down }] }]}>
              <Layer theme={l.theme} groundY={g} height={height} />
            </Animated.View>
            {/* the rising edge: a soft band of the new theme's snow, so the fill reads as a surface */}
            <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 6, backgroundColor: l.theme.snow, opacity: fill.interpolate({ inputRange: [0, 0.9, 1], outputRange: [0.9, 0.9, 0] }) }} />
          </Animated.View>
        );
      })}
    </View>
  );
}
