import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import fs from 'fs';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      {
        name: 'sw-version-injector',
        closeBundle() {
          const swPath = path.resolve(__dirname, 'dist/sw.js');
          if (fs.existsSync(swPath)) {
            let content = fs.readFileSync(swPath, 'utf8');
            const version = `schafplay-v-${Date.now()}`;
            content = content.replace(/const CACHE_NAME = 'schafplay-v1';/, `const CACHE_NAME = '${version}';`);
            fs.writeFileSync(swPath, content, 'utf8');
            console.log(`[sw-version-injector] Injected dynamic cache version: ${version}`);
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
      // Force bind to IPv4 loopback
      host: '127.0.0.1',
      // Allow Tailscale subdomains to access the development server
      allowedHosts: ['.ts.net'],
    },
  };
});
