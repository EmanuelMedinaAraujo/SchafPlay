/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Card, CardValue, Suit, GameType, Contract, Trick, Player, PlayedCard, Difficulty } from "../types";

// Generate a standard 32-card Bavarian Schafkopf deck
export function createDeck(): Card[] {
  const suits = [Suit.ACORNS, Suit.LEAVES, Suit.HEARTS, Suit.BELLS];
  const values = [
    { val: CardValue.SEVEN, pts: 0 },
    { val: CardValue.EIGHT, pts: 0 },
    { val: CardValue.NINE, pts: 0 },
    { val: CardValue.UNTER, pts: 2 },
    { val: CardValue.OBER, pts: 3 },
    { val: CardValue.KING, pts: 4 },
    { val: CardValue.TEN, pts: 10 },
    { val: CardValue.ACE, pts: 11 },
  ];

  const deck: Card[] = [];
  for (const suit of suits) {
    for (const { val, pts } of values) {
      deck.push({
        id: `${suit}-${val}`,
        suit,
        value: val,
        points: pts,
      });
    }
  }
  return deck;
}

// Fisher-Yates Shuffle
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

// Determine if a card is a trump in the current game configuration
export function isTrump(card: Card, gameType: GameType, wenzSuit?: Suit): boolean {
  if (gameType === GameType.WENZ) {
    if (card.value === CardValue.UNTER) {
      return true;
    }
    if (wenzSuit && card.suit === wenzSuit) {
      return true;
    }
    return false;
  }
  
  // Obers and Unters are always trumps in Sauspiel, Solos, and Ramsch
  if (card.value === CardValue.OBER || card.value === CardValue.UNTER) {
    return true;
  }

  // Heart is default trump suit in Sauspiel, Heart Solo, and Ramsch/Passed
  if (
    gameType === GameType.SAUSPIEL ||
    gameType === GameType.SOLO_HEARTS ||
    gameType === GameType.RAMSCH ||
    gameType === GameType.PASSED
  ) {
    return card.suit === Suit.HEARTS;
  }

  // Other Solos define their trump suit
  if (gameType === GameType.SOLO_ACORNS && card.suit === Suit.ACORNS) return true;
  if (gameType === GameType.SOLO_LEAVES && card.suit === Suit.LEAVES) return true;
  if (gameType === GameType.SOLO_BELLS && card.suit === Suit.BELLS) return true;

  return false;
}

// Get the actual "play suit" category. In Schafkopf, all trump cards belong to the "TRUMP" category
export function getPlaySuit(card: Card, gameType: GameType, wenzSuit?: Suit): Suit | "TRUMP" {
  if (isTrump(card, gameType, wenzSuit)) {
    return "TRUMP";
  }
  return card.suit;
}

// Rank cards relative to each other (higher rank beats lower)
export function getCardRank(card: Card, gameType: GameType, wenzSuit?: Suit): number {
  if (gameType === GameType.WENZ) {
    if (card.value === CardValue.UNTER) {
      // Only Unters are trumps in Wenz
      switch (card.suit) {
        case Suit.ACORNS: return 100;
        case Suit.LEAVES: return 99;
        case Suit.HEARTS: return 98;
        case Suit.BELLS: return 97;
      }
    }
    if (wenzSuit && card.suit === wenzSuit) {
      // In Color Wenz, the chosen suit cards are trumps, ranked under Unters
      switch (card.value) {
        case CardValue.ACE: return 92;
        case CardValue.TEN: return 91;
        case CardValue.KING: return 90;
        case CardValue.OBER: return 89;
        case CardValue.NINE: return 88;
        case CardValue.EIGHT: return 87;
        case CardValue.SEVEN: return 86;
      }
    }
    // Non-trumps rank: A, 10, K, O, 9, 8, 7
    let baseRank = 0;
    switch (card.value) {
      case CardValue.ACE: baseRank = 10; break;
      case CardValue.TEN: baseRank = 9; break;
      case CardValue.KING: baseRank = 8; break;
      case CardValue.OBER: baseRank = 7; break;
      case CardValue.NINE: baseRank = 6; break;
      case CardValue.EIGHT: baseRank = 5; break;
      case CardValue.SEVEN: baseRank = 4; break;
    }
    return baseRank;
  }

  // SAUSPIEL, SOLOS, RAMSCH
  // 1. Obers
  if (card.value === CardValue.OBER) {
    switch (card.suit) {
      case Suit.ACORNS: return 100;
      case Suit.LEAVES: return 99;
      case Suit.HEARTS: return 98;
      case Suit.BELLS: return 97;
    }
  }
  // 2. Unters
  if (card.value === CardValue.UNTER) {
    switch (card.suit) {
      case Suit.ACORNS: return 96;
      case Suit.LEAVES: return 95;
      case Suit.HEARTS: return 94;
      case Suit.BELLS: return 93;
    }
  }

  // 3. Trump Suit cards
  const tSuit = getTrumpSuit(gameType);
  if (card.suit === tSuit) {
    switch (card.value) {
      case CardValue.ACE: return 92;
      case CardValue.TEN: return 91;
      case CardValue.KING: return 90;
      case CardValue.NINE: return 89;
      case CardValue.EIGHT: return 88;
      case CardValue.SEVEN: return 87;
    }
  }

  // 4. Normal Suit cards
  let baseRank = 0;
  switch (card.value) {
    case CardValue.ACE: baseRank = 10; break;
    case CardValue.TEN: baseRank = 9; break;
    case CardValue.KING: baseRank = 8; break;
    case CardValue.NINE: baseRank = 7; break;
    case CardValue.EIGHT: baseRank = 6; break;
    case CardValue.SEVEN: baseRank = 5; break;
  }
  return baseRank;
}

export function getTrumpSuit(gameType: GameType): Suit | null {
  if (
    gameType === GameType.SAUSPIEL ||
    gameType === GameType.SOLO_HEARTS ||
    gameType === GameType.RAMSCH ||
    gameType === GameType.PASSED
  ) {
    return Suit.HEARTS;
  }
  if (gameType === GameType.SOLO_ACORNS) return Suit.ACORNS;
  if (gameType === GameType.SOLO_LEAVES) return Suit.LEAVES;
  if (gameType === GameType.SOLO_BELLS) return Suit.BELLS;
  return null;
}

// Find legal cards a player can play based on the active trick and contract
export function getLegalCards(hand: Card[], currentTrick: Trick | null, contract: Contract | null): Card[] {
  if (!currentTrick || currentTrick.playedCards.length === 0) {
    // Leading a trick
    if (contract && contract.type === GameType.SAUSPIEL && contract.calledSuit) {
      // If the player holds the Called Ace, they cannot play other cards of the called suit to lead
      // (They must lead the Called Ace itself if they choose to lead the called suit)
      const hasCalledAce = hand.some(
        (c) => c.suit === contract.calledSuit && c.value === CardValue.ACE
      );
      if (hasCalledAce) {
        return hand.filter(
          (c) => !(c.suit === contract.calledSuit && c.value !== CardValue.ACE)
        );
      }
    }
    return hand;
  }

  const gameType = contract ? contract.type : GameType.PASSED;
  const wenzSuit = contract ? contract.wenzSuit : undefined;
  const ledCard = currentTrick.playedCards[0].card;
  const ledPlaySuit = getPlaySuit(ledCard, gameType, wenzSuit);

  // Filter cards matching the led play suit (suit or "TRUMP")
  const followingCards = hand.filter((c) => getPlaySuit(c, gameType, wenzSuit) === ledPlaySuit);

  if (followingCards.length > 0) {
    // Must follow suit/trump!
    if (
      contract &&
      contract.type === GameType.SAUSPIEL &&
      contract.calledSuit &&
      ledPlaySuit === contract.calledSuit
    ) {
      // The called suit is led! If the partner holds the Called Ace, they MUST play it now
      const calledAce = followingCards.find((c) => c.value === CardValue.ACE);
      if (calledAce) {
        return [calledAce];
      }
    }
    return followingCards;
  }

  // If suit cannot be followed, player is free to play any card
  return hand;
}

// Determine which played card wins the trick and return player ID
export function determineTrickWinner(playedCards: PlayedCard[], gameType: GameType, wenzSuit?: Suit): string {
  if (playedCards.length === 0) return "";
  const ledCard = playedCards[0].card;
  const ledPlaySuit = getPlaySuit(ledCard, gameType, wenzSuit);

  let winningIdx = 0;
  let winningCard = ledCard;

  for (let i = 1; i < playedCards.length; i++) {
    const nextCard = playedCards[i].card;
    const nextPlaySuit = getPlaySuit(nextCard, gameType, wenzSuit);

    if (isTrump(winningCard, gameType, wenzSuit)) {
      if (isTrump(nextCard, gameType, wenzSuit)) {
        if (getCardRank(nextCard, gameType, wenzSuit) > getCardRank(winningCard, gameType, wenzSuit)) {
          winningCard = nextCard;
          winningIdx = i;
        }
      }
    } else {
      if (isTrump(nextCard, gameType, wenzSuit)) {
        winningCard = nextCard;
        winningIdx = i;
      } else if (nextPlaySuit === ledPlaySuit) {
        if (getCardRank(nextCard, gameType, wenzSuit) > getCardRank(winningCard, gameType, wenzSuit)) {
          winningCard = nextCard;
          winningIdx = i;
        }
      }
    }
  }

  return playedCards[winningIdx].playerId;
}

// Count card points in a set of cards
export function countPoints(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + c.points, 0);
}

// Get German/Bavarian translated name of a suit
export function getSuitLabel(suit: Suit): string {
  switch (suit) {
    case Suit.ACORNS: return "Eichel (Acorns)";
    case Suit.LEAVES: return "Gras (Leaves)";
    case Suit.HEARTS: return "Herz (Hearts)";
    case Suit.BELLS: return "Schellen (Bells)";
  }
}

// Get German/Bavarian card label
export function getCardLabel(card: Card): string {
  let valStr = card.value as string;
  if (card.value === CardValue.UNTER) valStr = "Unter (Jack)";
  if (card.value === CardValue.OBER) valStr = "Ober (Queen)";
  if (card.value === CardValue.ACE) valStr = "Ass (Ace)";
  if (card.value === CardValue.KING) valStr = "König (King)";
  
  const suitEmoji = getSuitEmoji(card.suit);
  return `${suitEmoji} ${valStr}`;
}

export function getSuitEmoji(suit: Suit): string {
  switch (suit) {
    case Suit.ACORNS: return "🌰";
    case Suit.LEAVES: return "🍃";
    case Suit.HEARTS: return "❤️";
    case Suit.BELLS: return "🔔";
  }
}

// AI Bidding Logic
export function getAIBid(
  player: Player,
  existingBids: { playerId: string; choice: { type: GameType; calledSuit?: Suit } | null }[]
): { type: GameType; calledSuit?: Suit } | null {
  const hand = player.cards;
  
  // Count Obers and Unters
  const obers = hand.filter((c) => c.value === CardValue.OBER);
  const unters = hand.filter((c) => c.value === CardValue.UNTER);
  const hearts = hand.filter((c) => c.suit === Suit.HEARTS && c.value !== CardValue.OBER && c.value !== CardValue.UNTER);
  
  const totalTrumpsSauspiel = obers.length + unters.length + hearts.length;

  // Evaluate if AI can play Solo or Wenz (Needs 5+ strong trumps)
  if (obers.length >= 2 && obers.some((c) => c.suit === Suit.ACORNS) && totalTrumpsSauspiel >= 5) {
    // Let's call Solo Hearts if Hearts are strong, or another suit
    const suits = [Suit.HEARTS, Suit.ACORNS, Suit.LEAVES, Suit.BELLS];
    let bestSoloSuit = Suit.HEARTS;
    let maxCount = 0;
    for (const s of suits) {
      const count = hand.filter((c) => c.suit === s && c.value !== CardValue.OBER && c.value !== CardValue.UNTER).length;
      if (count > maxCount) {
        maxCount = count;
        bestSoloSuit = s;
      }
    }

    if (bestSoloSuit === Suit.HEARTS) return { type: GameType.SOLO_HEARTS };
    if (bestSoloSuit === Suit.ACORNS) return { type: GameType.SOLO_ACORNS };
    if (bestSoloSuit === Suit.LEAVES) return { type: GameType.SOLO_LEAVES };
    if (bestSoloSuit === Suit.BELLS) return { type: GameType.SOLO_BELLS };
  }

  // Wenz needs strong Unters
  if (unters.length >= 3) {
    return { type: GameType.WENZ };
  }

  // Sauspiel: Caller needs at least 4 trumps (Obers/Unters/Hearts)
  // and must possess a card of a suit (A, 10, K, 9, 8, 7) but NOT the Ace of that suit
  if (totalTrumpsSauspiel >= 4) {
    const callableSuits = [Suit.ACORNS, Suit.LEAVES, Suit.BELLS];
    for (const suit of callableSuits) {
      // Obers and Unters are trumps, they do not count as suit cards for calling
      const hasCardsOfSuit = hand.some((c) => c.suit === suit && c.value !== CardValue.OBER && c.value !== CardValue.UNTER);
      const hasAceOfSuit = hand.some((c) => c.suit === suit && c.value === CardValue.ACE);
      const isTrumpInSauspiel = false; // Callable suits are non-trumps

      if (hasCardsOfSuit && !hasAceOfSuit) {
        return { type: GameType.SAUSPIEL, calledSuit: suit };
      }
    }
  }

  return null;
}

// AI Play Engine
export function getAICardPlay(
  player: Player,
  currentTrick: Trick | null,
  contract: Contract | null,
  difficulty: Difficulty = Difficulty.MEDIUM
): Card {
  const legalCards = getLegalCards(player.cards, currentTrick, contract);
  if (legalCards.length === 1) return legalCards[0];

  const gameType = contract ? contract.type : GameType.PASSED;
  const wenzSuit = contract ? contract.wenzSuit : undefined;

  const isTrumpLocal = (c: Card) => isTrump(c, gameType, wenzSuit);
  const getCardRankLocal = (c: Card) => getCardRank(c, gameType, wenzSuit);
  const getPlaySuitLocal = (c: Card) => getPlaySuit(c, gameType, wenzSuit);
  const determineTrickWinnerLocal = (played: PlayedCard[]) => determineTrickWinner(played, gameType, wenzSuit);

  // --- EASY AI ---
  if (difficulty === Difficulty.EASY) {
    // Just picks a random legal card
    return legalCards[Math.floor(Math.random() * legalCards.length)];
  }

  // --- MEDIUM & HARD AI COMMON ANALYSIS ---
  const isLead = !currentTrick || currentTrick.playedCards.length === 0;

  if (isLead) {
    // AI is leading the trick
    if (contract && (contract.declarerId === player.id || contract.partnerId === player.id)) {
      // Declarer or partner leading. Play a trump if we have strong ones to draw out trumps,
      // or lead a strong card (Ace) in a non-trump suit.
      const trumps = legalCards.filter(isTrumpLocal);
      const nonTrumps = legalCards.filter((c) => !isTrumpLocal(c));

      if (difficulty === Difficulty.HARD && trumps.length >= 3) {
        // Lead highest trump to bleed defenders
        return trumps.reduce((max, c) => getCardRankLocal(c) > getCardRankLocal(max) ? c : max, trumps[0]);
      }

      // Try leading a non-trump Ace if we have it
      const nonTrumpAces = nonTrumps.filter((c) => c.value === CardValue.ACE);
      if (nonTrumpAces.length > 0) return nonTrumpAces[0];

      // Otherwise play a medium card
      return legalCards[Math.floor(legalCards.length / 2)];
    } else {
      // Defender leading. Play safe, lead a small non-trump
      const nonTrumps = legalCards.filter((c) => !isTrumpLocal(c));
      if (nonTrumps.length > 0) {
        // Play lowest non-trump (7, 8, 9)
        return nonTrumps.reduce((min, c) => getCardRankLocal(c) < getCardRankLocal(min) ? c : min, nonTrumps[0]);
      }
      return legalCards[Math.floor(Math.random() * legalCards.length)];
    }
  }

  // AI is responding in a trick that has cards played already
  const ledCard = currentTrick.playedCards[0].card;
  const ledPlaySuit = getPlaySuitLocal(ledCard);

  // Find who is winning right now
  const winningPlayerId = determineTrickWinnerLocal(currentTrick.playedCards);
  const currentPoints = countPoints(currentTrick.playedCards.map((p) => p.card));

  // Determine relationship to winning player
  let isPartnerWinning = false;
  if (contract) {
    if (contract.type === GameType.SAUSPIEL) {
      const myTeam = (contract.declarerId === player.id || contract.partnerId === player.id) ? "DECLARER" : "DEFENDER";
      const winnerTeam = (contract.declarerId === winningPlayerId || contract.partnerId === winningPlayerId) ? "DECLARER" : "DEFENDER";
      isPartnerWinning = (myTeam === winnerTeam && winningPlayerId !== player.id);
    } else {
      // Solo or Wenz: Declarer plays solo, defenders are all partners
      const isWinnerDeclarer = winningPlayerId === contract.declarerId;
      const isMeDeclarer = player.id === contract.declarerId;
      isPartnerWinning = (!isMeDeclarer && !isWinnerDeclarer && winningPlayerId !== player.id);
    }
  }

  // Filter legal cards into trumps and non-trumps
  const trumps = legalCards.filter(isTrumpLocal);
  const nonTrumps = legalCards.filter((c) => !isTrumpLocal(c));

  if (isPartnerWinning) {
    // Partner is already winning the trick!
    // Try to "schmieren" (play high points card to grease the trick)
    const pointsCards = legalCards.filter((c) => c.points >= 4);
    if (pointsCards.length > 0) {
      // Discard highest point non-trump or weak trump to secure partner points
      return pointsCards.reduce((max, c) => c.points > max.points ? c : max, pointsCards[0]);
    }
    // Else play lowest card to preserve high cards
    return legalCards.reduce((min, c) => getCardRankLocal(c) < getCardRankLocal(min) ? c : min, legalCards[0]);
  }

  // Opponent or nobody is winning, or it's up to us to beat them
  // Check if we can beat the current winning card
  const cardsThatBeatWinner = legalCards.filter((c) => {
    const mockTrick = [...currentTrick.playedCards, { playerId: player.id, card: c }];
    return determineTrickWinnerLocal(mockTrick) === player.id;
  });

  if (cardsThatBeatWinner.length > 0) {
    // We have cards that can take the trick!
    if (difficulty === Difficulty.HARD && currentPoints >= 10) {
      // Hard AI: Take trick if there are many points at stake, using the lowest winning card
      return cardsThatBeatWinner.reduce((min, c) => getCardRankLocal(c) < getCardRankLocal(min) ? c : min, cardsThatBeatWinner[0]);
    } else if (difficulty === Difficulty.MEDIUM) {
      // Medium AI: Plays highest card that beats winner to secure it
      return cardsThatBeatWinner.reduce((max, c) => getCardRankLocal(c) > getCardRankLocal(max) ? c : max, cardsThatBeatWinner[0]);
    }
  }

  // If we can't beat the winner, or choose not to: discard lowest card
  return legalCards.reduce((min, c) => getCardRankLocal(c) < getCardRankLocal(min) ? c : min, legalCards[0]);
}
