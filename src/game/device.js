// Phone niceties: vibration, fullscreen, keeping the screen awake, and the
// Android back button when running inside the native (Capacitor) app.
// Every feature is optional; unsupported browsers simply skip it.

export const isNative = () => !!window.Capacitor?.isNativePlatform?.();

let hapticsOn = true;
export function setHaptics(on) {
  hapticsOn = on;
}

/** Short vibration (ms or pattern). No-op where the Vibration API is missing (e.g. iOS Safari). */
export function haptic(pattern) {
  if (!hapticsOn || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw before the first user gesture; vibration is cosmetic.
  }
}

/** Hide the browser chrome on phones. Must be called from a user gesture. */
export function enterFullscreen() {
  const el = document.documentElement;
  if (isNative() || document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
    // Denied (e.g. inside an iframe without allowfullscreen): keep playing windowed.
  });
}

let wakeLock = null;
/** Keep the screen from dimming during a race (Screen Wake Lock API). */
export async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null; // not allowed right now (tab hidden, battery saver); retried next race
  }
}

/**
 * Android hardware back button inside the native app. The plugin is loaded
 * lazily so the web build never pulls it in.
 */
export async function onBackButton(handler) {
  if (!isNative()) return null;
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', handler);
  return App;
}
