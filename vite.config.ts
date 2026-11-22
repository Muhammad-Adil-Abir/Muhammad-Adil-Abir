import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * AETHER_BASE is the public path the site is served from.
 *  - "/" for https://<user>.github.io (a repo named <user>.github.io) or local dev
 *  - "/<repo>/" for a project page such as https://<user>.github.io/<repo>/
 * The GitHub Pages workflow computes it automatically from the repository name.
 */
const base = process.env.AETHER_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
    // three.js lives in lazily loaded scene chunks; the warning threshold reflects that.
    chunkSizeWarningLimit: 800,
  },
  server: { host: true },
  preview: { host: true },
});
