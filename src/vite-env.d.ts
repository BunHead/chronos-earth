/// <reference types="vite/client" />

// Build stamp baked in by vite `define` (from public/version.json) so the
// running code knows its own version and can detect when it has gone stale.
declare const __BUILD_ID__: number;
declare const __BUILD_LABEL__: string;
