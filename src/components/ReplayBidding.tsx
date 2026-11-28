import { replayDecisions } from "../analysis/replaySuggestions";
import { declarationLabel, translations } from "../lib/i18n";
import { GameDeclaration, Language } from "../types";
import { BotIcon } from "./icons";

interface ReplayBiddingProps {
  decisions: ReturnType<typeof replayDecisions>;
  playerNames: Map<string, string>;
  language: Language;
}

export default function ReplayBidding({ decisions, playerNames, language }: ReplayBiddingProps) {
  const t = translations[language];
  const willLabel = (wantsToPlay: boolean) => wantsToPlay ? t.willPlay : t.pass;
  const bidLabel = (bid: GameDeclaration | null) => bid ? declarationLabel(language, bid) : t.retreat;
  const phases = [
    {
      title: t.willPhaseTitle,
      rows: decisions.will.map(({ recorded, suggestion }) => ({
        playerId: recorded.playerId,
        recorded: willLabel(recorded.wantsToPlay),
        suggestion: suggestion === undefined ? undefined : willLabel(suggestion),
      })),
    },
    {
      title: t.declarePhaseTitle,
      rows: decisions.declarations.map(({ recorded, suggestion }) => ({
        playerId: recorded.playerId,
        recorded: bidLabel(recorded.declaration),
        suggestion: suggestion === undefined ? undefined : bidLabel(suggestion),
      })),
    },
  ];

  return (
    <section className="replay-bidding" tabIndex={0} aria-label={t.bidding}>
      <table>
        <thead>
          <tr>
            <th scope="col">{t.bidding}</th>
            <th scope="col">{t.replayRecordedBid}</th>
            <th scope="col"><BotIcon size={14} /> {t.replayAiSuggestion}</th>
          </tr>
        </thead>
        {phases.filter(({ rows }) => rows.length > 0).map(({ title, rows }) => (
          <tbody key={title}>
            <tr className="replay-bidding-phase"><th scope="rowgroup" colSpan={3}>{title}</th></tr>
            {rows.map(({ playerId, recorded, suggestion }, index) => (
              <tr key={index}>
                <th scope="row">{playerNames.get(playerId)}</th>
                <td>{recorded}</td>
                <td className={suggestion === undefined ? "muted" : "replay-bid-suggestion"}>
                  {suggestion ?? t.replayBidNoSuggestion}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </section>
  );
}
