import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Relative base so the build works under https://<user>.github.io/drift-duel/
export default defineConfig({
  base: './',
  build: {
    // three.js alone is ~550 kB minified (~150 kB gzip); one game chunk is expected.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        play: resolve(import.meta.dirname, 'play.html'),
      },
    },
  },
  test: {
    include: ['test/**/*.test.js'],
  },
});
