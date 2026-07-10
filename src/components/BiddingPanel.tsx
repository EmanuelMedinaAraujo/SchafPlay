import { useState } from "react";
import { GameState, GameType, Language, PlayerAction, PlayerActionType, Suit } from "../types";
import { canOverrideBid, getCallableSuits, isRetreatAllowed } from "../game/rules";
import { gameLabel, translations } from "../lib/i18n";

interface BiddingPanelProps {
  state: GameState;
  language: Language;
  myPlayerId: string;
  onAction: (action: PlayerAction) => void;
}

export default function BiddingPanel({ state, language, myPlayerId, onAction }: BiddingPanelProps) {
  const t = translations[language];
  const [tout, setTout] = useState(false);
  const bidding = state.biddingState;
  const activeId = state.players[state.activePlayerIdx]?.id;
  const isMyTurn = activeId === myPlayerId;
  const me = state.players.find((player) => player.id === myPlayerId);
  if (!bidding || !me) return null;

  if (bidding.phase === "WILL_PHASE") {
    return (
      <section className="bidding-panel">
        <h2>{t.willPhaseTitle}</h2>
        <div className="bid-status">
          {state.players.map((player) => {
            const bid = bidding.willBids.find((item) => item.playerId === player.id);
            const status = bid ? (bid.wantsToPlay ? "✋ " + t.willPlay : "– " + t.pass) : player.id === activeId ? "🤔 …" : "…";
            return (
              <span key={player.id} className={player.id === activeId ? "active" : ""}>
                <strong>{player.name}</strong>
                {status}
              </span>
            );
          })}
        </div>
        {isMyTurn && (
          <div className="button-row">
            <button
              className="primary-button"
              onClick={() => onAction({ type: PlayerActionType.BID_WILL, playerId: myPlayerId, data: { wantsToPlay: true } })}
              type="button"
            >
              {t.willPlay}
            </button>
            <button
              className="secondary-button"
              onClick={() => onAction({ type: PlayerActionType.BID_WILL, playerId: myPlayerId, data: { wantsToPlay: false } })}
              type="button"
            >
              {t.pass}
            </button>
          </div>
        )}
      </section>
    );
  }

  // --- DECLARE_PHASE ---
  const high = bidding.highBid?.declaration ?? null;
  const iAmInterested = bidding.interestedPlayerIds.includes(myPlayerId);
  const iHoldHighBid = bidding.highBid?.playerId === myPlayerId;
  // "Doch passen" (#24): retreat is only offered once a Wenz or Solo stands.
  // Over a Sauspiel (or with no bid yet) the player must top it, not bow out.
  const canRetreat = isRetreatAllowed(high);
  const activeName = state.players[state.activePlayerIdx]?.name ?? "";

  // A suit is callable when I hold a plain card of it but not its Ace.
  const callableSuits = getCallableSuits(me.cards);

  const declare = (type: GameType, calledSuit?: Suit, isTout = false) =>
    onAction({ type: PlayerActionType.BID_DECLARE, playerId: myPlayerId, data: { declaration: { type, calledSuit, isTout } } });

  const canDeclare = (type: GameType, isTout = false) => canOverrideBid(high, { type, isTout });

  return (
    <section className="bidding-panel">
      <h2>{t.declarePhaseTitle}</h2>
      {high && (
        <p className="muted">
          {t.currentHighBid}: <strong>{gameLabel(language, high.type, high.calledSuit, high.isTout)}</strong>
          {" – "}
          {state.players.find((player) => player.id === bidding.highBid?.playerId)?.name}
        </p>
      )}
      {!isMyTurn && (
        <p className="muted pulse-soft">
          {t.waitingFor} {activeName} …
        </p>
      )}
      {isMyTurn && iAmInterested && (
        <>
          <div className="bid-grid">
            {[Suit.ACORNS, Suit.LEAVES, Suit.BELLS].map((suit) => (
              <button
                key={suit}
                disabled={!callableSuits.includes(suit) || !canDeclare(GameType.SAUSPIEL)}
                onClick={() => declare(GameType.SAUSPIEL, suit)}
                type="button"
              >
                {gameLabel(language, GameType.SAUSPIEL, suit)}
              </button>
            ))}
            <button disabled={!canDeclare(GameType.WENZ, tout)} onClick={() => declare(GameType.WENZ, undefined, tout)} type="button">
              {gameLabel(language, GameType.WENZ, undefined, tout)}
            </button>
            {[GameType.SOLO_ACORNS, GameType.SOLO_LEAVES, GameType.SOLO_HEARTS, GameType.SOLO_BELLS].map((solo) => (
              <button key={solo} disabled={!canDeclare(solo, tout)} onClick={() => declare(solo, undefined, tout)} type="button">
                {gameLabel(language, solo, undefined, tout)}
              </button>
            ))}
          </div>
          <div className="button-row">
            <label className={`tout-toggle ${tout ? "on" : ""}`}>
              <input type="checkbox" checked={tout} onChange={(event) => setTout(event.target.checked)} />
              🏆 {t.tout}
            </label>
            {!iHoldHighBid && canRetreat && (
              <button
                className="secondary-button"
                onClick={() => onAction({ type: PlayerActionType.BID_RETREAT, playerId: myPlayerId })}
                type="button"
              >
                {t.retreat}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
