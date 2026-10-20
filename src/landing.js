import { registerServiceWorker } from './pwa.js';

// Phones get a light poster that opens the full-screen game (a tiny iframe is
// awkward to play and fights page scrolling). Desktop swaps in the live game.
const screen = document.querySelector('#demo-screen');
const desktop = window.matchMedia('(pointer: fine) and (min-width: 900px)');

function loadLiveDemo() {
  const frame = document.createElement('iframe');
  frame.src = './play.html?embed=1';
  frame.title = 'Drift Duel 라이브 데모';
  frame.allow = 'autoplay; fullscreen; gamepad';
  const holder = document.createElement('div');
  holder.className = 'screen';
  holder.append(frame);
  screen.replaceWith(holder);
}
if (desktop.matches) loadLiveDemo();

// Sticky "play" bar on phones once the hero buttons scroll out of view.
const sticky = document.querySelector('#sticky-cta');
const heroActions = document.querySelector('#hero-actions');
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    sticky.classList.toggle('show', show);
    sticky.setAttribute('aria-hidden', String(!show));
    sticky.tabIndex = show ? 0 : -1;
  }).observe(heroActions);
}

// "Add to home screen" where the browser supports an install prompt (Android Chrome).
const installBtn = document.querySelector('#btn-install');
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});
window.addEventListener('appinstalled', () => (installBtn.hidden = true));

registerServiceWorker();
