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

    // Module scripts run deferred, so the document is already parsed here.
    navigator.serviceWorker.getRegistration().then((existing) => {
      // Already installed — stay offline; updates go through checkForUpdate().
      if (existing) return;
      navigator.serviceWorker.register(swUrl)
        .then((reg) => console.log('[SW] Registered with scope:', reg.scope))
        .catch((err) => console.error('[SW] Registration failed:', err));
    });
  } else {
    // Dev: unregister leftover service workers so they can't serve stale
    // assets, then reload once (guarded against a reload loop).
    navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      if (registrations.length === 0) return;
      const reloadKey = 'sw-dev-cleanup-reload';
      const lastReload = Number(sessionStorage.getItem(reloadKey));
      if (lastReload && Date.now() - lastReload < 5000) {
        console.warn('[Dev SW Cleanup] Detected potential reload loop. Skipping automatic reload.');
        return;
      }
      try {
        const results = await Promise.all(registrations.map((registration) => registration.unregister()));
        if (!results.some(Boolean)) return;
        sessionStorage.setItem(reloadKey, String(Date.now()));
        window.location.reload();
      } catch (err) {
        console.error('[Dev SW Cleanup] Failed to unregister service worker:', err);
      }
    });
  }
}

