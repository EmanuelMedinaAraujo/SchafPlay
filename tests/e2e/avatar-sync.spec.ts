import { Page, expect, test } from "@playwright/test";
import { bootHome, de, exchangeCodes } from "./helpers/fixtures";

/**
 * Profile pictures over the wire (#14).
 *
 * Both directions are covered — the host's picture rides to the guest, the
 * guest's rides back in the CONNECTION_ACK — plus the property that makes it
 * affordable: a custom (data URL) picture is sent once in its own
 * AVATAR_UPDATE message and is *not* repeated in every state snapshot. See
 * `src/session/avatarSync.ts`.
 */

/** A 1x1 PNG, distinctive enough to assert on and tiny enough to inline. */
const CUSTOM_AVATAR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

/** Seed the device setting the picker writes, before any app code runs. */
async function presetAvatar(page: Page, value: string): Promise<void> {
  await page.addInitScript((avatar) => {
    window.localStorage.setItem("schafplay.avatar", avatar as string);
  }, value);
}

/**
 * Record every frame the host puts on the data channel, so the test can assert
 * what the picture actually costs per message rather than just that it arrives.
 */
async function recordSentFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const sent: { type: string; length: number; hasDataUrl: boolean }[] = [];
    (window as unknown as { __sent: typeof sent }).__sent = sent;
    const send = RTCDataChannel.prototype.send as (this: RTCDataChannel, data: unknown) => void;
    RTCDataChannel.prototype.send = function (this: RTCDataChannel, data: unknown) {
      if (typeof data === "string") {
        let type = "UNKNOWN";
        try {
          type = String(JSON.parse(data).type);
        } catch {
          // Not our framing; recorded as UNKNOWN.
        }
        sent.push({ type, length: data.length, hasDataUrl: data.includes("data:image") });
      }
      return send.call(this, data);
    } as typeof RTCDataChannel.prototype.send;
  });
}

interface SentFrame {
  type: string;
  length: number;
  hasDataUrl: boolean;
}

const sentFrames = (page: Page): Promise<SentFrame[]> =>
  page.evaluate(() => (window as unknown as { __sent: SentFrame[] }).__sent ?? []);

test.describe("profile pictures over the wire (#14)", () => {
  test("both pictures cross the channel, and a custom one is not in every snapshot", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    // The host uploaded a custom picture; the guest picked the 4th preset.
    await recordSentFrames(host);
    await presetAvatar(host, CUSTOM_AVATAR);
    await presetAvatar(guest, "preset:wastl");

    await bootHome(host, { seed: 12345, name: "Wirt", mode: "host" });
    await bootHome(guest, { name: "Gast", mode: "join" });
    await exchangeCodes(host, guest);
    await expect(host.locator(".game-screen")).toBeVisible({ timeout: 15_000 });
    await expect(guest.locator(".game-screen")).toBeVisible({ timeout: 15_000 });

    // Host → guest: the custom picture arrives and renders on the host's seat.
    const hostSeatOnGuest = guest.locator(".seat", { hasText: "Wirt" }).locator(".seat-avatar-img");
    await expect(hostSeatOnGuest).toHaveAttribute("src", CUSTOM_AVATAR, { timeout: 15_000 });

    // Guest → host: the preset arrives via CONNECTION_ACK and resolves locally.
    const guestSeatOnHost = host.locator(".seat", { hasText: "Gast" }).locator(".seat-avatar-img");
    await expect(guestSeatOnHost).toHaveAttribute("src", /avatars\/wastl\.[a-z]+$/, { timeout: 15_000 });

    // The guest sees its own picture on its own name plate.
    await expect(guest.locator(".player-hand-avatar img")).toHaveAttribute("src", /avatars\/wastl\.[a-z]+$/);

    // Drive the will phase so the host emits a good number of snapshots — the
    // point of the fix is what those repeated snapshots carry. Both seats pass
    // concurrently, so the bidding order does not matter.
    await Promise.all([
      host.getByRole("button", { name: de.pass, exact: true }).click(),
      guest.getByRole("button", { name: de.pass, exact: true }).click(),
    ]);
    await expect
      .poll(async () => (await sentFrames(host)).filter((frame) => frame.type === "GAME_STATE_UPDATE").length, {
        timeout: 20_000,
      })
      .toBeGreaterThan(5);

    const frames = await sentFrames(host);
    const states = frames.filter((frame) => frame.type === "GAME_STATE_UPDATE");
    const avatarUpdates = frames.filter((frame) => frame.type === "AVATAR_UPDATE");

    // The picture travels in its own message, once — not with every snapshot.
    expect(avatarUpdates.filter((frame) => frame.hasDataUrl)).toHaveLength(1);
    expect(states.filter((frame) => frame.hasDataUrl)).toHaveLength(0);
    // Sanity: a snapshot is now far smaller than the picture it used to carry.
    expect(Math.max(...states.map((frame) => frame.length))).toBeLessThan(CUSTOM_AVATAR.length * 40);

    await hostContext.close();
    await guestContext.close();
  });

  test("an oversized picture from a peer is rejected, not stored", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    // A peer that claims a megabyte-sized avatar: the host must drop it and
    // fall back to the default picture rather than pin it into game state and
    // re-broadcast it (sanitizeAvatar in session/avatarSync.ts).
    await presetAvatar(guest, `data:image/png;base64,${"A".repeat(200_000)}`);

    await bootHome(host, { seed: 12345, name: "Wirt", mode: "host" });
    await bootHome(guest, { name: "Gast", mode: "join" });
    await exchangeCodes(host, guest);
    await expect(host.locator(".game-screen")).toBeVisible({ timeout: 15_000 });

    const guestSeatOnHost = host.locator(".seat", { hasText: "Gast" }).locator(".seat-avatar-img");
    await expect(guestSeatOnHost).toHaveAttribute("src", /avatars\/default\.[a-z]+$/, { timeout: 15_000 });

    await hostContext.close();
    await guestContext.close();
  });

  test("a picture smuggled inside a state snapshot is rejected by the guest", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    // The mirror of the test above, in the direction the guest is exposed to.
    // A hostile host can route around AVATAR_UPDATE (and therefore around
    // sanitizeAvatarMap) by putting the payload directly into the state it
    // broadcasts, so the guest sanitizes that path too — sanitizeStateAvatars.
    // Here the host claims an SVG avatar, the one image type the boundary
    // deliberately refuses.
    await rewriteOutboundAvatar(host, "data:image/svg+xml;base64,PHN2Zy8+");

    await bootHome(host, { seed: 12345, name: "Wirt", mode: "host" });
    await bootHome(guest, { name: "Gast", mode: "join" });
    await exchangeCodes(host, guest);
    await expect(guest.locator(".game-screen")).toBeVisible({ timeout: 15_000 });

    // The host's seat must show the fallback, never the injected value.
    const hostSeatOnGuest = guest.locator(".seat", { hasText: "Wirt" }).locator(".seat-avatar-img");
    await expect(hostSeatOnGuest).toHaveAttribute("src", /avatars\/default\.[a-z]+$/, { timeout: 15_000 });
    // Give the host time to emit further snapshots, then confirm it held.
    await guest.waitForTimeout(1_000);
    await expect(hostSeatOnGuest).toHaveAttribute("src", /avatars\/default\.[a-z]+$/);

    await hostContext.close();
    await guestContext.close();
  });
});

/**
 * Make the host smuggle `avatar` into the state it broadcasts, bypassing the
 * AVATAR_UPDATE message the sanitizer on that path would see. Patching the
 * data channel is the only way to play a peer that does not follow our own
 * protocol — which is exactly the peer the boundary exists for.
 */
async function rewriteOutboundAvatar(page: Page, avatar: string): Promise<void> {
  await page.addInitScript((injected) => {
    const send = RTCDataChannel.prototype.send as (this: RTCDataChannel, data: unknown) => void;
    RTCDataChannel.prototype.send = function (this: RTCDataChannel, data: unknown) {
      if (typeof data === "string") {
        try {
          const message = JSON.parse(data);
          if (message?.type === "GAME_STATE_UPDATE" && message.payload?.state?.players) {
            for (const player of message.payload.state.players) player.avatar = injected as string;
            return send.call(this, JSON.stringify(message));
          }
        } catch {
          // Not our framing; passed through untouched.
        }
      }
      return send.call(this, data);
    } as typeof RTCDataChannel.prototype.send;
  }, avatar);
}
