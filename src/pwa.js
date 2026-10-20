import { isNative } from './game/device.js';

// Offline/installable support for the GitHub Pages build only. __PWA_SW__ is false in
// the dev server, the native app build (--mode app) and the itch.io build (--mode itch);
// the native check guards against a web bundle ever being loaded inside Capacitor.
export function registerServiceWorker() {
  if (!__PWA_SW__ || isNative() || !('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
