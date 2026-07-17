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
    // Manual-only updates (#61): the app never checks for a new version on
    // its own. We only ever call register() when there is no existing
    // registration — that first registration is what installs the offline
    // cache in the first place and unavoidably needs the network. From then
    // on the only thing that reaches out online is the user pressing
    // "check for update now" in Settings (checkForUpdate() in
    // src/lib/pwa.ts), so opening/reopening the app never touches the
    // network once installed. A newly discovered worker also stays WAITING
    // (public/sw.js no longer calls skipWaiting() on install) until that
    // manual flow tells it to take over.
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    // Reload once the manually-triggered update actually takes over, so the
    // Settings "check for update now" flow lands on the new version. Guard
    // with hadController: on the very first install there's no prior
    // controller, and clients.claim() taking control of this page for the
    // first time also fires 'controllerchange' — that's not an update, so
    // don't reload for it.
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
          // Already installed — stay fully offline. checkForUpdate() (the
          // Settings "check for update now" button) is the only code path
          // that ever calls registration.update() from here on.
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

