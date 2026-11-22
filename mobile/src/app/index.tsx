/**
 * Sign in & Sign up (ui-references/.../frosted_mint_sign_in_sign_up).
 * Uses Supabase email/password accounts when configured; otherwise any input enters the demo.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BrandMark, Glass, Icon, PrimaryButton, Screen, Segmented, Spring, T } from '../components/ui';
import { useApp } from '../state/AppState';
import { colors, fonts, radius } from '../theme';
import { brand } from '../brand';

type Mode = 'signin' | 'signup';

/** Close the keyboard and wait until it's gone (max 350 ms), so the layout doesn't jump during the page fade. */
function hideKeyboard() {
  if (!Keyboard.isVisible()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const sub = Keyboard.addListener('keyboardDidHide', () => { sub.remove(); resolve(); });
    setTimeout(() => { sub.remove(); resolve(); }, 350);
    Keyboard.dismiss();
  });
}

function Field({ label, ...input }: React.ComponentProps<typeof TextInput> & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <T size="xs" weight="semibold" style={{ paddingLeft: 4 }}>{label}</T>
      <TextInput
        {...input}
        placeholderTextColor={colors.inkMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && { borderColor: colors.forest }]}
      />
    </View>
  );
}

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signUp } = useApp();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = async () => {
    setBusy(true);
    setError(null);
    const err = mode === 'signup' ? await signUp(name, email, password) : await signIn(email, password);
    setBusy(false);
    if (err) setError(err);
    else {
      // Only on success: after a wrong password the keyboard stays open for retyping.
      await hideKeyboard();
      router.replace('/scan');
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <BrandMark size={64} />
            <View style={{ alignItems: 'center' }}>
              <T size="4xl" display color={colors.ink} style={{ lineHeight: 45 }}>{brand.appName}</T>
              <T size="sm" color={colors.inkMuted} style={{ marginTop: 4 }}>{brand.tagline}</T>
            </View>
          </View>

          <Glass style={styles.card}>
            <Segmented
              options={[{ key: 'signin', label: 'Sign in' }, { key: 'signup', label: 'Sign up' }]}
              value={mode}
              onChange={setMode}
            />
            <View style={{ gap: 12 }}>
              {mode === 'signup' && (
                <Field label="Username" placeholder="EcoSorter" value={name} onChangeText={setName} autoCapitalize="none" />
              )}
              <Field label="Email" placeholder="ecosorter@montreal.ca" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              <Field label="Password" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />
              <PrimaryButton label={mode === 'signin' ? 'Sign in' : 'Create account'} onPress={enter} disabled={busy} style={{ marginTop: 8 }} />
              {!!error && <T size="xs" accessibilityRole="alert" style={{ paddingLeft: 4 }}>{error}</T>}
            </View>
          </Glass>

          <Spring onPress={() => hideKeyboard().then(() => router.replace('/scan'))} style={styles.demo} accessibilityRole="link">
            <T size="sm" weight="semibold" color={colors.ink}>Continue demo without account</T>
            <Icon name="arrow-forward" size={18} color={colors.ink} />
          </Spring>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40, gap: 24 },
  brand: { alignItems: 'center', gap: 12 },
  card: { borderRadius: radius['3xl'], padding: 20, gap: 16 },
  input: {
    minHeight: 48,
    borderRadius: radius['2xl'],
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: colors.white,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.ink,
  },
  demo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center' },
});
