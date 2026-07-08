/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

// `base: './'` makes all asset paths relative, which is what free hosts like
// GitHub Pages need when the site lives in a subfolder.
export default defineConfig({
  base: './',
  plugins: [react(), cesium()],
  build: {
    rollupOptions: {
      // Ship the app plus the standalone Model Workshop (workshop.html) — a
      // no-command-line previewer for every 3D archetype.
      input: { main: 'index.html', workshop: 'workshop.html' },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
