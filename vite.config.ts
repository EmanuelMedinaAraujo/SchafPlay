import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import fs from 'fs';
import basicSsl from '@vitejs/plugin-basic-ssl';

const IMAGE = /\.(png|jpe?g|webp|svg|gif)$/i;

/** Rewrite one marker in the worker; a missing marker fails the build rather
 * than silently shipping a stale cache name or precache list. */
function inject(content: string, pattern: RegExp, replacement: string): string {
  if (!pattern.test(content)) throw new Error(`[sw-version-injector] public/sw.js no longer matches ${pattern}`);
  return content.replace(pattern, replacement);
}

export default defineConfig(({ command }) => {
  // GitHub Pages serves the project site under /<repo>/. The base can be
  // overridden with BASE_PATH (e.g. "/" for a custom domain or a root host).
  // Dev always runs at "/" so `npm run dev` is unaffected.
  const base = process.env.BASE_PATH ?? (command === 'build' ? '/SchafPlay/' : '/');
  // `vite --host` (npm run dev:network) serves the LAN over self-signed HTTPS,
  // which camera access on other devices requires; basicSsl enables it.
  const network = process.argv.includes('--host');

  return {
    base,
    plugins: [
      react(),
      network ? basicSsl() : false,
      {
        name: 'sw-version-injector',
        // closeBundle also fires when the dev server shuts down.
        apply: 'build',
        closeBundle() {
          const dist = path.resolve(__dirname, 'dist');
          /** Base-prefixed URLs of the files in a dist/ subdirectory. */
          const listFiles = (dir: string, filter?: RegExp) =>
            fs
              .readdirSync(path.join(dist, dir))
              .filter((file) => !filter || filter.test(file))
              .map((file) => `${base}${dir ? `${dir}/` : ''}${file}`);

          // Precache every built asset so the PWA is fully usable offline,
          // plus the static images copied from public/ (cards, preset
          // avatars, icons, game background). Those are referenced by
          // absolute URL at runtime, so without this they would only be
          // cached after a first online fetch and an app opened offline
          // first would show broken images.
          const precache = [
            base,
            `${base}index.html`,
            `${base}manifest.json`,
            ...listFiles('assets'),
            ...listFiles('bavarian-cards'),
            ...listFiles('avatars', IMAGE),
            ...listFiles('', IMAGE),
          ];

          const swPath = path.join(dist, 'sw.js');
          const version = `schafplay-v-${Date.now()}`;
          let content = fs.readFileSync(swPath, 'utf8');
          content = inject(content, /const CACHE_NAME = 'schafplay-v1';/, `const CACHE_NAME = '${version}';`);
          // Bake the deploy base into the worker so precache keys and the
          // navigation fallback resolve under /<repo>/ on GitHub Pages.
          content = inject(content, /const BASE = '\/';/, `const BASE = '${base}';`);
          content = inject(content, /const PRECACHE = \[[^\]]*\];/, `const PRECACHE = ${JSON.stringify(precache)};`);
          fs.writeFileSync(swPath, content, 'utf8');
          console.log(`[sw-version-injector] Injected cache version ${version}, base ${base} and ${precache.length} precache entries`);
        }
      }
    ],
    server: {
      // Bind to IPv4 loopback unless --host is specified.
      host: network ? undefined : '127.0.0.1',
      // Allow Tailscale subdomains to access the development server
      allowedHosts: ['.ts.net'],
    },
    preview: {
      allowedHosts: true,
    },
  };
});
