# E2E Test Infrastructure - SchafPlay

## 1. Testing Philosophy & Methodology

This document outlines the testing principles, features under test, and the comprehensive E2E test suite for Bavarian Schafkopf multiplayer mode over serverless WebRTC.

### 1.1 Methodology
To ensure high reliability and compliance with game rules, our test design incorporates several formal engineering methodologies:
- **Category-Partition Testing**: We partition the input space and system states into distinct categories. For example:
  - Bidding Phase 1 choices: Interest ("Ich würde"), No Interest ("Weiter").
  - Bidding Phase 2 choices: Game Types (Sauspiel, Wenz, Solo, Wenz Tout, Solo Tout) and Suits (Acorns, Leaves, Hearts, Bells).
  - Card play valid moves (following suit, following trump) vs. invalid moves.
- **Boundary Value Analysis (BVA)**: We test edge cases at the boundaries of the rules, including:
  - Game scores: exactly 60 points (defender win) vs. 61 points (declarer win).
  - Score modifiers: Schneider threshold (95 points).
  - Card counts: starting with 8 cards down to 0 cards.
  - Tout contracts: winning 7 tricks (loss) vs. winning all 8 tricks (win).
- **Pairwise Testing / Combinations**: We verify combinations of game types, caller/partner hand distributions, and signal state transitions to ensure correct state propagation under varying play sequences.
- **Real-World Workloads**: We simulate end-to-end game plays (such as a full Sauspiel match or Wenz match) containing real, valid trick sequences to verify scoring, partner reveals, and state changes.

---

## 2. Features Enumeration

We identify 6 core features (F1 - F6) that represent the functional scope of SchafPlay E2E Testing:
- **F1: WebRTC Connection**: Mocked P2P data channels, connection setup, copy-paste signaling, error handling, disconnection, and recovery.
- **F2: Bidding Phase 1 (Willst du?)**: Sequential bidding clockwise starting from forehand, recording interest, rotating dealer and redealing on all-pass.
- **F3: Bidding Phase 2 (Was spielst du?)**: Priority resolution when one or multiple players want to play, contract declarations, and priority overrides.
- **F4: Card Play**: Card playing turn validation, following suit/trump, called-suit restrictions in Sauspiel (e.g. called Ace constraints), and trick winner evaluation.
- **F5: Scoring**: Gathered points calculation, game results (Schneider, Schwarz, Tout), tariff splitting for Sauspiel and Solo/Wenz, and persistent standings accumulation.
- **F6: Between-Games Flow**: Game over screens, player ready toggle states, next game reset and dealer rotation, and handling mid-reset disconnections.

---

## 3. The 71 Test Cases Suite

### TIER 1: Feature Coverage (30 Test Cases)

#### Feature 1: WebRTC Connection & Signaling
- **TC-1.1: Successful Connection**: Verify that base64 offer-answer exchange creates a connected WebRTC state (data channel open on both Host and Guest).
- **TC-1.2: Guest Rejects Corrupt Offer**: Verify Guest handles corrupted Base64 offer gracefully without crashing (connection status remains disconnected).
- **TC-1.3: Host Rejects Corrupt Answer**: Verify Host handles corrupted Base64 answer gracefully (connection stays in connecting phase).
- **TC-1.4: Bidirectional Message Exchange**: Test that data channel transfers serialization strings correctly and triggers message received events.
- **TC-1.5: Connection Tear Down**: Verify state transitions on close event (both channels transition to closed).

#### Feature 2: Bidding Phase 1 (Willst du?)
- **TC-2.1: Bidding Order Start**: Verify bidding starts clockwise from player left of the dealer.
- **TC-2.2: Interest Declaration Sequence**: Verify that "Ich würde" / "Weiter" moves the bidding index to the next player.
- **TC-2.3: Sequential Bidding Rotation**: Ensure clockwise rotation through all 4 players in order.
- **TC-2.4: All Pass Redeal**: Verify that if all players pass, dealer rotates clockwise, cards are redealt, and status resets to BIDDING.
- **TC-2.5: Guest State Redaction (Bidding Phase 1)**: Validate that the Guest can see previous bids but not other players' cards during Phase 1.

#### Feature 3: Bidding Phase 2 (Was spielst du & priority)
- **TC-3.1: Single Player Declaration**: Verify game starts if only one player wanted to play, after they declare their game.
- **TC-3.2: Priority Override (Sauspiel < Wenz)**: Verify subsequent bidder overrides lower priority bid (Wenz overrides Sauspiel).
- **TC-3.3: Priority Override (Wenz < Solo)**: Verify subsequent bidder overrides Wenz with Solo.
- **TC-3.4: Priority Tie Breaker (Seating Order)**: Verify prior player wins contract if game priority is equal.
- **TC-3.5: Highest Priority (Solo Tout)**: Verify Solo Tout overrides Solo and Wenz.

#### Feature 4: Card Play Rules
- **TC-4.1: Standard Follow Suit**: Verify players must match led suit or play gets rejected.
- **TC-4.2: Standard Follow Trump**: Verify players must play trump if trump is led or play gets rejected.
- **TC-4.3: Sauspiel Called Suit Lead Partner Requirement**: Verify partner must play called Ace when called suit is led.
- **TC-4.4: Sauspiel Called Ace Lead Restrictions**: Verify partner cannot lead called suit without playing the Ace itself.
- **TC-4.5: Trick Winner Calculation**: Validate trick winner evaluation rules (e.g. trump beats suit, highest rank wins).

#### Feature 5: Scoring and Results
- **TC-5.1: Declarer Win Threshold**: Verify declarer wins with 61+ points.
- **TC-5.2: Schneider & Schwarz Modifiers**: Verify score modifiers (+15 for Schneider, +30 for Schwarz) apply correctly.
- **TC-5.3: Sauspiel Tariff Split**: Verify tariff is split between partners and paid by defenders (+10 each for partners, -10 each for defenders).
- **TC-5.4: Wenz / Solo Tariff**: Verify solo declarer wins from/loses to three defenders (+90 for declarer, -30 each for defenders).
- **TC-5.5: Standings Accumulation**: Verify round scores accumulate to persistent list scores.

#### Feature 6: Between-Games Flow & Ready States
- **TC-6.1: Results Display Screen**: Verify round over state transitions (status shifts to ROUND_OVER, shows scoreboard, hands cleared).
- **TC-6.2: Guest Sets Ready**: Verify Guest can declare ready state.
- **TC-6.3: Host Sets Ready**: Verify Host sets ready state.
- **TC-6.4: Auto Next Game Reset**: Verify game restarts when both humans are ready (status transitions to BIDDING, dealer rotates, new cards dealt).
- **TC-6.5: Disconnect during Results Reset**: Verify ready status is cleared if player drops between games.

---

### TIER 2: Boundary & Corner Cases (30 Test Cases)

#### Feature 1: WebRTC Connection Layer Corners
- **TC-2.1.1: Copy-Paste Delay / Latency**: Confirm connection completes successfully even with significant delays in manual SDP copy-pasting.
- **TC-2.1.2: Duplicate SDP Application**: Prevent crashes if a user accidentally pastes the same Offer/Answer twice.
- **TC-2.1.3: Data Channel Message Queue Ordering**: Guarantee message sequence preservation during packet congestion.
- **TC-2.1.4: Mid-Game SDP Paste Attempt**: Prevent cheating or connection hijacking by pasting an SDP during an active game.
- **TC-2.1.5: Connection Recovery (Reconnect Resync)**: Validate session restoration when a disconnected player reconnects mid-game.

#### Feature 2: Bidding Phase 1 Corners
- **TC-2.2.1: Action Out of Turn (Bidding)**: Prevent player from bidding when it is not their turn.
- **TC-2.2.2: Malformed Bid Payload**: Validate input schema for bidding payload.
- **TC-2.2.3: Double Bid Submission**: Prevent race conditions if player clicks bid button rapidly.
- **TC-2.2.4: Dealer Passes Last in Phase 1**: Test dealer's final bid in rotation triggering redeal.
- **TC-2.2.5: Bidding Action during Play Phase**: Reject bidding inputs after bidding concludes.

#### Feature 3: Bidding Phase 2 Corners
- **TC-2.3.1: Calling Own Ace (Sauspiel)**: Enforce rule that caller cannot call a suit they hold the Ace of.
- **TC-2.3.2: Calling Suit with No Cards Held**: Enforce rule that caller must hold at least one non-trump card of the called suit.
- **TC-2.3.3: Calling Trump Suit**: Prevent calling a trump suit (Hearts in Sauspiel) or trump cards.
- **TC-2.3.4: Under-bid Override Attempt**: Prevent choosing a lower priority game than current highest bid.
- **TC-2.3.5: Non-Interested Player Game Declaration**: Prevent players who passed in Phase 1 from declaring in Phase 2.

#### Feature 4: Card Play Corners
- **TC-2.4.1: Playing Unowned Card**: Prevent playing a card that is not in player's current hand.
- **TC-2.4.2: Play Card Out of Turn**: Enforce sequential turn order.
- **TC-2.4.3: Discarding when Following is Possible**: Enforce suit-following rules.
- **TC-2.4.4: Discarding Called Ace illegally**: Enforce called Ace play constraints (cannot discard unless called suit is led, or it is the player's first card of that suit, or they have no other card of the led suit).
- **TC-2.4.5: Leading Called Suit without Called Ace**: Enforce partner's lead constraints in Sauspiel (must lead with Called Ace if leading called suit).

#### Feature 5: Scoring Corners
- **TC-2.5.1: Exact 60-60 Tie**: Handle case when declarer team gets exactly 60 points (defenders win).
- **TC-2.5.2: Ramsch Points Validation**: Verify scoring rules in optional Ramsch round.
- **TC-2.5.3: Mid-trick Contra/Re**: Verify Contra/Re timing constraints (must be declared before first card of Trick 2 is led).
- **TC-2.5.4: Tout Defeat (1 Trick Lost)**: Verify that declaring Tout requires winning all 8 tricks.
- **TC-2.5.5: Zero-Point Trick Capture**: Verify tricks with 0 points are awarded properly to the highest card, winner leads next trick.

#### Feature 6: Between-Games Flow Corners
- **TC-2.6.1: Ready State Toggle**: Validate toggling ready state (true then back to false) and ensuring game doesn't start.
- **TC-2.6.2: Mid-Game Ready State Attempt**: Prevent ready inputs during live play.
- **TC-2.6.3: Long Term Idle in Ready Room**: Prevent indefinite freezing of game by triggering heartbeat or AI takeover.
- **TC-2.6.4: Mid-List Reset**: Verify resetting standings without clearing statistics.
- **TC-2.6.5: Max List Size Completion**: Enforce list length limits (e.g. 12 games, shifts status to GAME_OVER).

---

### TIER 3: Cross-Feature Combinations (6 Test Cases)

- **TC-3.1: Disconnect during Bidding & Reconnect during Play**: Test when Guest disconnects during bidding, AI takes over, bidding completes, game moves to playing, Guest reconnects and resumes control.
- **TC-3.2: Partner Reveal followed by Mid-Play Disconnect**: Test partner reveal, Guest disconnects, game paused, Guest reconnects, state shows partner is public.
- **TC-3.3: Contra Declaration leading to Schwarz Loss**: Verify score multiplier and modifier calculation when Contra is declared and declarer fails to win any trick.
- **TC-3.4: Bidding All Pass -> Ramsch Execution -> Next Dealer rotation**: Test bidding pass, executing Ramsch round, scoring, ready states, and next round dealer rotation.
- **TC-3.5: Illegal Play followed by WebRTC Link Loss**: Test that Host rejects out-of-turn play, Guest disconnects, and Host transitions to paused state without corruption.
- **TC-3.6: Host Restart during Trick Play**: Verify settings restart resets state, shuffles/deals, and broadcasts to Guest.

---

### TIER 4: Real-World Application Scenarios (5 Workloads)

- **Workload 1: Complete Sauspiel Game**: Simulates a complete normal game loop under Sauspiel contract with specific card hands, bidding, tricks, scoring, and ready transitions.
- **Workload 2: Wenz Game with Guest Declarer**: Simulates a Wenz game declared by Guest (P3) with prime Wenz hand, trick execution, points calculation, scoring, and dealer rotation.
- **Workload 3: All-Pass Redeal and AI Solo Game**: Simulates all-pass sequential bidding resulting in a redeal, followed by an AI Solo, trick play, and scoring.
- **Workload 4: Called Ace Played on Trick 1 & Contra**: Simulates Sauspiel where called Ace is played on Trick 1, Guest declares Contra, and defenders win, verifying scoring modifiers.
- **Workload 5: Mid-Game Disconnection Recovery**: Simulates a connection break at Trick 5, UI transitions, app restarts/restores state from LocalStorage, reconnects via WebRTC, and completes the match.
