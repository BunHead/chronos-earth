/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

// vite-plugin-cesium injects `<script src="cesium/Cesium.js">` into the <head>
// as a *blocking* classic script. Cesium is ~5.8 MB (1.7 MB gzipped), so the
// browser can't paint anything — not even our boot splash — until it finishes
// downloading. Adding `defer` lets the HTML (and splash) render immediately
// while Cesium streams in the background. Deferred scripts still run in document
// order before the app module, so `window.Cesium` is ready by the time the globe
// mounts — no behaviour change, just a far earlier first paint.
function deferCesiumScript(): Plugin {
  return {
    name: 'chronos-defer-cesium-script',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /<script\s+([^>]*\bsrc="[^"]*Cesium\.js"[^>]*)><\/script>/,
        '<script defer $1></script>',
      );
    },
  };
}

// `base: './'` makes all asset paths relative, which is what free hosts like
// GitHub Pages need when the site lives in a subfolder.
export default defineConfig(({ command }) => ({
  base: './',
  plugins: [react(), cesium(), deferCesiumScript()],
  // Strip console.* and debugger statements from production builds only — dev
  // keeps them for debugging. Trims the app bundle and avoids console noise on
  // the deployed site.
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : {},
  build: {
    // Modern evergreen browsers only (the app needs WebGL2 for the globe
    // anyway), so skip legacy transpilation for smaller, faster output.
    target: 'es2020',
    // The lazily-loaded three.js and separately-served Cesium bundles are meant
    // to be large; raise the limit so the build log isn't cluttered with
    // warnings about chunks we already load on demand.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      // Ship the app plus the standalone Model Workshop (workshop.html) — a
      // no-command-line previewer for every 3D archetype.
      input: { main: 'index.html', workshop: 'workshop.html' },
      output: {
        // Split React (+ its scheduler) into its own long-lived vendor chunk.
        // It rarely changes between deploys, so returning visitors keep it
        // cached while the app chunk updates — and it downloads in parallel with
        // the app code on a first visit.
        manualChunks(id) {
          if (/node_modules[\\/](react-dom|react|scheduler)[\\/]/.test(id)) {
            return 'react-vendor';
          }
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
}));
