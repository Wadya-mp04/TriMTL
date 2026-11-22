/**
 * Frosted Mint building blocks shared by every screen.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';

import { useT } from '../i18n';
import { useApp } from '../state/AppState';
import { motionMs } from '../lib/motion';
import { CanvasBackground } from './World';
import { colors, fonts, glass, radius, shadow, text } from '../theme';

export type IconName = keyof typeof MaterialIcons.glyphMap;

export function Icon({ name, size = 20, color = colors.ink }: { name: string; size?: number; color?: string }) {
  const glyph = (name in MaterialIcons.glyphMap ? name : 'help-outline') as IconName;
  return <MaterialIcons name={glyph} size={size} color={color} />;
}

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

/** Text in Plus Jakarta Sans (or Instrument Serif with `display`). */
export function T({
  size = 'sm',
  weight = 'regular',
  display,
  color = colors.ink,
  style,
  ...rest
}: TextProps & {
  size?: keyof typeof text;
  weight?: Weight;
  display?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      {...rest}
      style={[text[size], { fontFamily: display ? fonts.display : fonts[weight], color }, style]}
    />
  );
}

/**
 * A page with safe-area padding. Opaque by default (the calm gradient), so page transitions crossfade whole
 * pages; `transparent` for the tabs, which sit on the shared tab background (components/World, TabsWorld).
 */
export function Screen({
  children,
  edges = ['top', 'bottom'],
  style,
  transparent,
}: {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  transparent?: boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      {!transparent && <CanvasBackground />}
      <SafeAreaView edges={edges} style={[{ flex: 1 }, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

/** `.apple-glass` card. */
export function Glass({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return <View style={[glass, style]}>{children}</View>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with the designs' spring press-in scale (`.apple-spring`, active:scale-[0.97]). */
export function Spring({
  style,
  children,
  pressedScale = 0.97,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children?: ReactNode; pressedScale?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => { to(pressedScale); rest.onPressIn?.(e); }}
      onPressOut={(e) => { to(1); rest.onPressOut?.(e); }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Big dark pill: "Scan items", "Sign in", "Save all". */
export function PrimaryButton({
  label,
  icon,
  iconRight,
  onPress,
  disabled,
  size = 'lg',
  style,
}: {
  label: string;
  icon?: string;
  iconRight?: string;
  onPress?: () => void;
  disabled?: boolean;
  size?: 'lg' | 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
}) {
  const h = size === 'lg' ? 56 : size === 'md' ? 48 : 44;
  const fs = size === 'lg' ? 'base' : size === 'md' ? 'sm' : 'xs';
  return (
    <Spring
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.primary, { minHeight: h, opacity: disabled ? 0.5 : 1 }, size === 'lg' ? shadow.lg : shadow.md, style]}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 22 : 18} color={colors.white} />}
      <T size={fs} weight="semibold" color={colors.white}>{label}</T>
      {iconRight && <Icon name={iconRight} size={18} color={colors.white} />}
    </Spring>
  );
}

/** White frosted pill: "Choose photos", "Play with these items". */
export function SecondaryButton({
  label,
  icon,
  onPress,
  textColor = colors.ink,
  style,
}: {
  label: string;
  icon?: string;
  onPress?: () => void;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Spring onPress={onPress} pressedScale={0.98} accessibilityRole="button" style={[styles.secondary, shadow.sm, style]}>
      {icon && <Icon name={icon} size={18} color={colors.forest} />}
      <T size="sm" weight="semibold" color={textColor}>{label}</T>
    </Spring>
  );
}

/** 44 px round glass button (close, back, settings, flash). */
export function CircleButton({ icon, onPress, label }: { icon: string; onPress?: () => void; label: string }) {
  return (
    <Spring onPress={onPress} pressedScale={0.95} accessibilityLabel={label} accessibilityRole="button" style={[glass, styles.circle]}>
      <Icon name={icon} size={20} />
    </Spring>
  );
}

/** Glass pill (counters, "5 items", "Gemini Vision"). */
export function Pill({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[glass, styles.pill, style]}>{children}</View>;
}

/** Green rounded square with the eco leaf. */
export function BrandMark({ size = 40 }: { size?: number }) {
  const big = size >= 64;
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: big ? 24 : 16, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
        big ? shadow.lg : shadow.md,
      ]}
    >
      <Icon name="eco" size={big ? 32 : 21} color={colors.white} />
    </View>
  );
}

/** Same header on every screen: a small context line above a large serif title, optional right slot. */
export function ScreenHeader({
  eyebrow,
  title,
  right,
  style,
  ink,
}: {
  eyebrow: string;
  title: string;
  /** Text colour override (default: ink title, muted eyebrow). */
  ink?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.screenHeader, style]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T size="sm" color={ink ?? colors.inkMuted} style={ink ? { opacity: 0.75 } : undefined}>{eyebrow}</T>
        <T display style={[styles.screenTitle, ink ? { color: ink } : null]}>{title}</T>
      </View>
      {right}
    </View>
  );
}

/** Round initials avatar that opens My Profile. */
export function AvatarButton() {
  const router = useRouter();
  const { initials } = useApp();
  const { t } = useT();
  return (
    <Spring
      onPress={() => router.push('/profile')}
      pressedScale={0.95}
      accessibilityRole="button"
      accessibilityLabel={t('Open My Profile')}
      style={[styles.avatar, shadow.md, { backgroundColor: colors.forest }]}
    >
      <T size="sm" weight="bold" color={colors.white}>{initials}</T>
    </Spring>
  );
}

/** Border width of both Segmented containers (`glass` and `styles.segmented`). */
const SEG_BORDER = 1;

/** Two-option pill switch (Sign in / Sign up, Boroughs / Players). The dark highlight slides to the choice. */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  compact,
  style,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const pad = compact ? 2 : 4;
  const [boxes, setBoxes] = useState<Partial<Record<K, { x: number; w: number }>>>({});
  const left = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  useEffect(() => {
    const b = boxes[value];
    if (!b) return;
    if (!placed.current) {
      // First layout: put the highlight in place without animating.
      left.setValue(b.x);
      width.setValue(b.w);
      placed.current = true;
      return;
    }
    const cfg = { duration: motionMs(280), easing: Easing.out(Easing.cubic), useNativeDriver: false };
    Animated.parallel([Animated.timing(left, { toValue: b.x, ...cfg }), Animated.timing(width, { toValue: b.w, ...cfg })]).start();
  }, [value, boxes, left, width]);

  return (
    <View style={[compact ? [glass, { padding: pad, gap: 2 }] : styles.segmented, { flexDirection: 'row', borderRadius: radius.full }, style]}>
      {boxes[value] && (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: pad, bottom: pad, left, width, borderRadius: radius.full, backgroundColor: colors.ink }, !compact && shadow.sm]}
        />
      )}
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            onLayout={(e) => {
              // onLayout x includes the pill's 1px border; an absolute child's `left` starts inside it.
              const { x: bx, width: w } = e.nativeEvent.layout;
              const x = bx - SEG_BORDER;
              setBoxes((prev) => (prev[o.key]?.x === x && prev[o.key]?.w === w ? prev : { ...prev, [o.key]: { x, w } }));
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={compact ? styles.segCompact : styles.segItem}
          >
            <T size="xs" weight="semibold" color={active ? colors.white : colors.inkMuted}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Four corner focus brackets for the viewfinders. */
export function CornerBrackets({ inset = 16, size = 20, color }: { inset?: number; size?: number; color: string }) {
  const base: ViewStyle = { position: 'absolute', width: size, height: size, borderColor: color };
  return (
    <>
      <View pointerEvents="none" style={[base, { top: inset, left: inset, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 8 }]} />
      <View pointerEvents="none" style={[base, { top: inset, right: inset, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 8 }]} />
      <View pointerEvents="none" style={[base, { bottom: inset, left: inset, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 8 }]} />
      <View pointerEvents="none" style={[base, { bottom: inset, right: inset, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 8 }]} />
    </>
  );
}

/** White circle with an icon, used at the centre of viewfinders and cards. */
export function IconBubble({ icon, size = 64, iconSize = 32, color = colors.forest }: { icon: string; size?: number; iconSize?: number; color?: string }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }, shadow.md]}>
      <Icon name={icon} size={iconSize} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  primary: {
    width: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  secondary: {
    width: '100%',
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full },
  screenHeader: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { fontSize: 34, lineHeight: 40, color: colors.ink },
  segmented: { backgroundColor: 'rgba(255,255,255,0.7)', padding: 4, gap: 4, borderWidth: 1, borderColor: colors.white },
  segItem: { flex: 1, minHeight: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  segCompact: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full },
});
