// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import SchafkopfBoard from "../src/components/SchafkopfBoard";
import { Difficulty, DealSpeed } from "../src/types";

// Mock framer-motion (motion/react) to avoid issues in jsdom environment
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("SchafkopfBoard - Multiplayer Pass & Play", () => {
  const mockOnGameFinished = vi.fn();
  const mockOnShowRules = vi.fn();

  const defaultProps = {
    playerName: "Player A",
    difficulty: Difficulty.MEDIUM,
    dealSpeed: DealSpeed.FAST, // Use FAST to minimize setTimeout delays
    language: "de" as const,
    isMultiplayer: true,
    multiplayerPlayers: [
      { name: "Player A", isHuman: true },
      { name: "Player B", isHuman: true },
      { name: "AI C", isHuman: false },
      { name: "AI D", isHuman: false },
    ],
    onGameFinished: mockOnGameFinished,
    onShowRules: mockOnShowRules,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnGameFinished.mockClear();
    mockOnShowRules.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  it("should initialize the game in BIDDING stage and show the concealment shield for the first human player", async () => {
    render(<SchafkopfBoard {...defaultProps} />);

    // Since dealerIdx is initialized to 0, nextDealerIdx becomes 1 (Player B)
    // The activePlayerIdx starts at (nextDealerIdx + 1) % 4 = 2 (AI C)
    // So AI C should bid first. Since it is AI, it bids automatically.
    // Let's run pending timers to let the AI bid.
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // After AI C bids, the turn goes to AI D (index 3). It bids automatically.
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // After AI D bids, the turn goes to Player A (index 0), who is Human!
    // Since Player A is human and it's multiplayer, the concealment shield should be shown.
    expect(screen.queryByText(/Sichtschutz aktiv/i)).not.toBeNull();
    expect(screen.queryByText(/Gerät an Player A übergeben!/i)).not.toBeNull();

    // The reveal button should be present
    const revealBtn = screen.getAllByRole("button", { name: /Ich bin Player A \(Karten zeigen\)/i })[0];
    expect(revealBtn).toBeDefined();

    // Click the reveal button
    await act(async () => {
      fireEvent.click(revealBtn);
    });

    // The concealment shield should be gone, and the bidding options should be visible
    expect(screen.queryByText(/Sichtschutz aktiv/i)).toBeNull();
    expect(screen.queryByText(/Ansage wählen:/i)).not.toBeNull();

    // Player A decides to Pass (Passen / Weiter)
    const passBtn = screen.getByRole("button", { name: /Passen \/ Weiter/i });
    await act(async () => {
      fireEvent.click(passBtn);
    });

    // After Player A passes, the turn goes to Player B (index 1), who is also Human!
    // The concealment shield should now show for Player B.
    expect(screen.queryByText(/Sichtschutz aktiv/i)).not.toBeNull();
    expect(screen.queryByText(/Gerät an Player B übergeben!/i)).not.toBeNull();

    const revealBtnB = screen.getAllByRole("button", { name: /Ich bin Player B \(Karten zeigen\)/i })[0];
    expect(revealBtnB).toBeDefined();

    // Click reveal for Player B
    await act(async () => {
      fireEvent.click(revealBtnB);
    });

    // Player B passes
    const passBtnB = screen.getByRole("button", { name: /Passen \/ Weiter/i });
    await act(async () => {
      fireEvent.click(passBtnB);
    });

    // Now everyone has bid (AI C: Pass, AI D: Pass, Player A: Pass, Player B: Pass)
    // The game should transition to PLAYING stage with Ramsch-Modus active!
    // Since everyone passed, Ramsch contract is active.
    // Let's run timers to let any state updates settle
    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    // The first player to lead the trick is Forehand: (dealerIdx + 1) % 4 = (1 + 1) % 4 = 2 (AI C).
    // AI C is AI, so it should play its card automatically.
    // Let's advance timers to let AI C play.
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // After AI C plays, the turn goes to AI D (index 3). It plays automatically.
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // After AI D plays, the turn goes to Player A (index 0), who is Human!
    // The concealment shield should be shown for Player A.
    expect(screen.queryByText(/Sichtschutz aktiv/i)).not.toBeNull();
    expect(screen.queryByText(/Gerät an Player A übergeben!/i)).not.toBeNull();
  });

  it("should allow human players to reveal their hand and play a legal card", async () => {
    const { container } = render(<SchafkopfBoard {...defaultProps} />);

    // Walk through bidding
    // AI C bids
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    // AI D bids
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    // Player A bids
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /Ich bin Player A \(Karten zeigen\)/i })[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Passen \/ Weiter/i }));
    });
    // Player B bids
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /Ich bin Player B \(Karten zeigen\)/i })[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Passen \/ Weiter/i }));
    });

    // Game is now in PLAYING stage.
    // AI C plays
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    // AI D plays
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Now it's Player A's turn to play. Reveal cards.
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /Ich bin Player A \(Karten zeigen\)/i })[0]);
    });

    // Find card elements in Player A's hand (those with class "cursor-grab")
    const handCards = container.querySelectorAll(".cursor-grab");
    expect(handCards.length).toBeGreaterThan(0);

    // The deal is random, so the first card is not always legal (follow suit!).
    // Click cards in order until one is accepted and the hand gets concealed.
    for (const card of Array.from(handCards)) {
      await act(async () => {
        fireEvent.click(card);
      });
      if (screen.queryByText(/Sichtschutz aktiv/i)) break;
    }

    // Once Player A plays, their hand should be concealed, and the turn goes to Player B (Human)
    expect(screen.queryByText(/Sichtschutz aktiv/i)).not.toBeNull();
    expect(screen.queryByText(/Gerät an Player B übergeben!/i)).not.toBeNull();
  });
});
