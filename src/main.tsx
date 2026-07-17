import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    // #61: only register() on first install (needs network). After that the
    // app stays fully offline; updates are manual via Settings.
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    // Reload on update activation. Skip the first-install controllerchange
    // (no prior controller) since that's not an update.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || !hadController) return;
      reloaded = true;
      window.location.reload();
    });

    const registerSW = () => {
      navigator.serviceWorker.getRegistration().then((existing) => {
        if (existing) {
          // Already installed — stay offline; updates go through checkForUpdate().
          return;
        }
        navigator.serviceWorker.register(swUrl)
          .then((reg) => {
            console.log('[SW] Registered with scope:', reg.scope);
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
      if (registrations.length === 0) return;

      const reloadKey = 'sw-dev-cleanup-reload';
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      if (lastReload && now - Number(lastReload) < 5000) {
        console.warn('[Dev SW Cleanup] Detected potential reload loop. Skipping automatic reload.');
        return;
      }

      const promises = registrations.map((registration) =>
        registration.unregister().then((success) => {
          if (success) {
            console.log('[Dev SW Cleanup] Unregistered service worker:', registration.scope);
          }
          return success;
        })
      );

      Promise.all(promises).then((results) => {
        const anyUnregistered = results.some(Boolean);
        if (anyUnregistered) {
          sessionStorage.setItem(reloadKey, String(Date.now()));
          console.log('[Dev SW Cleanup] Service worker(s) unregistered. Reloading to clear cache interceptors.');
          window.location.reload();
        }
      }).catch((err) => {
        console.error('[Dev SW Cleanup] Failed to unregister service worker:', err);
      });
    });
  }
}

