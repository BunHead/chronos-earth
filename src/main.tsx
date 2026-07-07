import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Note: we intentionally do NOT wrap the app in <React.StrictMode>. Strict mode
// mounts every component twice in development, which forces CesiumJS to build,
// tear down and rebuild the WebGL globe on each change — wasteful and a source
// of flicker for a heavyweight 3D component. The rest of the app is side-effect
// clean, so we lose nothing meaningful here.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

// Production only: a small service worker warm-caches the /data/ files
// (public/sw.js). The build stamp from version.json rides in the registration
// URL, so each deploy gets its own cache and stale ones are swept on activate.
// Dev/HMR is untouched, and a failed registration costs nothing — the app
// simply loads from the network as before.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<{ build?: number }>) : null))
    .then((j) => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=${j?.build ?? 0}`))
    .catch(() => {
      /* offline or blocked — the warm cache is a bonus, never a requirement */
    });
}
