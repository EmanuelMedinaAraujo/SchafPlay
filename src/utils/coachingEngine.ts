/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Card, Trick, Contract, AIAnalysis, GameType, Suit, CardValue } from "../types";
import { getLegalCards, isTrump, determineTrickWinner, getPlaySuit, getSuitEmoji } from "./gameLogic";

/**
 * Runs a deterministic multi-agent strategy and statistical simulation of the played card game.
 * Evaluates play choices based on specialized subagents:
 * 1. Bidding / Opening Subagent
 * 2. Trump Command Subagent
 * 3. Smearing & Discard (Schmieren) Subagent
 * 4. Defensive Guard Subagent
 */
export function runSubagentsAnalysis(
  playerName: string,
  playerHand: Card[],
  tricks: Trick[],
  contract: Contract | null
): AIAnalysis {
  if (!contract || tricks.length === 0) {
    return {
      trickAnalysis: [],
      overallFeedback: "No contract or completed tricks to analyze yet. Play a full game first!",
      rating: "Average"
    };
  }

  const gameType = contract.type;
  const wenzSuit = contract.wenzSuit;
  const userPlayedCards: string[] = [];
  const trickAnalysis: {
    trickNumber: number;
    userAction: string;
    aiRecommendation: string;
    isOptimal: boolean;
    reasoning: string;
  }[] = [];

  let optimalMovesCount = 0;

  for (let k = 0; k < tricks.length; k++) {
    const trick = tricks[k];
    const trickNumber = k + 1;
    const userPlay = trick.playedCards.find(pc => pc.playerId === "p1");
    if (!userPlay) continue;

    // Reconstruct hand at this exact trick point
    const handAtTrick = playerHand.filter(c => !userPlayedCards.includes(c.id));
    
    // Add to played stack for future tricks
    userPlayedCards.push(userPlay.card.id);

    // Reconstruct trick up to the user's turn
    const playedBeforeUser: typeof trick.playedCards = [];
    for (const pc of trick.playedCards) {
      if (pc.playerId === "p1") break;
      playedBeforeUser.push(pc);
    }

    const mockTrick: Trick = {
      id: trick.id,
      leaderId: trick.leaderId,
      playedCards: playedBeforeUser,
    };

    // Calculate legal cards at this moment
    const legalCards = getLegalCards(handAtTrick, mockTrick, contract);
    if (legalCards.length === 0) continue;

    // Default choice is the first legal card
    let optimalCard = legalCards[0];
    let subagentName = "Bavarian Strategy Subagent";
    let reasoning = "";
    
    const ledCard = playedBeforeUser[0]?.card;
    const isUserLeader = trick.leaderId === "p1";
    const userIsDeclarerSide = contract.declarerId === "p1" || contract.partnerId === "p1";

    if (isUserLeader) {
      // User is leading the trick
      const trumpsInHand = legalCards.filter(c => isTrump(c, gameType, wenzSuit));
      const acesInHand = legalCards.filter(c => c.value === CardValue.ACE && !isTrump(c, gameType, wenzSuit));
      
      if (userIsDeclarerSide) {
        subagentName = "Trump Command Subagent";
        if (trumpsInHand.length >= 3) {
          // Sort trumps by strength
          // In Schafkopf, Obers > Unters > suit trumps.
          // For simplicity we can sort by points or simple heuristic
          const highestTrump = [...trumpsInHand].sort((a, b) => b.points - a.points)[0];
          optimalCard = highestTrump || legalCards[0];
          reasoning = "As the offensive declarer team, leading a strong trump card is optimal to strip the defensive players of their trumps and draw out their power cards.";
        } else if (acesInHand.length > 0) {
          optimalCard = acesInHand[0];
          reasoning = "Leading a clean non-trump Ace (Sauspiel Ace or Solo Ace) is the most effective way to secure a full 11-point trick early when you hold initiative.";
        } else {
          optimalCard = legalCards[0];
          reasoning = "Leading a low non-trump card is acceptable here to save your trump card strength for taking later defensive tricks.";
        }
      } else {
        subagentName = "Defensive Guard Subagent";
        if (acesInHand.length > 0) {
          optimalCard = acesInHand[0];
          reasoning = "Leading an Ace defensively is highly optimal to secure high card points immediately before the declarer gets a chance to play trump cards.";
        } else {
          // Play a non-trump card of a suit we hold to probe opponents
          const nonTrumps = legalCards.filter(c => !isTrump(c, gameType, wenzSuit));
          optimalCard = nonTrumps[0] || legalCards[0];
          reasoning = "Playing a low non-trump card is the best defensive lead to avoid helping the declarer side clear out your trumps.";
        }
      }
    } else {
      // User is following/responding
      const winningIdBeforeUser = determineTrickWinner(mockTrick.playedCards, gameType, wenzSuit);
      
      // Is our partner winning?
      // Partner in Sauspiel is contract.partnerId. If user is defender, anyone who is not p1 and not declarer is partner.
      let isPartnerWinning = false;
      if (winningIdBeforeUser && winningIdBeforeUser !== "p1") {
        if (userIsDeclarerSide) {
          isPartnerWinning = winningIdBeforeUser === contract.partnerId || winningIdBeforeUser === contract.declarerId;
        } else {
          isPartnerWinning = winningIdBeforeUser !== contract.declarerId;
        }
      }

      const cannotFollowSuit = ledCard && (getPlaySuit(userPlay.card, gameType, wenzSuit) !== getPlaySuit(ledCard, gameType, wenzSuit));
      
      if (cannotFollowSuit) {
        subagentName = "Smearing & Discard Subagent";
        if (isPartnerWinning) {
          // Partner is taking this! Smear high points (Ace = 11, 10 = 10)
          const highPoints = legalCards.filter(c => c.value === CardValue.ACE || c.value === CardValue.TEN);
          if (highPoints.length > 0) {
            optimalCard = highPoints.sort((a, b) => b.points - a.points)[0];
            reasoning = "Excellent! Your partner is winning this trick, so smearing (schmieren) high-value cards (Ace or 10) is the optimal strategy to load points into your team's score.";
          } else {
            // Discard highest point card in general
            optimalCard = [...legalCards].sort((a, b) => b.points - a.points)[0];
            reasoning = "Since your partner is guaranteed to win this trick, feeding them card points (König or Ober) is the best choice.";
          }
        } else {
          // Opponents are taking this trick! Play junk (7, 8, 9)
          const junk = legalCards.filter(c => c.points === 0);
          if (junk.length > 0) {
            optimalCard = junk[0];
            reasoning = "Since the opponents are taking this trick, discarding a zero-point card (7, 8, or 9) is critical to avoid feeding points to their side.";
          } else {
            optimalCard = [...legalCards].sort((a, b) => a.points - b.points)[0];
            reasoning = "Since opponents are taking this trick and you have no zero-point cards, playing your lowest point card is safest.";
          }
        }
      } else {
        // Must follow suit/trump!
        subagentName = "Trump Command Subagent";
        
        // Can we win?
        const winningCards = legalCards.filter(c => {
          const testTrick = [...playedBeforeUser, { playerId: "p1", card: c }];
          return determineTrickWinner(testTrick, gameType, wenzSuit) === "p1";
        });

        if (winningCards.length > 0 && !isPartnerWinning) {
          // Beat them with the lowest possible winning card (efficiency!)
          optimalCard = winningCards.sort((a, b) => a.points - b.points)[0];
          reasoning = `Beating the opponent with the lowest possible winning card (${optimalCard.value}) is the optimal way to secure this trick and control the next lead.`;
        } else {
          // We can't win, or our partner is already taking the trick
          // Play the lowest possible card to save our power cards for later
          optimalCard = [...legalCards].sort((a, b) => a.points - b.points)[0];
          reasoning = isPartnerWinning
            ? "Your partner is already winning this trick, so playing a low card saves your high-value cards for future rounds."
            : "You cannot beat the current leading card. Playing your lowest value card preserves your high cards for your own leads.";
        }
      }
    }

    // Safety fallback
    if (!legalCards.some(c => c.id === optimalCard.id)) {
      optimalCard = legalCards[0];
    }

    const isOptimal = userPlay.card.id === optimalCard.id;
    if (isOptimal) optimalMovesCount++;

    const userCardLabel = `${userPlay.card.value}${getSuitEmoji(userPlay.card.suit)}`;
    const aiCardLabel = `${optimalCard.value}${getSuitEmoji(optimalCard.suit)}`;

    trickAnalysis.push({
      trickNumber,
      userAction: `Played ${userCardLabel} (${subagentName})`,
      aiRecommendation: isOptimal ? "Optimal Play!" : `Play ${aiCardLabel}`,
      isOptimal,
      reasoning: isOptimal 
        ? `${reasoning} You made the correct play.` 
        : `The ${subagentName} recommends playing ${aiCardLabel}. ${reasoning}`,
    });
  }

  // Calculate stats ratio
  const optimalRatio = tricks.length > 0 ? optimalMovesCount / tricks.length : 0;
  let rating: "Excellent" | "Good" | "Average" | "Needs Improvement" = "Average";
  let overallFeedback = "";

  if (optimalRatio >= 0.8) {
    rating = "Excellent";
    overallFeedback = `Outstanding round, ${playerName}! Your plays align perfectly with high-level Bavarian Schafkopf tactics. The Trump and Smearing subagents detected almost zero errors. Keep playing like this and you'll dominate any Bavarian tavern!`;
  } else if (optimalRatio >= 0.6) {
    rating = "Good";
    overallFeedback = `Solid performance, ${playerName}. You made the right calls on most tricks. A couple of small adjustments in your smearing choices (schmieren) or trump leading could push you to the 'Großmeister' tier. Review the recommendations below!`;
  } else if (optimalRatio >= 0.4) {
    rating = "Average";
    overallFeedback = `An acceptable round, ${playerName}. You followed suit properly, but missed key strategic opportunities. Be sure to smear points (Aces/10s) when your partner wins, and save your high-value cards when the opponents are taking the trick.`;
  } else {
    rating = "Needs Improvement";
    overallFeedback = `Tough game, ${playerName}. The subagents detected multiple strategic slip-ups. Remember, in Schafkopf, card economy is everything. Avoid feeding points to opponents and work closely with your partner in Sauspiel. Study the guide and try again!`;
  }

  return {
    trickAnalysis,
    overallFeedback,
    rating
  };
}
