/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

// `base: './'` makes all asset paths relative, which is what free hosts like
// GitHub Pages need when the site lives in a subfolder.
export default defineConfig({
  base: './',
  plugins: [react(), cesium()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
