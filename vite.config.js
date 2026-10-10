import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Relative base so the build works under https://<user>.github.io/drift-duel/
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // three.js alone is ~550 kB minified (~145 kB gzip) and is split into its own chunk.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        play: resolve(import.meta.dirname, 'play.html'),
      },
      output: {
        // Separate, rarely-changing vendor chunk: a game update re-downloads only the
        // small game chunk while browsers keep the cached three.js file.
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
  test: {
    include: ['test/**/*.test.js'],
  },
});
