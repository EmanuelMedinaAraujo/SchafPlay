import { Page } from "@playwright/test";
import { cardFromId, createDeck } from "../../src/game/deck";
import { getCallableSuits, getLegalCards, getPlaySuit } from "../../src/game/rules";
import { Card, CardValue, GameState, GameType, RemoteSeatId, SeatId, Suit } from "../../src/game/types";
import { gameLabel } from "../../src/lib/i18n";
import { seededShuffle } from "../../src/lib/seededShuffle";
import { GameRecord } from "../../src/persistence/GameHistoryStore";
import { bootHome, de, exchangeCodes, handCards, readInvite } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";
import { playCardInTurn } from "./helpers/ui";

const SEATS = ["p1", "p2", "p3", "p4"] as const;
const GUESTS = ["p3", "p2", "p4"] as const;
const NAMES = { p1: "Wirt", p2: "Leni", p3: "Franzi", p4: "Fredi" };
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
const avatarFor = (id: SeatId) => `${PNG}#${id}`;

interface WireCapture {
  states: GameState[];
  avatars: string[];
  close: () => void;
}

/** Observe decrypted app frames on real RTC channels and spoof only the claimed action seat. */
async function captureGuest(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const instrumented = new WeakSet<RTCDataChannel>();
    const capture: WireCapture = { states: [], avatars: [], close() {} };
    Object.assign(window, { wireCapture: capture });
    const send = RTCDataChannel.prototype.send as (this: RTCDataChannel, data: unknown) => void;
    RTCDataChannel.prototype.send = function (this: RTCDataChannel, data: unknown) {
      if (!instrumented.has(this)) {
        instrumented.add(this);
        this.addEventListener("message", (event) => {
          const frame = JSON.parse(event.data);
          if (frame.type === "GAME_STATE_UPDATE") capture.states.push(frame.payload.state);
          if (frame.type === "AVATAR_UPDATE") capture.avatars.push(...Object.values(frame.payload.avatars) as string[]);
        });
        capture.close = () => this.close();
      }
      if (typeof data === "string") {
        const frame = JSON.parse(data);
        if (frame.type === "PLAYER_ACTION") {
          frame.payload.action.playerId = "p1";
          data = JSON.stringify(frame);
        }
      }
      send.call(this, data);
    } as typeof RTCDataChannel.prototype.send;
  });
}

function wire(page: Page) {
  return page.evaluate(() => {
    const { states, avatars } = (window as unknown as { wireCapture: WireCapture }).wireCapture;
    return { states, avatars };
  });
}

function drop(page: Page) {
  return page.evaluate(() => (window as unknown as { wireCapture: WireCapture }).wireCapture.close());
}

function handIds(page: Page) {
  return handCards(page).evaluateAll((cards) => cards.map((card) => card.getAttribute("data-card-id")!).sort());
}

function gameRecords(page: Page): Promise<GameRecord[]> {
  return page.evaluate(async () => {
    const open = indexedDB.open("schafplay");
    return new Promise((resolve, reject) => {
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const read = db.transaction("games").objectStore("games").getAll();
        read.onsuccess = () => { db.close(); resolve(read.result); };
        read.onerror = () => { db.close(); reject(read.error); };
      };
    });
  });
}

function findDeal() {
  // Pick a Sauspiel called by p4 with the Ace in p2's hand.
  for (let seed = 0; seed < 100; seed += 1) {
    const deck = seededShuffle(seed)(createDeck());
    const hands = SEATS.map((_, index) => deck.slice(index * 8, (index + 1) * 8));
    const suit = getCallableSuits(hands[3]).find((call) =>
      hands[1].some((card) => card.suit === call && card.value === CardValue.ACE),
    );
    if (suit) return { seed, suit, hands };
  }
  throw new Error("No suitable Sauspiel deal");
}

async function playRound(pages: Partial<Record<SeatId, Page>>, observer: Page, humanCount: number) {
  let previousPlayCount = -1;
  for (let turn = 0; turn < humanCount * 8; turn += 1) {
    let next: { page: Page; state: GameState } | undefined;
    await expect.poll(async () => {
      const state = await observer.evaluate(() =>
        (window as unknown as { wireCapture: WireCapture }).wireCapture.states.at(-1),
      );
      if (!state || state.status !== "PLAYING" || state.collecting) return false;
      const playCount = state.tricks.length * 4 + (state.currentTrick?.playedCards.length ?? 0);
      const page = pages[state.players[state.activePlayerIdx].id];
      if (!page || playCount <= previousPlayCount) return false;
      previousPlayCount = playCount;
      next = { page, state };
      return true;
    }).toBe(true);
    const { page, state } = next!;
    // Derive the legal choice from the public trick and the acting player's hand.
    const hand = (await handIds(page)).map((id) => cardFromId(id)!);
    const [card] = getLegalCards(hand, state.currentTrick, state.currentContract, state.tricks);
    await playCardInTurn(page, card.id);
  }
  await expect(observer.locator(".round-over-overlay h2")).toHaveText(de.roundOver);
}

function verifyRedaction(states: GameState[], viewer: RemoteSeatId, hands: Card[][], calledSuit?: Suit) {
  let unrevealed = 0;
  let revealed = 0;
  for (const state of states.filter((frame) => frame.roundNumber === 1)) {
    const tricks = state.currentTrick ? [...state.tricks, state.currentTrick] : state.tricks;
    for (const player of state.players) {
      if (player.id === viewer) {
        const played = tricks.flatMap((trick) => trick.playedCards)
          .filter((play) => play.playerId === viewer)
          .map((play) => play.card.id);
        expect(player.cards.map((card) => card.id).sort()).toEqual(
          hands[player.seatIndex].map((card) => card.id).filter((id) => !played.includes(id)).sort(),
        );
      } else {
        expect(player.cards).toEqual(player.cards.map((_, i) => ({
          id: `hidden-${player.id}-${i}`, suit: Suit.HEARTS, value: CardValue.SEVEN, points: 0,
        })));
      }
    }
    if (state.status !== "PLAYING" || !calledSuit) continue;
    const partnerIsPublic = tricks.some(({ playedCards }) => playedCards.some(({ playerId, card }) =>
      playerId === "p2" && (card.id === `${calledSuit}-A` || getPlaySuit(playedCards[0].card, GameType.SAUSPIEL) === calledSuit),
    ));
    expect(state.currentContract?.partnerId).toBe(viewer === "p2" || partnerIsPublic ? "p2" : undefined);
    if (partnerIsPublic) revealed += 1;
    else unrevealed += 1;
  }
  if (calledSuit) {
    expect(unrevealed).toBeGreaterThan(0);
    expect(revealed).toBeGreaterThan(0);
  }
}

for (const humanCount of [3, 4] as const) {
  test(`${humanCount} humans pair, play, record a list and rematch from their own seats`, async ({ newPage }) => {
    test.setTimeout(150_000);
    const { seed, suit, hands } = findDeal();
    const host = await newPage();
    const guests = GUESTS.slice(0, humanCount - 1);
    const pages: Partial<Record<SeatId, Page>> = { p1: host };
    await host.addInitScript((avatar) => localStorage.setItem("schafplay.avatar", avatar), avatarFor("p1"));
    await bootHome(host, { mode: "host", name: NAMES.p1, seed, rounds: 4 });
    await host.getByLabel(de.humanPlayers).selectOption(String(humanCount));

    for (const [index, id] of guests.entries()) {
      const guest = await newPage();
      pages[id] = guest;
      await captureGuest(guest);
      await guest.addInitScript((avatar) => localStorage.setItem("schafplay.avatar", avatar), avatarFor(id));
      await bootHome(guest, { mode: "join", name: NAMES[id] });
      await exchangeCodes(host, guest);
      if (index < guests.length - 1) {
        await expect(guest.getByText(de.waitingForTable)).toBeVisible();
        await expect(host.locator(".lobby-seats").getByText(NAMES[id])).toBeVisible();
        await expect(host.locator(".game-screen")).toHaveCount(0);
        expect((await wire(guest)).states).toHaveLength(0);
      }
    }

    const humans = SEATS.filter((seat) => pages[seat]);
    const table = humans.map((id) => pages[id]!);
    const observer = pages.p3!;
    await Promise.all(humans.map(async (id) => {
      const page = pages[id]!;
      await expect(handCards(page)).toHaveCount(8);
      expect(await handIds(page)).toEqual(hands[SEATS.indexOf(id)].map((card) => card.id).sort());
      await expect(page.locator(".player-hand-avatar img")).toHaveAttribute("src", avatarFor(id));
      for (const other of humans.filter((seat) => seat !== id)) {
        await expect(page.locator(".seat", { hasText: NAMES[other] }).locator("img")).toHaveAttribute("src", avatarFor(other));
      }
    }));

    const declarer = humanCount === 4 ? "p4" : "p2";
    // In round one the dealer is p1, so p2 speaks first.
    for (const id of ["p2", "p3", "p4", "p1"] as const) {
      await pages[id]?.getByRole("button", { name: id === declarer ? de.willPlay : de.pass, exact: true }).click();
    }
    if (humanCount === 4) {
      await pages.p4!.getByRole("button", { name: gameLabel("de", GameType.SAUSPIEL, suit), exact: true }).click();
    } else {
      await pages.p2!.getByRole("checkbox", { name: de.tout }).check();
      await pages.p2!.getByRole("button", { name: gameLabel("de", GameType.SOLO_HEARTS, undefined, true), exact: true }).click();
    }
    await expect(observer.locator(".contract-chip")).toHaveText(
      humanCount === 4 ? gameLabel("de", GameType.SAUSPIEL, suit) : gameLabel("de", GameType.SOLO_HEARTS, undefined, true),
    );

    if (humanCount === 4) {
      // Lose two active links. The healthy guest waits while the host repairs each seat.
      const p2 = pages.p2!;
      const p4 = pages.p4!;
      await drop(p2);
      await expect(host.locator(".reconnect-overlay")).toBeVisible();
      await expect(observer.getByText(de.waitingForReconnect)).toBeVisible();
      await drop(p4);
      await expect(p4.getByPlaceholder(de.pasteInviteHint)).toBeVisible();

      const p4Frames = (await wire(p4)).states.length;
      const wrongInvite = await readInvite(host);
      await exchangeCodes(host, p4);
      // An existing guest cannot reconnect into another seat using its invite.
      await expect.poll(() => readInvite(host)).not.toBe(wrongInvite);
      await expect(p4.getByPlaceholder(de.pasteInviteHint)).toBeVisible();
      expect((await wire(p4)).states).toHaveLength(p4Frames);

      await exchangeCodes(host, p2);
      await expect(p2.getByText(de.waitingForReconnect)).toBeVisible();
      await expect(observer.getByText(de.waitingForReconnect)).toBeVisible();
      await expect(host.locator(".reconnect-overlay")).toBeVisible();
      await exchangeCodes(host, p4);
      await Promise.all(table.map((page) => expect(page.locator(".reconnect-overlay")).toBeHidden()));
      for (const id of ["p2", "p4"] as const) {
        expect(await handIds(pages[id]!)).toEqual(hands[SEATS.indexOf(id)].map((card) => card.id).sort());
        await expect(pages[id]!.locator(".player-hand-avatar img")).toHaveAttribute("src", avatarFor(id));
      }
    }

    await playRound(pages, observer, humanCount);
    for (const id of guests) {
      const received = await wire(pages[id]!);
      expect(received.avatars).toEqual(expect.arrayContaining(humans.map(avatarFor)));
      verifyRedaction(received.states, id, hands, humanCount === 4 ? suit : undefined);
    }

    for (let round = 1; round <= 4; round += 1) {
      if (round > 1) await host.locator(".dev-round-btn").click();
      const ready = round === 4 ? de.toFinalStandings : de.ready;
      await Promise.all(table.slice(0, -1).map((page) => page.getByRole("button", { name: ready, exact: true }).click()));
      await expect(host.locator(".round-over-overlay h2")).toHaveText(de.roundOver);
      await expect(host.locator(".round-over-status")).toContainText(NAMES[humans.at(-1)!]);
      await table.at(-1)!.getByRole("button", { name: ready, exact: true }).click();
      if (round < 4) await expect(host.locator(".game-toolbar")).toContainText(`${round + 1}/4`);
    }

    for (const id of humans) {
      const page = pages[id]!;
      await expect(page.locator(".round-over-overlay h2")).toHaveText(de.listOver);
      await expect.poll(async () => {
        const databases = await page.evaluate(() => indexedDB.databases());
        return databases.some(({ name }) => name === "schafplay") ? (await gameRecords(page)).length : 0;
      }).toBe(1);
      const [record] = await gameRecords(page);
      expect(record.localPlayerId).toBe(id);
      expect(record.localPlayerName).toBe(NAMES[id]);
      expect(record.players.filter((player) => player.isHuman).map((player) => player.id)).toEqual(humans);
      expect(record.rounds).toHaveLength(4);
      expect(record.rounds[0].initialHand.slice().sort()).toEqual(hands[SEATS.indexOf(id)].map((card) => card.id).sort());
      expect(record.rounds[0].tricks).toHaveLength(8);
    }

    await Promise.all(table.slice(0, -1).map((page) => page.getByRole("button", { name: de.rematch, exact: true }).click()));
    await expect(host.locator(".round-over-overlay h2")).toHaveText(de.listOver);
    await table.at(-1)!.getByRole("button", { name: de.rematch, exact: true }).click();
    await Promise.all(table.map(async (page) => {
      await expect(page.locator(".round-over-overlay")).toHaveCount(0);
      await expect(page.locator(".game-toolbar")).toContainText("1/4");
      await expect(handCards(page)).toHaveCount(8);
    }));
  });
}
