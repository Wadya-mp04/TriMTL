/**
 * Root layout: loads the fonts, provides app state and declares the stack. Every page is opaque (its own
 * background, see components/World), so the native fade crossfades whole pages cleanly.
 */
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { View } from 'react-native';

import { AppProvider } from '../state/AppState';
import { colors } from '../theme';

/** Navigators paint `colors.background` behind screens; transparent lets the shared world show through. */
const NAV_THEME = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } };

export default function RootLayout() {
  const [loaded] = useFonts({
    InstrumentSerif_400Regular,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    ...MaterialIcons.font,
  });

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.mintCanvas }} />;

  return (
    <AppProvider>
      <ThemeProvider value={NAV_THEME}>
        <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          {/* The camera is its own full-screen black view, so it slides up instead of fading. */}
          <Stack.Screen name="camera" options={{ animation: 'slide_from_bottom', contentStyle: { backgroundColor: '#000' } }} />
          <Stack.Screen name="analyzing" options={{ gestureEnabled: false }} />
          <Stack.Screen name="results" />
          {/* Pages opened from a tab slide in from the right, the same sideways motion as the tabs. */}
          <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="library" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="friends" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </ThemeProvider>
    </AppProvider>
  );
}
