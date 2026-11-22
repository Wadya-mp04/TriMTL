/**
 * Full-screen camera: the preview fills the screen, controls float on top. 1–3 photos, then Analyze.
 */
import { CameraView, FlashMode, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconBubble, PrimaryButton, Screen, SecondaryButton, Spring, T } from '../components/ui';
import { MAX_PHOTOS, pickPhotos } from '../lib/photos';
import { useApp } from '../state/AppState';
import { colors, radius } from '../theme';
import { brand } from '../brand';

const FLASH_ORDER: FlashMode[] = ['auto', 'on', 'off'];
const FLASH_ICON: Record<FlashMode, string> = { auto: 'flash-auto', on: 'flash-on', off: 'flash-off', screen: 'flash-on' };
/** Dark frosted glass so white icons stay readable over any camera image. */
const SCRIM = 'rgba(18, 41, 31, 0.45)';

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setPhotos } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  // Photos already taken or picked on the Scan tab (JSON array of URIs).
  const { first } = useLocalSearchParams<{ first?: string }>();
  const [shots, setShots] = useState<string[]>(() => {
    try { return first ? (JSON.parse(first) as string[]).slice(0, MAX_PHOTOS) : []; } catch { return []; }
  });
  const [flash, setFlash] = useState<FlashMode>('auto');
  const blink = useRef(new Animated.Value(0)).current;

  const full = shots.length >= MAX_PHOTOS;
  const add = (uris: string[]) => setShots((s) => [...s, ...uris].slice(0, MAX_PHOTOS));

  const snap = async () => {
    if (!cam.current || !ready || busy || full) return;
    setBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    blink.setValue(1);
    Animated.timing(blink, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.8 });
      if (pic?.uri) add([pic.uri]);
    } finally {
      setBusy(false);
    }
  };

  const fromLibrary = async () => add(await pickPhotos(MAX_PHOTOS - shots.length));

  const analyze = () => {
    void Haptics.selectionAsync();
    setPhotos(shots);
    router.replace('/analyzing');
  };

  if (!permission) return <View style={styles.black} />;

  if (!permission.granted) {
    return (
      <Screen style={styles.ask}>
        <IconBubble icon="photo-camera" />
        <T size="2xl" display color={colors.ink} style={{ marginTop: 16, textAlign: 'center' }}>Allow the camera</T>
        <T size="sm" color={colors.inkMuted} style={{ marginTop: 6, textAlign: 'center' }}>
          {permission.canAskAgain
            ? `${brand.appName} needs your camera to photograph the items you want to sort.`
            : 'Camera access is off. Turn it on in Settings, or choose photos instead.'}
        </T>
        <View style={{ width: '100%', gap: 10, marginTop: 24 }}>
          {permission.canAskAgain && <PrimaryButton label="Allow camera" icon="photo-camera" onPress={requestPermission} />}
          <SecondaryButton
            label="Choose photos"
            icon="photo-library"
            onPress={async () => {
              const uris = await pickPhotos();
              if (uris.length) { setPhotos(uris); router.replace('/analyzing'); }
            }}
          />
          <Pressable onPress={() => router.back()} style={{ alignSelf: 'center', padding: 12 }}>
            <T size="sm" weight="semibold" color={colors.inkMuted}>Not now</T>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.black}>
      <StatusBar style="light" />
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" flash={flash} onCameraReady={() => setReady(true)} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.white, opacity: blink }]} />

      {/* Top: close · counter · flash */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Spring onPress={() => router.back()} accessibilityLabel="Close camera" pressedScale={0.92} style={styles.round}>
          <Icon name="close" size={22} color={colors.white} />
        </Spring>
        <View style={styles.pill}>
          <T size="xs" weight="semibold" color={colors.white}>
            {full ? '3 photos max · tap Analyze' : shots.length ? `${shots.length} of ${MAX_PHOTOS} photos` : 'Up to 5 items per photo'}
          </T>
        </View>
        <Spring
          onPress={() => setFlash(FLASH_ORDER[(FLASH_ORDER.indexOf(flash) + 1) % FLASH_ORDER.length])}
          accessibilityLabel={`Flash ${flash}`}
          pressedScale={0.92}
          style={styles.round}
        >
          <Icon name={FLASH_ICON[flash]} size={22} color={colors.white} />
        </Spring>
      </View>

      {/* Bottom: taken photos, then library · shutter · analyze */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        {shots.length > 0 && (
          <View style={styles.thumbs}>
            {shots.map((uri, i) => (
              <View key={uri} style={styles.thumb}>
                <Image source={{ uri }} style={StyleSheet.absoluteFill} />
                <Pressable
                  onPress={() => setShots((s) => s.filter((_, j) => j !== i))}
                  accessibilityLabel={`Remove photo ${i + 1}`}
                  hitSlop={10}
                  style={styles.remove}
                >
                  <Icon name="close" size={12} color={colors.white} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={styles.controls}>
          <View style={styles.side}>
            <Spring onPress={fromLibrary} disabled={full} accessibilityLabel="Choose from library" pressedScale={0.92} style={[styles.round, styles.big, full && { opacity: 0.4 }]}>
              <Icon name="photo-library" size={24} color={colors.white} />
            </Spring>
          </View>

          <Spring onPress={snap} disabled={full || busy} accessibilityLabel="Take photo" pressedScale={0.88} style={[styles.shutter, full && { opacity: 0.4 }]}>
            <View style={styles.shutterInner} />
          </Spring>

          <View style={[styles.side, { alignItems: 'flex-end' }]}>
            {shots.length > 0 && (
              <Spring onPress={analyze} accessibilityLabel={`Analyze ${shots.length} photos`} pressedScale={0.92} style={[styles.analyze, { backgroundColor: colors.forest }]}>
                <T size="sm" weight="semibold" color={colors.white}>Analyze</T>
                <Icon name="arrow-forward" size={18} color={colors.white} />
              </Spring>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  ask: { paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: SCRIM, alignItems: 'center', justifyContent: 'center' },
  big: { width: 52, height: 52, borderRadius: 26 },
  pill: { backgroundColor: SCRIM, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, gap: 20 },
  thumbs: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: radius.xl, borderWidth: 2, borderColor: colors.white, overflow: 'hidden', backgroundColor: SCRIM },
  remove: { position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1 },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: colors.white, padding: 4 },
  shutterInner: { flex: 1, borderRadius: 40, backgroundColor: colors.white },
  analyze: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, paddingHorizontal: 16, borderRadius: radius.full },
});
