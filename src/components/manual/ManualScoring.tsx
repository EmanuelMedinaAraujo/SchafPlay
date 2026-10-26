/** Chapters 6–7: scoring with the house rules, and the glossary. */

import { TARIFF } from "../../game/scoring";
import { translations } from "../../lib/i18n";
import ManualCard from "./ManualCard";
import { ChapterProps, More } from "./parts";

const { rufspiel, solo, ramsch } = TARIFF;

export function ScoringChapter({ language }: ChapterProps) {
  const de = language === "de";
  // Quote the Settings screen's own labels so the two never disagree.
  const t = translations[language];

  const rows: Array<[string, string, string]> = de
    ? [
        ["Gewonnen", `${rufspiel.base}`, `${solo.base}`],
        ["… mit Schneider", `${rufspiel.schneider}`, `${solo.schneider}`],
        ["… Schwarz", `${rufspiel.schwarz}`, `${solo.schwarz}`],
        ["je Laufender", `+${rufspiel.perLaufendem}`, `+${solo.perLaufendem}`],
        ["Tout", "–", `${solo.tout} + Laufende`],
        ["Sie", "–", `${solo.sie}`],
      ]
    : [
        ["Won", `${rufspiel.base}`, `${solo.base}`],
        ["… with Schneider", `${rufspiel.schneider}`, `${solo.schneider}`],
        ["… Schwarz", `${rufspiel.schwarz}`, `${solo.schwarz}`],
        ["per Matador (Laufender)", `+${rufspiel.perLaufendem}`, `+${solo.perLaufendem}`],
        ["Tout", "–", `${solo.tout} + matadors`],
        ["Sie", "–", `${solo.sie}`],
      ];

  return (
    <>
      <p>
        {de ? (
          <>
            Augen entscheiden, <em>wer</em> gewinnt. Danach gibt es <strong>Punkte</strong> für den Punktestand der Liste.
            Im <strong>Sauspiel</strong> bekommt jeder Gewinner 1 Punkt und jeder Verlierer gibt 1 ab. Bei{" "}
            <strong>Wenz und Solo</strong> zahlt jeder der drei Gegner dem Solisten 1 Punkt – oder bekommt 1 von ihm. Der
            Solist gewinnt oder verliert also das Dreifache.
          </>
        ) : (
          <>
            Augen decide <em>who</em> wins. Then <strong>score points</strong> go onto the list's standings. In a{" "}
            <strong>Sauspiel</strong> every winner gets 1 point and every loser gives 1. In a <strong>Wenz or solo</strong> each
            of the three defenders pays the soloist 1 point – or gets 1 from them. So the soloist wins or loses three times as
            much.
          </>
        )}
      </p>

      <table className="manual-table">
        <thead>
          <tr>
            <th scope="col">{de ? "Punkte" : "Points"}</th>
            <th scope="col">{de ? "Sauspiel (pro Kopf)" : "Sauspiel (each player)"}</th>
            <th scope="col">{de ? "Wenz / Solo (je Gegner)" : "Wenz / solo (per defender)"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, ruf, soloValue]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{ruf}</td>
              <td>{soloValue}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="manual-small">
        {de
          ? "Beispiel: Du gewinnst ein Solo mit Schneider und 3 Laufenden – das sind 2 + 3 = 5 Punkte von jedem Gegner, also +15 für dich."
          : "Example: you win a solo with Schneider and 3 matadors – that is 2 + 3 = 5 points from each defender, so +15 for you."}
      </p>

      <More title={de ? "Schneider und Schwarz" : "Schneider and Schwarz"}>
        {de ? (
          <ul>
            <li>
              <strong>Schneider</strong>: Die Verlierer kommen kaum auf Augen. Die Spielerseite ist Schneider mit 30 Augen oder
              weniger, die Gegner mit weniger als 30.
            </li>
            <li>
              <strong>Schwarz</strong>: Die Verlierer machen keinen einzigen Stich.
            </li>
          </ul>
        ) : (
          <ul>
            <li>
              <strong>Schneider</strong> (“tailor”): the losers barely score. The declaring side is Schneider with 30 Augen or
              fewer, the defenders with fewer than 30.
            </li>
            <li>
              <strong>Schwarz</strong> (“black”): the losers do not take a single trick.
            </li>
          </ul>
        )}
      </More>

      <More title={de ? "Laufende" : "Matadors (Laufende)"}>
        <p>
          {de
            ? "Laufende sind die höchsten Trümpfe ohne Lücke, beginnend beim höchsten: dem Eichel-Ober, im Wenz dem Eichel-Unter. Gezählt wird, was die Spielerseite beim Geben zusammen auf der Hand hatte:"
            : "Matadors are the highest trumps without a gap, starting from the top: the Acorns Ober, or the Acorns Unter in a Wenz. What counts is what the declaring side held together when the cards were dealt:"}
        </p>
        <div className="manual-card-row">
          <ManualCard code="acorns-o" language={language} caption="1" />
          <ManualCard code="leaves-o" language={language} caption="2" />
          <ManualCard code="hearts-o" language={language} caption="3" />
          <ManualCard code="bells-o" language={language} caption={de ? "fehlt" : "missing"} dim />
        </div>
        <ul>
          {de ? (
            <>
              <li>Hier: 3 Laufende. Fehlt der Spielerseite dagegen der Eichel-Ober, zählen die fehlenden genauso („ohne drei“).</li>
              <li>
                Sie zählen ab {TARIFF.minLaufende} (beim Wenz, wo nur die Unter Trumpf sind, ab {TARIFF.minLaufendeWenz}), jeder
                bringt +1 Punkt.
              </li>
              <li>
                Hausregel: In den <strong>Einstellungen</strong> unter „{t.settingsLaufende}“
                kannst du sie auf „{t.settingsLaufendeOff}“ stellen.
              </li>
            </>
          ) : (
            <>
              <li>Here: 3 matadors. If the declaring side is missing the Acorns Ober instead, the missing ones count the same way (“without three”).</li>
              <li>
                They count from {TARIFF.minLaufende} (in a Wenz, where only the Unters are trumps, from {TARIFF.minLaufendeWenz}),
                each one is worth +1 point.
              </li>
              <li>
                House rule: in <strong>Settings</strong> you can set “{t.settingsLaufende}” to “{t.settingsLaufendeOff}”.
              </li>
            </>
          )}
        </ul>
      </More>

      <More title={de ? "Tout und Sie" : "Tout and Sie"}>
        <ul>
          {de ? (
            <>
              <li>
                <strong>Tout</strong>: Wenz oder Solo, bei dem du alle Stiche machen musst. Zählt {solo.tout} Punkte plus
                Laufende – Schneider und Schwarz spielen dann keine Rolle.
              </li>
              <li>
                <strong>Sie</strong>: Hat der Solist beim Farbsolo alle vier Ober und alle vier Unter bekommen, zählt das Spiel
                automatisch {solo.sie} Punkte.
              </li>
            </>
          ) : (
            <>
              <li>
                <strong>Tout</strong>: a Wenz or solo where you must take every trick. Worth {solo.tout} points plus matadors –
                Schneider and Schwarz don't matter then.
              </li>
              <li>
                <strong>Sie</strong>: if a suit soloist was dealt all four Obers and all four Unters, the game is automatically
                worth {solo.sie} points.
              </li>
            </>
          )}
        </ul>
      </More>

      <h4 className="manual-subhead">
        {de ? "Hausregeln" : "House rules"}
        <span>{de ? "einstellbar in den Einstellungen" : "switch them in Settings"}</span>
      </h4>
      <p className="manual-small">
        {de
          ? "Im Spiel zu zweit gelten die Einstellungen des Gastgebers."
          : "When two people play, the host's settings apply."}
      </p>

      <More title={de ? "Stoß und Retour" : "Stoß and Retour"} tag={de ? "Standard: erlaubt" : "default: allowed"}>
        <ul>
          {de ? (
            <>
              <li>
                Glaubt ein Gegner, dass der Spieler verliert, sagt er <strong>„Stoß“</strong>: Das Spiel zählt doppelt. Das
                geht nur im ersten Stich, bevor dessen zweite Karte liegt.
              </li>
              <li>
                Der Spieler, der angesagt hat, kann mit <strong>„Retour“</strong> antworten: noch einmal doppelt, also vierfach.
                Mehr geht nicht.
              </li>
              <li>Der Partner im Sauspiel kann weder Stoß noch Retour sagen – sonst wäre er verraten. Im Ramsch gibt es keinen Stoß.</li>
              <li>Einstellung „{t.settingsStoss}“: {t.settingsStossPlay} oder {t.settingsStossOff}.</li>
            </>
          ) : (
            <>
              <li>
                If a defender thinks the declarer will lose, they say <strong>“Stoß”</strong> (knock): the game counts double.
                Only during the first trick, before its second card is down.
              </li>
              <li>
                The player who announced the game can answer <strong>“Retour”</strong>: double again, so four times. That's
                the limit.
              </li>
              <li>The Sauspiel partner can say neither – it would give them away. There is no Stoß in a Ramsch.</li>
              <li>Setting “{t.settingsStoss}”: {t.settingsStossPlay} or {t.settingsStossOff}.</li>
            </>
          )}
        </ul>
      </More>

      <More title="Ramsch" tag={de ? "Standard: aus" : "default: off"}>
        <ul>
          {de ? (
            <>
              <li>
                Sagen alle „Weiter“, wird statt neu zu geben ein Ramsch gespielt: <strong>jeder gegen jeden</strong>, Trümpfe wie
                im Sauspiel.
              </li>
              <li>
                Wer die <strong>meisten Augen</strong> hat, verliert und zahlt jedem anderen {ramsch.base} Punkt. Bei Gleichstand
                verliert, wer mehr Stiche hat, danach wer später an der Reihe war.
              </li>
              <li>
                <strong>Jungfrau</strong>: Jeder Spieler ohne einen einzigen Stich verdoppelt die Zahlung.
              </li>
              <li>
                <strong>Durchmarsch</strong>: Macht einer alle acht Stiche, gewinnt er und bekommt von jedem {ramsch.durchmarsch}{" "}
                Punkte.
              </li>
              <li>Einstellung „{t.settingsRamsch}“: {t.settingsRamschPlay} oder {t.settingsRamschOff}.</li>
            </>
          ) : (
            <>
              <li>
                If everyone passes, instead of a redeal a Ramsch is played: <strong>everyone for themselves</strong>, with the
                Sauspiel trumps.
              </li>
              <li>
                Whoever has the <strong>most Augen</strong> loses and pays {ramsch.base} point to each other player. On a tie,
                the one with more tricks loses, then the one who came later in turn.
              </li>
              <li>
                <strong>Jungfrau</strong> (“maiden”): every player who took no trick at all doubles the payment.
              </li>
              <li>
                <strong>Durchmarsch</strong> (“march through”): a player who takes all eight tricks wins and gets{" "}
                {ramsch.durchmarsch} points from everyone.
              </li>
              <li>Setting “{t.settingsRamsch}”: {t.settingsRamschPlay} or {t.settingsRamschOff}.</li>
            </>
          )}
        </ul>
      </More>
    </>
  );
}

const GLOSSARY: Array<[string, string, string]> = [
  ["Augen", "Die Punkte auf den Karten: Sau 11, Zehn 10, König 4, Ober 3, Unter 2. Zusammen 120.", "The points on the cards: Sau 11, 10 10, King 4, Ober 3, Unter 2. 120 in total."],
  ["Bedienen", "Die ausgespielte Farbe (oder Trumpf) zugeben – Pflicht, wenn man sie hat. Auch: Farbzwang.", "Following suit (or trump) – required whenever you can. Also: Farbzwang."],
  ["Davonlaufen", "Mit vier oder mehr Karten der Ruffarbe eine kleine davon ausspielen, obwohl man die gerufene Sau hat.", "Leading a low card of the called suit while holding the called Sau – allowed with four or more of that suit."],
  ["Doch weiter", "In der Ansage wieder aussteigen – erst erlaubt, wenn ein Wenz oder Solo angesagt ist.", "“Retreat”: dropping out of the bidding – only once a Wenz or solo stands."],
  ["Durchmarsch", "Im Ramsch alle acht Stiche machen – und damit gewinnen.", "Taking all eight tricks in a Ramsch – which wins it."],
  ["Farbe", "Eichel, Gras, Herz oder Schellen.", "Suit: Acorns (Eichel), Leaves (Gras), Hearts (Herz) or Bells (Schellen)."],
  ["Geber", "Wer die Karten gibt. Links von ihm wird zuerst angesagt und ausgespielt.", "The dealer. Bidding and the first lead start to their left."],
  ["Gesucht", "Die Ruffarbe wird zum ersten Mal ausgespielt – die gerufene Sau muss fallen.", "The called suit is led for the first time – the called Sau must be played."],
  ["I dad spuin!", "„Ich würde spielen“ – in der Ansage melden, dass man ein Spiel machen will.", "“I'd play!” – saying in the bidding that you want to play a game."],
  ["Jungfrau", "Im Ramsch keinen Stich machen. Verdoppelt die Zahlung.", "Taking no trick in a Ramsch. Doubles the payment."],
  ["Laufende", "Die höchsten Trümpfe ohne Lücke ab dem Eichel-Ober (im Wenz ab dem Eichel-Unter). Bringen Zusatzpunkte.", "Matadors: the top trumps without a gap from the Acorns Ober (in a Wenz from the Acorns Unter). Worth extra points."],
  ["Liste", "Eine Partie aus 4, 8 oder 12 Runden mit gemeinsamem Punktestand.", "A session of 4, 8 or 12 rounds with one running score."],
  ["Ober", "Die höchsten Trümpfe (außer im Wenz). 3 Augen.", "The highest trumps (except in a Wenz). 3 Augen."],
  ["Ramsch", "Hausregel, wenn alle weiter sagen: jeder gegen jeden, die meisten Augen verlieren.", "House rule when everyone passes: everyone for themselves, most Augen loses."],
  ["Retour", "Antwort des Spielers auf einen Stoß – das Spiel zählt vierfach.", "The declarer's answer to a Stoß – the game counts four times."],
  ["Rufsau", "Die im Sauspiel gerufene Sau. Wer sie hat, ist Partner des Spielers.", "The Sau called in a Sauspiel. Whoever holds it is the declarer's partner."],
  ["Sau", "Das Ass. Die wertvollste Karte: 11 Augen.", "The Ace. The most valuable card: 11 Augen."],
  ["Sauspiel", "2 gegen 2: Der Spieler ruft eine Sau, ihr Besitzer spielt mit ihm.", "2 vs 2: the declarer calls a Sau and its holder plays with them."],
  ["Schmieren", "Dem Partner, der den Stich schon hat, eine Karte mit vielen Augen zugeben.", "Giving a high-value card to a trick your partner is already winning."],
  ["Schneider", "Die Verlierer haben kaum Augen: die Spielerseite 30 oder weniger, die Gegner unter 30. Zählt mehr.", "The losers barely scored: the declaring side 30 Augen or fewer, the defenders under 30. Pays more."],
  ["Schwarz", "Die Verlierer haben keinen einzigen Stich. Zählt noch mehr.", "The losers took no trick at all. Pays even more."],
  ["Sie", "Alle vier Ober und Unter in einer Hand beim Farbsolo.", "All four Obers and Unters in one hand in a suit solo."],
  ["Solo", "1 gegen 3 mit selbst gewählter Trumpffarbe.", "1 vs 3 with a trump suit of your choice."],
  ["Spieler", "Wer das Spiel angesagt hat – im Sauspiel samt Partner („Mitspieler“). Die anderen sind die Nichtspieler.", "Declarer: whoever announced the game – in a Sauspiel with their partner. The others are the defenders."],
  ["Stechen", "Einen Stich mit Trumpf holen, weil man nicht bedienen kann.", "Taking a trick with a trump because you can't follow suit."],
  ["Stich", "Die vier Karten, die reihum gelegt werden. Wer die stärkste legt, bekommt alle vier.", "Trick: the four cards played in turn. Whoever plays the strongest takes all four."],
  ["Stoß", "Ein Gegner verdoppelt das Spiel im ersten Stich. Hausregel.", "A defender doubles the game during the first trick. House rule."],
  ["Tout", "Wenz oder Solo, bei dem man alle Stiche machen muss.", "A Wenz or solo where you must take every trick."],
  ["Trumpf", "Karten, die jede andere Farbe stechen. Im Sauspiel alle Ober, Unter und Herz.", "Trump: cards that beat every other suit. In a Sauspiel all Obers, Unters and Hearts."],
  ["Unter", "Trumpf direkt nach den Obern – im Wenz die einzigen Trümpfe. 2 Augen.", "Trumps right below the Obers – the only trumps in a Wenz. 2 Augen."],
  ["Weiter", "Passen: In dieser Runde willst du nicht spielen.", "“Pass”: you don't want to play a game this round."],
  ["Wenz", "1 gegen 3, nur die vier Unter sind Trumpf.", "1 vs 3, only the four Unters are trumps."],
  ["Zusammenwerfen", "Alle sagen weiter – die Karten werden neu gegeben.", "Throwing in: everyone passed, so the cards are dealt again."],
];

export function GlossaryChapter({ language }: ChapterProps) {
  const de = language === "de";
  return (
    <>
      <p className="manual-small">
        {de
          ? "Die bayerischen Wörter, die dir in der App begegnen."
          : "The Bavarian words you'll meet in the app. The game keeps most of them untranslated."}
      </p>
      <dl className="manual-glossary">
        {GLOSSARY.map(([term, deText, enText]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{de ? deText : enText}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
