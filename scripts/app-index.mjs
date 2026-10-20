// Builds without the landing page (the native app, the itch.io upload): make the
// game page the entry point. Usage: node scripts/app-index.mjs [outDir=dist-app]
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

const dir = process.argv[2] ?? 'dist-app';
if (!existsSync(`${dir}/play.html`)) throw new Error(`${dir}/play.html missing — run the build first`);
rmSync(`${dir}/index.html`, { force: true });
renameSync(`${dir}/play.html`, `${dir}/index.html`);
// The web manifest starts at play.html, which no longer exists here.
const manifestPath = `${dir}/manifest.webmanifest`;
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.start_url = './index.html';
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
// Landing-only assets are not needed without the landing page, and the offline
// service worker is only registered by the GitHub Pages build.
for (const f of ['og.jpg', 'demo-poster.jpg', 'sw.js']) rmSync(`${dir}/${f}`, { force: true });
console.log(`${dir}/index.html is the game`);
