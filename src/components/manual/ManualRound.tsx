/** Chapters 4–5: how a round goes, and the games you can announce. */

import ManualCard, { CardCode } from "./ManualCard";
import { ChapterProps, More, Note } from "./parts";

export function RoundChapter({ language }: ChapterProps) {
  const de = language === "de";

  const steps = de
    ? [
        ["Geben", "Die App mischt und gibt jedem 8 Karten. Der Geber wechselt jede Runde einen Platz weiter."],
        [
          "Ansagen",
          "Reihum, links vom Geber beginnend, sagt jeder „I dad spuin!“ (ich würde spielen) oder „Weiter“. Wer spielen will, nennt danach sein Spiel – das höchste gewinnt. Daraus ergibt sich, wer zusammenspielt.",
        ],
        [
          "Stiche spielen",
          "Der Spieler links vom Geber spielt die erste Karte aus, die anderen legen reihum je eine dazu. Die stärkste Karte gewinnt den Stich, und wer ihn gewinnt, spielt als Nächstes aus. Das geht acht Stiche lang.",
        ],
        [
          "Zählen",
          "Jede Seite zählt die Augen in ihren Stichen. Mit 61 Augen hat die Spielerseite gewonnen – bei 60 zu 60 gewinnen die Gegner. Danach gibt es Punkte für die Liste (siehe Abrechnung).",
        ],
      ]
    : [
        ["Deal", "The app shuffles and deals 8 cards to everyone. The dealer moves one seat on every round."],
        [
          "Bid",
          "In turn, starting left of the dealer, everyone says “I'd play!” (Bavarian: “I dad spuin!”) or “Pass”. Whoever wants to play then names a game – the highest one wins. That decides who plays with whom.",
        ],
        [
          "Play tricks",
          "The player left of the dealer leads the first card, and the others add one card each in turn. The strongest card takes the trick, and whoever takes it leads next. That goes on for eight tricks.",
        ],
        [
          "Count",
          "Each side counts the Augen in its tricks. With 61 the declaring side has won – at 60 to 60 the defenders win. Then the list gets its score (see Scoring).",
        ],
      ];

  const trick: Array<[CardCode, string, boolean?]> = de
    ? [
        ["leaves-10", "spielt aus"],
        ["leaves-k", "bedient"],
        ["hearts-7", "sticht!", true],
        ["leaves-9", "bedient"],
      ]
    : [
        ["leaves-10", "leads"],
        ["leaves-k", "follows"],
        ["hearts-7", "trumps!", true],
        ["leaves-9", "follows"],
      ];

  return (
    <>
      <ol className="manual-steps">
        {steps.map(([title, text]) => (
          <li key={title}>
            <strong>{title}</strong>
            <span>{text}</span>
          </li>
        ))}
      </ol>

      <More title={de ? "Die Ansage genau erklärt" : "Bidding in detail"}>
        <ul>
          {de ? (
            <>
              <li>Sagen alle „Weiter“, wird zusammengeworfen und neu gegeben (oder Ramsch gespielt, wenn die Hausregel an ist).</li>
              <li>
                Wollen mehrere spielen, nennen sie ihr Spiel der Reihe nach. Ein Spiel überbietet nur ein <em>höheres</em>:
                Sauspiel &lt; Wenz &lt; Solo &lt; Wenz-Tout &lt; Solo-Tout. Bei gleich hohen Spielen behält es, wer früher dran ist.
              </li>
              <li>
                Wer „I dad spuin!“ gesagt hat, muss ein Spiel nennen. Mit „Doch weiter“ aussteigen darfst du erst, wenn schon
                ein Wenz oder Solo angesagt ist.
              </li>
              <li>Ein Sauspiel kannst du nur ansagen, wenn du eine Sau rufen darfst (siehe Die Spiele).</li>
            </>
          ) : (
            <>
              <li>If everyone passes, the cards are thrown in and dealt again (or a Ramsch is played, if that house rule is on).</li>
              <li>
                If several want to play, they name their game in turn. A game is only beaten by a <em>higher</em> one: Sauspiel
                &lt; Wenz &lt; Solo &lt; Wenz Tout &lt; Solo Tout. Between equal games, the player who came first keeps it.
              </li>
              <li>
                Once you said “I'd play!” you have to name a game. You may back out with “Retreat” (“Doch weiter”) only once a
                Wenz or a solo has been announced.
              </li>
              <li>You can only announce a Sauspiel if there is a Sau you are allowed to call (see Game types).</li>
            </>
          )}
        </ul>
      </More>

      <h4>{de ? "Die wichtigste Regel: Bedienen" : "The key rule: follow suit"}</h4>
      <p>
        {de ? (
          <>
            Du <strong>musst die ausgespielte Farbe zugeben</strong>, wenn du sie hast. Wird Trumpf ausgespielt, musst du
            Trumpf zugeben. Nur wenn du nicht bedienen kannst, darfst du frei wählen: mit einem Trumpf <strong>stechen</strong>{" "}
            oder irgendeine Karte abwerfen – gern eine fette, wenn dein Partner den Stich schon hat (<strong>schmieren</strong>).
          </>
        ) : (
          <>
            You <strong>must play the suit that was led</strong> if you have it. If a trump is led, you must play a trump. Only
            if you cannot follow are you free to choose: <strong>trump in</strong> to take the trick, or throw away any card –
            ideally a fat one if your partner is already winning the trick (<strong>schmieren</strong>, “to grease”).
          </>
        )}
      </p>

      <figure className="manual-trick">
        <div className="manual-card-row">
          {trick.map(([code, caption, wins]) => (
            <ManualCard key={code} code={code} language={language} caption={caption} highlight={wins} />
          ))}
        </div>
        <figcaption>
          {de
            ? "Beispiel im Sauspiel: Gras wird ausgespielt. Der Dritte hat kein Gras und sticht mit der Herz-Sieben – der kleinste Trumpf schlägt die Gras-Zehn. Seine Seite bekommt 14 Augen (10 + 4 + 0 + 0)."
            : "Example in a Sauspiel: Leaves is led. The third player has no Leaves and trumps with the Hearts 7 – the lowest trump beats the Leaves 10. Their side gets 14 Augen (10 + 4 + 0 + 0)."}
        </figcaption>
      </figure>

      <Note kind="warn" label={de ? "Stolperfalle" : "Common trap"}>
        <div className="manual-note-with-card">
          <ManualCard code="leaves-o" language={language} />
          <span>
            {de
              ? "Ober und Unter sind Trumpf – sie gehören nicht zu ihrer Farbe. Wird Gras ausgespielt, zählt dein Gras-Ober nicht als Gras. Wird Trumpf ausgespielt, musst du ihn dagegen zugeben, wenn er dein einziger Trumpf ist."
              : "Obers and Unters are trumps – they do not belong to their suit. When Leaves is led, your Leaves Ober does not count as Leaves. When a trump is led, though, you must play it if it is your only trump."}
          </span>
        </div>
      </Note>
    </>
  );
}

interface GameInfo {
  name: string;
  teams: string;
  trumps: string;
  text: string;
  cards: CardCode[];
  extra?: boolean;
}

export function GamesChapter({ language }: ChapterProps) {
  const de = language === "de";

  const games: GameInfo[] = de
    ? [
        {
          name: "Sauspiel",
          teams: "2 gegen 2",
          trumps: "Ober, Unter, Herz",
          text: "Du rufst eine Sau – wer sie hat, ist heimlich dein Partner. Das kleinste und häufigste Spiel.",
          cards: ["acorns-a", "leaves-a", "bells-a"],
        },
        {
          name: "Wenz",
          teams: "1 gegen 3",
          trumps: "nur die 4 Unter",
          text: "Du spielst allein. Ober sind normale Karten – gut mit vielen Untern und Säuen.",
          cards: ["acorns-u", "leaves-u", "hearts-u", "bells-u"],
        },
        {
          name: "Farbsolo",
          teams: "1 gegen 3",
          trumps: "Ober, Unter, deine Farbe",
          text: "Eichel-, Gras-, Herz- oder Schellen-Solo: Du suchst dir die Trumpffarbe aus und spielst allein.",
          cards: ["acorns-o", "acorns-a", "acorns-10"],
        },
        {
          name: "Tout",
          teams: "1 gegen 3",
          trumps: "wie Wenz oder Solo",
          text: "Ein Wenz oder Solo, bei dem du alle acht Stiche machen musst. Ein verlorener Stich – Spiel verloren. Zählt mehr.",
          cards: ["acorns-o", "leaves-o", "hearts-o", "bells-o"],
          extra: true,
        },
      ]
    : [
        {
          name: "Sauspiel",
          teams: "2 vs 2",
          trumps: "Obers, Unters, Hearts",
          text: "You call a Sau (Ace) – whoever holds it is secretly your partner. The lowest and most common game.",
          cards: ["acorns-a", "leaves-a", "bells-a"],
        },
        {
          name: "Wenz",
          teams: "1 vs 3",
          trumps: "only the 4 Unters",
          text: "You play alone. Obers are plain cards – good with lots of Unters and Aces.",
          cards: ["acorns-u", "leaves-u", "hearts-u", "bells-u"],
        },
        {
          name: "Suit solo",
          teams: "1 vs 3",
          trumps: "Obers, Unters, your suit",
          text: "Acorns, Leaves, Hearts or Bells solo: you pick the trump suit and play alone.",
          cards: ["acorns-o", "acorns-a", "acorns-10"],
        },
        {
          name: "Tout",
          teams: "1 vs 3",
          trumps: "as Wenz or solo",
          text: "A Wenz or solo where you must take all eight tricks. Lose one trick and you lose the game. Pays more.",
          cards: ["acorns-o", "leaves-o", "hearts-o", "bells-o"],
          extra: true,
        },
      ];

  return (
    <>
      <p>
        {de
          ? "In der Ansage wählst du eines dieser Spiele. Der Reihe nach werden sie höher – und schwerer."
          : "When bidding you choose one of these games. In this order they rank higher – and get harder."}
      </p>

      <div className="manual-games">
        {games.map((game) => (
          <article key={game.name} className={`manual-game${game.extra ? " is-extra" : ""}`}>
            <header>
              <h4>{game.name}</h4>
              <span className="manual-game-teams">{game.teams}</span>
            </header>
            <div className="manual-game-cards" aria-hidden="true">
              {game.cards.map((code) => (
                <ManualCard key={code} code={code} language={language} />
              ))}
            </div>
            <p className="manual-game-trumps">
              <span>{de ? "Trumpf:" : "Trumps:"}</span> {game.trumps}
            </p>
            <p>{game.text}</p>
          </article>
        ))}
      </div>

      <p className="manual-small">
        {de
          ? "Tout schaltest du in der Ansage mit dem Tout-Schalter ein. Ein Sauspiel-Tout gibt es nicht. Ramsch ist kein Spiel zum Ansagen – siehe Abrechnung › Hausregeln."
          : "Turn Tout on with the Tout switch when bidding. There is no Sauspiel Tout. Ramsch is not a game you announce – see Scoring › House rules."}
      </p>

      <More title={de ? "Sauspiel: Welche Sau darf ich rufen?" : "Sauspiel: which Sau may I call?"}>
        <ul>
          {de ? (
            <>
              <li>Nur Eichel-, Gras- oder Schellen-Sau – die Herz-Sau ist Trumpf und kann nicht gerufen werden.</li>
              <li>Du darfst die gerufene Sau nicht selbst haben.</li>
              <li>Du musst mindestens eine Karte dieser Farbe haben – Ober und Unter zählen nicht, die sind Trumpf.</li>
              <li>Säue, die du nicht rufen darfst, sind in der Ansage ausgegraut. Geht keine, bleiben dir nur Wenz und Solo.</li>
            </>
          ) : (
            <>
              <li>Only the Acorns, Leaves or Bells Sau – the Hearts Sau is a trump and can't be called.</li>
              <li>You must not hold the called Sau yourself.</li>
              <li>You must hold at least one card of that suit – Obers and Unters don't count, they are trumps.</li>
              <li>Aces you may not call are greyed out when bidding. If none is left, only Wenz and solo remain.</li>
            </>
          )}
        </ul>
      </More>

      <More title={de ? "Sauspiel: Wenn du die gerufene Sau hast" : "Sauspiel: if you hold the called Sau"}>
        <ul>
          {de ? (
            <>
              <li>
                Spielt jemand anderes die Ruffarbe zum ersten Mal aus („gesucht“), muss die gerufene Sau fallen – auch wenn
                du noch kleinere Karten dieser Farbe hast. Damit ist der Partner verraten.
              </li>
              <li>Abwerfen darfst du die gerufene Sau nicht – nur, wenn sie deine letzte Karte ist.</li>
              <li>
                Spielst du selbst die Ruffarbe aus, dann nur mit der Sau. Ausnahme: Hast du vier oder mehr Karten dieser Farbe,
                darfst du auch eine kleine ausspielen („davonlaufen“).
              </li>
              <li>Ist die Ruffarbe einmal gelaufen, gelten für die Sau keine Sonderregeln mehr.</li>
            </>
          ) : (
            <>
              <li>
                The first time someone else leads the called suit (it is “searched for”), the called Sau must be played –
                even if you hold lower cards of that suit. That gives the partner away.
              </li>
              <li>You may not throw the called Sau away on another suit – only when it is your very last card.</li>
              <li>
                If you lead the called suit yourself, it has to be with the Sau. Exception: with four or more cards of that
                suit you may lead a low one (“davonlaufen”, running away).
              </li>
              <li>Once the called suit has been played, the Sau has no special rules any more.</li>
            </>
          )}
        </ul>
      </More>
    </>
  );
}
