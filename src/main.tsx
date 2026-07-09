import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {UPDATE_CHECK_KEY} from './lib/pwa';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    // Offline-first with a once-a-day online check (#28). The service worker
    // serves the whole app from cache, so the only thing that ever pulls from
    // the network is the update check the browser runs when we (re-)register.
    // We throttle that to at most once every 24h via localStorage, so opening,
    // closing and reopening the app within a day never hits the network. The
    // settings page offers a manual "check now" that bypasses this throttle.
    const DAY_MS = 24 * 60 * 60 * 1000;
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    const registerSW = () => {
      let last = 0;
      try {
        last = Number(localStorage.getItem(UPDATE_CHECK_KEY)) || 0;
      } catch {
        // Private mode / storage disabled — treat as "never checked".
      }
      const due = Date.now() - last > DAY_MS;

      navigator.serviceWorker.getRegistration().then((existing) => {
        if (existing && !due) {
          // Already installed and checked within the last day — stay fully
          // offline and don't reach out to the network for an update.
          console.log('[SW] Update check skipped (checked within 24h).');
          return;
        }
        navigator.serviceWorker.register(swUrl)
          .then((reg) => {
            try {
              localStorage.setItem(UPDATE_CHECK_KEY, String(Date.now()));
            } catch {
              // Ignore storage failures; worst case is a check on the next load.
            }
            console.log('[SW] Registered / update-checked with scope:', reg.scope);
          })
          .catch((err) => {
            console.error('[SW] Registration failed:', err);
          });
      });
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }
  } else {
    // Unregister active service workers in dev mode to prevent caching conflicts
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) {
            console.log('[Dev SW Cleanup] Unregistered service worker to avoid caching conflicts.');
            window.location.reload();
          }
        });
      }
    });
  }
}

