// Builds without the landing page (the native app, the itch.io upload): make the
// game page the entry point. Usage: node scripts/app-index.mjs [outDir=dist-app]
import { renameSync, rmSync, existsSync } from 'node:fs';

const dir = process.argv[2] ?? 'dist-app';
if (!existsSync(`${dir}/play.html`)) throw new Error(`${dir}/play.html missing — run the build first`);
rmSync(`${dir}/index.html`, { force: true });
renameSync(`${dir}/play.html`, `${dir}/index.html`);
// Landing-only assets are not needed without the landing page.
for (const f of ['og.jpg', 'demo-poster.jpg']) rmSync(`${dir}/${f}`, { force: true });
console.log(`${dir}/index.html is the game`);
