/**
 * Photo library picker shared by Scan and Camera ("Choose photos", up to 3 per scan).
 */
import * as ImagePicker from 'expo-image-picker';

export const MAX_PHOTOS = 3;

/** Returns the picked photo URIs, or [] if the user cancelled. */
export async function pickPhotos(limit = MAX_PHOTOS): Promise<string[]> {
  if (limit <= 0) return [];
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
  });
  if (res.canceled) return [];
  return res.assets.slice(0, limit).map((a) => a.uri);
}
