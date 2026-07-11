import { defineConfig, devices } from "@playwright/test";

/**
 * E2E suite for SchafPlay (see TEST_INFRA.md). Runs against the Vite dev
 * server: the DEV-only hooks the tests rely on (`?e2e-seed` determinism from
 * src/lib/e2e.ts, the dev skip buttons) are compiled out of production builds.
 *
 * WebRTC pairing tests connect two browser contexts over loopback host
 * candidates; Chromium's mDNS obfuscation is disabled so those candidates
 * stay resolvable in headless/CI environments without an mDNS responder.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    launchOptions: {
      args: [
        "--disable-features=WebRtcHideLocalIpsWithMdns",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
