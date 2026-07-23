import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import fs from 'fs';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ command }) => {
  // GitHub Pages serves the project site under /<repo>/. The base can be
  // overridden with BASE_PATH (e.g. "/" for a custom domain or a root host).
  // Dev always runs at "/" so `npm run dev` is unaffected.
  const base = process.env.BASE_PATH ?? (command === 'build' ? '/SchafPlay/' : '/');

  return {
    base,
    plugins: [
      react(),
      (process.argv.includes('--host') || process.argv.includes('-h')) ? basicSsl() : false,
      {
        name: 'sw-version-injector',
        closeBundle() {
          const swPath = path.resolve(__dirname, 'dist/sw.js');
          if (fs.existsSync(swPath)) {
            let content = fs.readFileSync(swPath, 'utf8');
            const version = `schafplay-v-${Date.now()}`;
            content = content.replace(/const CACHE_NAME = 'schafplay-v1';/, `const CACHE_NAME = '${version}';`);
            // Bake the deploy base into the worker so precache keys and the
            // navigation fallback resolve under /<repo>/ on GitHub Pages.
            content = content.replace(/const BASE = '\/';/, `const BASE = '${base}';`);
            // Precache every built asset so the PWA is fully usable offline.
            const assetsDir = path.resolve(__dirname, 'dist/assets');
            const assets = fs.existsSync(assetsDir)
              ? fs.readdirSync(assetsDir).map((file) => `${base}assets/${file}`)
              : [];
            const cardsDir = path.resolve(__dirname, 'dist/bavarian-cards');
            const cards = fs.existsSync(cardsDir)
              ? fs.readdirSync(cardsDir).map((file) => `${base}bavarian-cards/${file}`)
              : [];
            // Preset profile-picture files (#14) live in a public/avatars/
            // subdir, so the root-image sweep below doesn't reach them.
            const avatarsDir = path.resolve(__dirname, 'dist/avatars');
            const avatars = fs.existsSync(avatarsDir)
              ? fs.readdirSync(avatarsDir).map((file) => `${base}avatars/${file}`)
              : [];
            // Precache the static images copied from public/ (avatars, game
            // background, …). They are referenced by absolute URL at runtime,
            // so without this they'd only be cached after a first online fetch
            // and the app would show broken images when opened offline first.
            const distRoot = path.resolve(__dirname, 'dist');
            const rootImages = fs.existsSync(distRoot)
              ? fs
                  .readdirSync(distRoot)
                  .filter((file) => /\.(png|jpe?g|webp|svg|gif)$/i.test(file))
                  .map((file) => `${base}${file}`)
              : [];
            const precache = [
              base,
              `${base}index.html`,
              `${base}icon-192.png`,
              `${base}icon-512.png`,
              `${base}manifest.json`,
              ...assets,
              ...cards,
              ...avatars,
              ...rootImages,
            ];
            // Drop duplicates (e.g. the icons already listed explicitly).
            const uniquePrecache = [...new Set(precache)];
            content = content.replace(/const PRECACHE = \[[^\]]*\];/, `const PRECACHE = ${JSON.stringify(uniquePrecache)};`);
            fs.writeFileSync(swPath, content, 'utf8');
            console.log(`[sw-version-injector] Injected cache version ${version}, base ${base} and ${uniquePrecache.length} precache entries`);
          }
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Force bind to IPv4 loopback unless --host is specified
      host: (process.argv.includes('--host') || process.argv.includes('-h')) ? undefined : '127.0.0.1',
      // Enable HTTPS when --host is specified (required for camera/signaling on other network devices)
      https: (process.argv.includes('--host') || process.argv.includes('-h')) ? (true as any) : undefined,
      // Allow Tailscale subdomains to access the development server
      allowedHosts: ['.ts.net'],
    },
    preview: {
      allowedHosts: true,
    },
  };
});
