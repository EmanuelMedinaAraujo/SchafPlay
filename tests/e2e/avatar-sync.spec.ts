import { Page } from "@playwright/test";
import { de, pairPages } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";

/** Profile pictures over the wire (#14); see `src/session/avatarSync.ts`. */

/** A 1x1 PNG, distinctive enough to assert on and tiny enough to inline. */
const CUSTOM_AVATAR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

/** Seed the device setting the picker writes, before any app code runs. */
async function presetAvatar(page: Page, value: string): Promise<void> {
  await page.addInitScript((avatar) => {
    window.localStorage.setItem("schafplay.avatar", avatar as string);
  }, value);
}

interface SentFrame {
  type: string;
  length: number;
  hasDataUrl: boolean;
}

/** Record every frame the host puts on the data channel, with its size. */
async function recordSentFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const sent: SentFrame[] = [];
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

const sentFrames = (page: Page): Promise<SentFrame[]> =>
  page.evaluate(() => (window as unknown as { __sent: SentFrame[] }).__sent ?? []);

test.describe("profile pictures over the wire (#14)", () => {
  test("both pictures cross the channel, and a custom one is not in every snapshot", async ({ newPage }) => {
    const host = await newPage();
    const guest = await newPage();

    // The host uploaded a custom picture; the guest picked the 4th preset.
    await recordSentFrames(host);
    await presetAvatar(host, CUSTOM_AVATAR);
    await presetAvatar(guest, "preset:wastl");

    await pairPages(host, guest, { seed: 12345, hostName: "Wirt", guestName: "Gast" });

    // Host → guest: the custom picture arrives and renders on the host's seat.
    const hostSeatOnGuest = guest.locator(".seat", { hasText: "Wirt" }).locator(".seat-avatar-img");
    await expect(hostSeatOnGuest).toHaveAttribute("src", CUSTOM_AVATAR, { timeout: 15_000 });

    // Guest → host: the preset arrives via CONNECTION_ACK and resolves locally.
    const guestSeatOnHost = host.locator(".seat", { hasText: "Gast" }).locator(".seat-avatar-img");
    await expect(guestSeatOnHost).toHaveAttribute("src", /avatars\/wastl\.[a-z]+$/, { timeout: 15_000 });

    // The guest sees its own picture on its own name plate.
    await expect(guest.locator(".player-hand-avatar img")).toHaveAttribute("src", /avatars\/wastl\.[a-z]+$/);

    // Drive the will phase so the host emits a good number of snapshots.
    // Both seats pass concurrently, so the bidding order does not matter.
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
  });

  test("an oversized picture from a peer is rejected, not stored", async ({ newPage }) => {
    const host = await newPage();
    const guest = await newPage();

    // A megabyte-sized avatar must be dropped, not pinned into game state
    // and re-broadcast (sanitizeAvatar in session/avatarSync.ts).
    await presetAvatar(guest, `data:image/png;base64,${"A".repeat(200_000)}`);

    await pairPages(host, guest, { seed: 12345, hostName: "Wirt", guestName: "Gast" });

    const guestSeatOnHost = host.locator(".seat", { hasText: "Gast" }).locator(".seat-avatar-img");
    await expect(guestSeatOnHost).toHaveAttribute("src", /avatars\/default\.[a-z]+$/, { timeout: 15_000 });
  });

  test("a picture smuggled inside a state snapshot is rejected by the guest", async ({ newPage }) => {
    const host = await newPage();
    const guest = await newPage();

    // A hostile host can route around AVATAR_UPDATE by putting the payload
    // directly into the broadcast state, so the guest sanitizes that path too
    // (sanitizeStateAvatars). SVG is the one image type the boundary refuses.
    await rewriteOutboundAvatar(host, "data:image/svg+xml;base64,PHN2Zy8+");

    await pairPages(host, guest, { seed: 12345, hostName: "Wirt", guestName: "Gast" });

    // The host's seat must show the fallback, never the injected value.
    const hostSeatOnGuest = guest.locator(".seat", { hasText: "Wirt" }).locator(".seat-avatar-img");
    await expect(hostSeatOnGuest).toHaveAttribute("src", /avatars\/default\.[a-z]+$/, { timeout: 15_000 });
    // Give the host time to emit further snapshots, then confirm it held.
    await guest.waitForTimeout(1_000);
    await expect(hostSeatOnGuest).toHaveAttribute("src", /avatars\/default\.[a-z]+$/);
  });
});

test.describe("the guest's identity survives a slow host (#95)", () => {
  test("a CONNECTION_ACK arriving before the host's engine is not dropped", async ({ newPage }) => {
    const host = await newPage();
    const guest = await newPage();

    // The host builds its engine on the transport's "connected" callback, so an
    // ACK delivered before that callback used to land on a session with no
    // engine and be dropped — the guest never repeats it.
    await delayOpenCallback(host, 750);
    await presetAvatar(guest, "preset:wastl");

    await pairPages(host, guest, { seed: 12345, hostName: "Wirt", guestName: "Franzi" });

    // Seat 3 is opposite the host, and it must carry what the guest sent.
    const guestSeat = host.locator(".seat-top");
    await expect(guestSeat.locator(".seat-name")).toContainText("Franzi", { timeout: 15_000 });
    await expect(guestSeat.locator(".seat-avatar-img")).toHaveAttribute("src", /avatars\/wastl\.[a-z]+$/);
  });
});

/**
 * Hold back the app's reaction to the data channel opening, without touching
 * message delivery — that inverts the two events whose order the host used to
 * depend on, making the race in #95 deterministic.
 */
async function delayOpenCallback(page: Page, ms: number): Promise<void> {
  await page.addInitScript((delay) => {
    const onopen = Object.getOwnPropertyDescriptor(RTCDataChannel.prototype, "onopen")!;
    Object.defineProperty(RTCDataChannel.prototype, "onopen", {
      configurable: true,
      get: onopen.get,
      set(this: RTCDataChannel, handler: ((event: Event) => void) | null) {
        const later = (event: Event) => window.setTimeout(() => handler!.call(this, event), delay as number);
        onopen.set!.call(this, handler && later);
      },
    });
  }, ms);
}

/**
 * Smuggle `avatar` into the broadcast state, bypassing AVATAR_UPDATE. Patching
 * the data channel is the only way to play a peer that ignores our protocol —
 * exactly the peer the boundary exists for.
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
