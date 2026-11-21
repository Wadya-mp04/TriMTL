/**
 * Camera capture (ui-references/.../frosted_mint_camera_capture). 1–3 photos, then Analyze.
 */
import { CameraView, FlashMode, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import {
  CircleButton,
  CornerBrackets,
  Glass,
  Icon,
  IconBubble,
  Pill,
  PrimaryButton,
  Screen,
  Spring,
  T,
} from '../components/ui';
import { MAX_PHOTOS, pickPhotos } from '../lib/photos';
import { useApp } from '../state/AppState';
import { colors, radius, shadow } from '../theme';

const FLASH_ORDER: FlashMode[] = ['auto', 'on', 'off'];
const FLASH_ICON: Record<FlashMode, string> = { auto: 'flash-auto', on: 'flash-on', off: 'flash-off', screen: 'flash-on' };

export default function CameraScreen() {
  const router = useRouter();
  const { setPhotos } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState<string[]>([]);
  const [flash, setFlash] = useState<FlashMode>('auto');

  const granted = permission?.granted ?? false;
  const full = shots.length >= MAX_PHOTOS;

  const snap = async () => {
    if (!cam.current || !ready || busy || full) return;
    setBusy(true);
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.8, skipProcessing: false });
      if (pic?.uri) setShots((s) => [...s, pic.uri].slice(0, MAX_PHOTOS));
    } finally {
      setBusy(false);
    }
  };

  const fromLibrary = async () => {
    const uris = await pickPhotos(MAX_PHOTOS - shots.length);
    if (uris.length) setShots((s) => [...s, ...uris].slice(0, MAX_PHOTOS));
  };

  const analyze = () => {
    if (!shots.length) return;
    setPhotos(shots);
    router.replace('/analyzing');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <CircleButton icon="close" label="Close camera" onPress={() => router.back()} />
        <Pill>
          <T size="xs" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>
            {shots.length === 0 ? `0 of ${MAX_PHOTOS} photos` : `${shots.length} of ${MAX_PHOTOS} photos`}
          </T>
        </Pill>
        <CircleButton
          icon={FLASH_ICON[flash]}
          label={`Flash ${flash}`}
          onPress={() => setFlash(FLASH_ORDER[(FLASH_ORDER.indexOf(flash) + 1) % FLASH_ORDER.length])}
        />
      </View>

      <View style={styles.main}>
        <View style={styles.finder}>
          {granted && (
            <CameraView
              ref={cam}
              style={StyleSheet.absoluteFill}
              facing="back"
              flash={flash}
              onCameraReady={() => setReady(true)}
            />
          )}
          <CornerBrackets inset={20} size={24} color={granted ? colors.white : colors.forest} />
          {!granted ? (
            <View style={{ alignItems: 'center' }}>
              <IconBubble icon="center-focus-strong" />
              <T size="2xl" display style={{ marginTop: 12 }}>Frame up to 5 items</T>
              <T size="xs" color={colors.inkMuted} style={{ marginTop: 4, textAlign: 'center' }}>
                {permission && !permission.canAskAgain
                  ? 'Camera access is off. Enable it in Settings, or pick photos from your library.'
                  : 'TriMTL needs your camera to snap your items.'}
              </T>
              {permission?.canAskAgain !== false && (
                <PrimaryButton label="Allow camera" size="sm" onPress={requestPermission} style={{ marginTop: 16, width: 'auto', paddingHorizontal: 24 }} />
              )}
            </View>
          ) : (
            shots.length === 0 && (
              <View style={styles.hint}>
                <T size="xs" weight="semibold" color={colors.white}>Frame up to 5 items, then tap the shutter</T>
              </View>
            )
          )}
        </View>

        <View accessibilityLabel="Captured photos" style={styles.strip}>
          {Array.from({ length: MAX_PHOTOS }).map((_, i) =>
            shots[i] ? (
              <Spring
                key={i}
                accessibilityLabel={`Remove photo ${i + 1}`}
                onPress={() => setShots((s) => s.filter((_, j) => j !== i))}
                style={[styles.thumb, styles.thumbFilled, shadow.sm]}
              >
                <Image source={{ uri: shots[i] }} style={StyleSheet.absoluteFill} />
              </Spring>
            ) : (
              <Glass key={i} style={styles.thumb}>
                <Icon name="add" size={20} color={colors.inkMuted} />
              </Glass>
            ),
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Spring onPress={fromLibrary} disabled={full} accessibilityLabel="Open photo library" pressedScale={0.95} style={[styles.library, { opacity: full ? 0.5 : 1 }]}>
          <Icon name="photo-library" size={22} />
        </Spring>

        <Spring
          onPress={snap}
          disabled={!granted || full}
          accessibilityLabel="Take photo"
          pressedScale={0.9}
          style={[styles.shutter, shadow.lg, { opacity: !granted || full ? 0.5 : 1 }]}
        >
          <View style={styles.shutterInner} />
        </Spring>

        <PrimaryButton
          label="Analyze"
          iconRight="arrow-forward"
          size="md"
          disabled={!shots.length}
          onPress={analyze}
          style={{ width: 'auto', paddingHorizontal: 20, gap: 6 }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  main: { flex: 1, paddingHorizontal: 20, justifyContent: 'center', gap: 20 },
  finder: {
    flex: 1,
    maxHeight: 520,
    minHeight: 300,
    borderRadius: radius['3xl'],
    backgroundColor: 'rgba(18,54,41,0.1)',
    borderWidth: 2,
    borderColor: colors.white,
    boxShadow: 'inset 0px 2px 4px rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    overflow: 'hidden',
  },
  hint: { position: 'absolute', bottom: 56, backgroundColor: 'rgba(18,41,31,0.55)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full },
  strip: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: radius['2xl'], alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbFilled: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.forest },
  footer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  library: {
    width: 48,
    height: 48,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.88)',
  },
  shutter: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.white, borderWidth: 4, borderColor: colors.forest, padding: 4 },
  shutterInner: { flex: 1, borderRadius: 40, backgroundColor: colors.forest },
});
