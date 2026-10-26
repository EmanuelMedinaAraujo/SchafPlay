/** Chapters 1–3: the game in a nutshell, the cards and the trump order. */

import { useEffect, useState } from "react";
import ManualCard, { CardCode, CardGroup, ManualSuit, SUITS, suitName } from "./ManualCard";
import { ChapterProps, Note } from "./parts";

const BASE = import.meta.env.BASE_URL;

/**
 * The intro video, shown only once its poster loads: a missing or broken
 * file hides the whole block instead of leaving an empty player behind.
 */
function IntroVideo({ language }: ChapterProps) {
  const [status, setStatus] = useState<"probing" | "ok" | "failed">("probing");
  const poster = `${BASE}manual/intro-poster-${language}.jpg`;

  useEffect(() => {
    const probe = new Image();
    probe.onload = () => setStatus((current) => (current === "probing" ? "ok" : current));
    probe.onerror = () => setStatus("failed");
    probe.src = poster;
    return () => {
      probe.onload = null;
      probe.onerror = null;
    };
  }, [poster]);

  if (status !== "ok") return null;
  const fail = () => setStatus("failed");

  return (
    <figure className="manual-video">
      <video key={language} controls playsInline preload="none" poster={poster} onError={fail}>
        <source src={`${BASE}manual/intro-${language}.mp4`} type="video/mp4" onError={fail} />
      </video>
      <figcaption>{language === "de" ? "Schafkopf in 47 Sekunden" : "Schafkopf in 47 seconds"}</figcaption>
    </figure>
  );
}

export function OverviewChapter({ language }: ChapterProps) {
  const de = language === "de";
  const facts = de
    ? [["4", "Spieler"], ["32", "Karten"], ["8", "Stiche"], ["61", "von 120 Augen"]]
    : [["4", "players"], ["32", "cards"], ["8", "tricks"], ["61", "of 120 Augen"]];

  return (
    <>
      <div className="manual-hero">
        <IntroVideo language={language} />
        <div className="manual-hero-text">
          <h4 className="manual-kicker">{de ? "Schafkopf in aller Kürze" : "Schafkopf in a nutshell"}</h4>
          {de ? (
            <p className="manual-lead">
              Vier Leute spielen mit 32 Karten, meistens <strong>zwei gegen zwei</strong> – wer mit wem spielt, wird jede Runde
              neu ausgemacht. Reihum legt jeder eine Karte, die stärkste gewinnt den <strong>Stich</strong>. Am Ende zählt jede
              Seite die <strong>Augen</strong> in ihren Stichen: Die Seite, die das Spiel angesagt hat, braucht <strong>61 von 120</strong>.
            </p>
          ) : (
            <p className="manual-lead">
              Four people play with 32 cards, usually <strong>two against two</strong> – who plays with whom is settled anew
              every round. In turn everyone plays one card, and the strongest one takes the <strong>trick</strong>. At the end
              each side counts the <strong>Augen</strong> (card points) in its tricks: the side that announced the game needs{" "}
              <strong>61 of 120</strong>.
            </p>
          )}
        </div>
      </div>

      <ul className="manual-facts" aria-label={de ? "Die Zahlen" : "The numbers"}>
        {facts.map(([value, label]) => (
          <li key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <Note label={de ? "Keine Angst vor Fehlern" : "Don't worry about mistakes"}>
        {de
          ? "SchafPlay kennt die Regeln: Tippst du eine Karte an, die du nicht spielen darfst, werden alle verbotenen Karten ausgegraut. Ausprobieren ist also der schnellste Weg zum Lernen."
          : "SchafPlay knows the rules: tap a card you may not play and every forbidden card is greyed out. Trying things out is the quickest way to learn."}
      </Note>

      <p>
        {de
          ? "Du sitzt unten. Im Solo-Modus spielen drei KI-Mitspieler mit, zu zweit sitzt die zweite Person dir gegenüber und die KI übernimmt die anderen beiden Plätze. Die nächsten Kapitel erklären alles der Reihe nach – oder spring über die Leiste direkt hin."
          : "You sit at the bottom. In solo mode three AI players join you; with a friend, your friend sits opposite you and the AI takes the other two seats. The next chapters explain everything in order – or jump straight there from the side bar."}
      </p>
    </>
  );
}

const AUGEN: Array<[CardCode, number]> = [
  ["hearts-a", 11],
  ["hearts-10", 10],
  ["hearts-k", 4],
  ["hearts-o", 3],
  ["hearts-u", 2],
  ["hearts-9", 0],
  ["hearts-8", 0],
  ["hearts-7", 0],
];

export function CardsChapter({ language }: ChapterProps) {
  const de = language === "de";

  return (
    <>
      <h4>{de ? "Vier Farben" : "Four suits"}</h4>
      <p>
        {de
          ? "Gespielt wird mit dem bayerischen Blatt. Jede Farbe hat ihr eigenes Zeichen:"
          : "Schafkopf uses the Bavarian deck. Each suit has its own symbol (the app keeps the German names in brackets):"}
      </p>
      <div className="manual-card-row">
        {SUITS.map((suit) => (
          <ManualCard
            key={suit}
            code={`${suit}-a`}
            language={language}
            caption={de ? suitName(suit, "de") : `${suitName(suit, "en")} (${suitName(suit, "de")})`}
          />
        ))}
      </div>

      <h4>{de ? "Acht Karten pro Farbe – und was sie zählen" : "Eight cards per suit – and what they count"}</h4>
      <p>
        {de
          ? "Die Punkte einer Karte heißen Augen. Nur fünf Karten zählen überhaupt etwas:"
          : "The points on a card are called Augen (“eyes”). Only five of the cards count at all:"}
      </p>
      <div className="manual-card-row is-augen">
        {AUGEN.map(([code, augen]) => (
          <ManualCard key={code} code={code} language={language} caption={`${augen}`} />
        ))}
      </div>
      <p className="manual-small">
        {de
          ? "Von links: Sau (das Ass), Zehn, König, Ober, Unter, Neun, Acht, Sieben. Die Zahl darunter sind die Augen."
          : "From the left: Sau (the Ace), 10, King, Ober, Unter, 9, 8, 7. The number below is its Augen."}
      </p>

      <Note label={de ? "Merke" : "Remember"}>
        {de ? (
          <>
            Jede Farbe ist 30 Augen wert, alle vier zusammen <strong>120</strong>. Sau und Zehn bringen allein 21 davon – um
            sie dreht sich das ganze Spiel.
          </>
        ) : (
          <>
            Each suit is worth 30 Augen, all four together <strong>120</strong>. The Sau and the 10 alone make 21 of them – the
            whole game revolves around them.
          </>
        )}
      </Note>
    </>
  );
}

type Ladder = "normal" | "solo" | "wenz";

const PLAIN_RANKS = ["a", "10", "k", "9", "8", "7"] as const;
const WENZ_PLAIN_RANKS = ["a", "10", "k", "o", "9", "8", "7"] as const;

export function TrumpsChapter({ language }: ChapterProps) {
  const de = language === "de";
  const [ladder, setLadder] = useState<Ladder>("normal");
  const [soloSuit, setSoloSuit] = useState<ManualSuit>("acorns");

  const trumpSuit: ManualSuit | null = ladder === "normal" ? "hearts" : ladder === "solo" ? soloSuit : null;
  // A plain suit to show "everything else" with — never the trump suit.
  const plainSuit: ManualSuit = trumpSuit === "leaves" ? "bells" : "leaves";
  let rank = 0;
  const next = () => (rank += 1);

  const options: Array<[Ladder, string]> = de
    ? [["normal", "Sauspiel"], ["solo", "Farbsolo"], ["wenz", "Wenz"]]
    : [["normal", "Sauspiel"], ["solo", "Suit solo"], ["wenz", "Wenz"]];

  return (
    <>
      <p>
        {de ? (
          <>
            <strong>Trumpf sticht alles.</strong> Ein Trumpf schlägt jede Karte, die kein Trumpf ist – auch der kleinste
            Trumpf die dickste Sau. Welche Karten Trumpf sind, hängt vom Spiel ab:
          </>
        ) : (
          <>
            <strong>Trump beats everything.</strong> A trump beats any card that is not a trump – even the lowest trump beats
            the fattest Sau. Which cards are trumps depends on the game:
          </>
        )}
      </p>

      <div className="manual-segment" role="group" aria-label={de ? "Spiel wählen" : "Choose a game"}>
        {options.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={ladder === value} onClick={() => setLadder(value)}>
            {label}
          </button>
        ))}
      </div>

      {ladder === "solo" && (
        <div className="manual-segment is-small" role="group" aria-label={de ? "Trumpffarbe" : "Trump suit"}>
          {SUITS.map((suit) => (
            <button key={suit} type="button" aria-pressed={soloSuit === suit} onClick={() => setSoloSuit(suit)}>
              {suitName(suit, language)}
            </button>
          ))}
        </div>
      )}

      <p className="manual-small">
        {ladder === "normal" &&
          (de
            ? "14 Trümpfe: alle Ober, alle Unter und alle Herz. Gilt auch für Herz-Solo und Ramsch."
            : "14 trumps: every Ober, every Unter and every Heart. Also used in the Hearts solo and in Ramsch.")}
        {ladder === "solo" &&
          (soloSuit === "hearts"
            ? de
              ? "Herz-Solo: dieselben 14 Trümpfe wie im Sauspiel – nur spielst du allein."
              : "Hearts solo: the same 14 trumps as in the Sauspiel – you just play alone."
            : de
              ? `14 Trümpfe: alle Ober, alle Unter und alle ${suitName(soloSuit, "de")}. Herz ist hier eine ganz normale Farbe.`
              : `14 trumps: every Ober, every Unter and every ${suitName(soloSuit, "en")} card. Hearts is a plain suit here.`)}
        {ladder === "wenz" &&
          (de
            ? "Nur 4 Trümpfe: die Unter. Die Ober sind normale Farbkarten."
            : "Only 4 trumps: the Unters. The Obers become plain suit cards.")}
      </p>

      <div className="manual-ladder" aria-label={de ? "Trümpfe, vom höchsten zum niedrigsten" : "Trumps, highest to lowest"}>
        {ladder !== "wenz" && (
          <CardGroup label={de ? "Ober" : "Obers"}>
            {SUITS.map((suit) => (
              <ManualCard key={suit} code={`${suit}-o`} language={language} badge={next()} />
            ))}
          </CardGroup>
        )}
        <CardGroup label={de ? "Unter" : "Unters"}>
          {SUITS.map((suit) => (
            <ManualCard key={suit} code={`${suit}-u`} language={language} badge={next()} />
          ))}
        </CardGroup>
        {trumpSuit && (
          <CardGroup label={suitName(trumpSuit, language)}>
            {PLAIN_RANKS.map((value) => (
              <ManualCard key={value} code={`${trumpSuit}-${value}`} language={language} badge={next()} />
            ))}
          </CardGroup>
        )}
      </div>
      <p className="manual-small">
        {de
          ? "Die Zahl zeigt den Rang: 1 ist der höchste Trumpf. Ober und Unter gehen immer Eichel, Gras, Herz, Schellen."
          : "The number shows the rank: 1 is the highest trump. Obers and Unters always go Acorns, Leaves, Hearts, Bells."}
      </p>

      <h4>{de ? "Alle anderen Karten" : "Every other card"}</h4>
      <p>
        {de
          ? `Was kein Trumpf ist, gehört zu seiner Farbe und zählt nur in dieser Farbe – hier ${suitName(plainSuit, "de")}:`
          : `A card that is not a trump belongs to its suit and only counts within it – here ${suitName(plainSuit, "en")}:`}
      </p>
      <div className="manual-card-row">
        {(ladder === "wenz" ? WENZ_PLAIN_RANKS : PLAIN_RANKS).map((value) => (
          <ManualCard key={value} code={`${plainSuit}-${value}`} language={language} />
        ))}
      </div>
      <Note kind="warn" label={de ? "Achtung" : "Watch out"}>
        {de
          ? "Die Zehn ist höher als der König! Und Ober und Unter fehlen in dieser Reihe, weil sie Trumpf sind – außer im Wenz, wo der Ober zwischen König und Neun steht."
          : "The 10 ranks above the King! And the Ober and Unter are missing from this row because they are trumps – except in the Wenz, where the Ober sits between the King and the 9."}
      </Note>
    </>
  );
}
