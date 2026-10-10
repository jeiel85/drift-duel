// The native app has no landing page: make the game page the WebView entry point.
import { renameSync, rmSync, existsSync } from 'node:fs';

const dir = 'dist-app';
if (!existsSync(`${dir}/play.html`)) throw new Error(`${dir}/play.html missing — run the app build first`);
rmSync(`${dir}/index.html`, { force: true });
renameSync(`${dir}/play.html`, `${dir}/index.html`);
// Landing-only assets are not needed inside the APK.
for (const f of ['og.jpg', 'demo-poster.jpg']) rmSync(`${dir}/${f}`, { force: true });
console.log('dist-app/index.html is the game');
