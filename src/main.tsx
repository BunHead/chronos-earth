import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { loadRejectedModels } from './lib/review';
import { applySkin, loadSkin } from './lib/skin';
import { applyToneClass, getTone } from './lib/tone';
import { isPhone } from './lib/renderTier';

// Paint the chosen identity BEFORE anything renders. The boot splash in
// index.html is styled too, so doing this inside React would show a flash of
// the default skin first — most obvious jumping into the light Atlas skin,
// where the whole page would flare dark then white.
applySkin(loadSkin());
// Same reasoning as the skin: the reading register only changes type size, but
// doing it before first paint avoids a visible reflow of the panel text.
applyToneClass(getTone());

// A PHONE is marked on <html> for the stylesheet's touch rules, from the
// DEVICE (lib/renderTier isPhone), not the page width: the Captain's Pixel was
// in Chrome's "Desktop site" mode, where a phone lays the page out ~980 px
// wide, so every width-based phone rule was dead and everything was tiny
// (26 Sept 2026). That mode also shrinks the whole page to fit, which no
// stylesheet can undo — so it gets a one-line hint on how to switch it off.
if (isPhone()) {
  document.documentElement.dataset.phone = '';
  const shortSide = Math.min(window.screen.width, window.screen.height);
  let dismissed = false;
  try { dismissed = localStorage.getItem('chronos.desktopSiteHint') === 'off'; } catch { /* storage blocked */ }
  if (window.innerWidth > shortSide * 1.3 && !dismissed) {
    const hint = document.createElement('div');
    hint.className = 'desktop-site-hint';
    hint.setAttribute('role', 'note');
    hint.innerHTML =
      '📱 Your browser is showing the <b>desktop version</b>, so everything is tiny. ' +
      'For big buttons and text: open the browser’s <b>⋮</b> menu and untick <b>Desktop site</b>.' +
      '<button aria-label="Dismiss">×</button>';
    hint.querySelector('button')!.addEventListener('click', () => {
      hint.remove();
      try { localStorage.setItem('chronos.desktopSiteHint', 'off'); } catch { /* storage blocked */ }
    });
    document.body.appendChild(hint);
  }
}

// Note: we intentionally do NOT wrap the app in <React.StrictMode>. Strict mode
// mounts every component twice in development, which forces CesiumJS to build,
// tear down and rebuild the WebGL globe on each change — wasteful and a source
// of flicker for a heavyweight 3D component. The rest of the app is side-effect
// clean, so we lose nothing meaningful here.
// Resolve review decisions before the app becomes interactive. That makes a
// Reject deterministic: there is no brief startup window in which a rejected
// model can still be opened before its photo fallback is registered.
void loadRejectedModels().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
});

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
