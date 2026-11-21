/**
 * Supabase client (accounts, saved scans, scores, friends). Schema: supabase/migrations/.
 * The publishable key is meant to ship in the app: row-level security in the database is what
 * protects each user's rows. Never put a secret / service-role key here.
 * Without EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY this is null and the app runs in demo mode.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const supabase = url && key
  ? createClient(url, key, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
  : null;

// React Native has no visibility events, so refresh the session token only while the app is in front.
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
