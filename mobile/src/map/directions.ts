/**
 * Directions in the maps app the person prefers. The first tap asks (Apple Maps, Google Maps or Waze) and
 * the choice is remembered on the device; "Use another app" asks again. Google Maps and Waze use their
 * universal links, so they open the app when it is installed and the website when it is not, with no
 * Info.plist changes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { translate } from '../i18n';
import { Alert, Linking, Platform } from 'react-native';

export type MapsApp = 'apple' | 'google' | 'waze';
type Place = { lat: number; lng: number; name: string };

const KEY = 'map.directionsApp';
export const MAPS_APPS: { key: MapsApp; label: string }[] = [
  ...(Platform.OS === 'ios' ? [{ key: 'apple' as const, label: 'Apple Maps' }] : []),
  { key: 'google', label: 'Google Maps' },
  { key: 'waze', label: 'Waze' },
];

export function directionsUrl(app: MapsApp, p: Place) {
  const at = `${p.lat},${p.lng}`;
  if (app === 'apple') return `https://maps.apple.com/?daddr=${at}&q=${encodeURIComponent(p.name)}`;
  if (app === 'waze') return `https://waze.com/ul?ll=${at}&navigate=yes`;
  return `https://www.google.com/maps/dir/?api=1&destination=${at}`;
}

let saved: MapsApp | null = null;
const listeners = new Set<(a: MapsApp | null) => void>();
AsyncStorage.getItem(KEY).then((v) => {
  if (v === 'apple' || v === 'google' || v === 'waze') { saved = v; listeners.forEach((l) => l(saved)); }
}).catch(() => {});

/** The remembered app, or null before the first choice. */
export function useMapsApp() {
  const [app, setApp] = useState(saved);
  useEffect(() => { listeners.add(setApp); return () => { listeners.delete(setApp); }; }, []);
  return app;
}

function remember(app: MapsApp) {
  saved = app;
  listeners.forEach((l) => l(app));
  AsyncStorage.setItem(KEY, app).catch(() => {});
}

const open = (app: MapsApp, p: Place) =>
  Linking.openURL(directionsUrl(app, p)).catch(() => Linking.openURL(directionsUrl('google', p)));

/** Ask which app to use, remember it, and open directions there. */
export function chooseAndGo(p: Place, lang: 'en' | 'fr' = 'en') {
  Alert.alert(translate(lang, 'Get directions with'), undefined, [
    ...MAPS_APPS.map((a) => ({ text: a.label, onPress: () => { remember(a.key); open(a.key, p); } })),
    { text: translate(lang, 'Cancel'), style: 'cancel' as const },
  ]);
}

/** Directions in the remembered app, or ask first. */
export function goTo(p: Place, lang: 'en' | 'fr' = 'en') {
  if (saved) open(saved, p);
  else chooseAndGo(p, lang);
}

export const appLabel = (app: MapsApp) => MAPS_APPS.find((a) => a.key === app)?.label ?? 'Maps';
