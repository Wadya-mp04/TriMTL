/**
 * Reduce Motion, read once and kept current, so starting an animation never waits on an async lookup.
 */
import { AccessibilityInfo } from 'react-native';

let reduced = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduced = v; }, () => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduced = v; });

/** Animation duration, or ~instant when the user has asked for reduced motion. */
export const motionMs = (ms: number) => (reduced ? 1 : ms);
