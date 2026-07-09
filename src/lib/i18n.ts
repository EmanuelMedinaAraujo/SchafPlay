import { CardValue, GameType, Language, LogEntry, Suit } from "../types";

export type { Language };

export const translations = {
  de: {
    // Home / pairing
    playerName: "Spielername",
    listLength: "Listenlänge",
    rounds: "Runden",
    listOver: "Liste beendet",
    rematch: "Revanche",
    winner: "Gewinner",
    devSkip: "Stich überspringen (Dev)",
    devSkipRound: "Runde überspringen (Dev)",
    hostGame: "Hosten",
    joinGame: "Gast",
    soloGame: "Solo",
    soloIntro: "Spiel sofort gegen drei KI-Mitspieler – komplett offline, ganz ohne Verbindung.",
    startGame: "Spiel starten",
    soloOffline: "Offline (Solo)",
    hostIntro: "Kopiere den Einladungscode und schick ihn deinem Mitspieler. Er generiert einen Antwortcode, den du hier einfügst.",
    joinIntro: "Füge den Einladungscode des Hosts ein und generiere einen Antwortcode.",
    inviteCode: "Einladungscode",
    replyCode: "Antwortcode",
    pasteInvite: "Einladungscode einfügen",
    pasteInviteHint: "Einladungscode hier einfügen …",
    pasteReply: "Antwortcode einfügen",
    pasteReplyHint: "Antwortcode hier einfügen …",
    generateReply: "Antwortcode erzeugen",
    replyCodeHint: "Kopiere diesen Antwortcode und schick ihn dem Host.",
    connect: "Verbinden",
    creatingCode: "Erzeuge Einladungscode …",
    copy: "Kopieren",
    copied: "Kopiert!",
    share: "Teilen",
    waitingForPeer: "Warte auf Mitspieler …",
    connected: "Verbunden",
    connecting: "Verbinde …",
    disconnected: "Getrennt",
    failed: "Fehlgeschlagen",
    invalidCode: "Ungültiger Code. Bitte prüfen und erneut versuchen.",
    codeExpired: "Verbindung fehlgeschlagen. Neuer Einladungscode wurde erzeugt – bitte erneut teilen.",
    heroTagline: "Bayerischer Schafkopf für zwei – serverlos, offline installierbar, mit zwei KI-Mitspielern.",
    heroHint: "Du sitzt auf Platz 1, dein Mitspieler auf Platz 3. Die Plätze 2 und 4 übernehmen Resi und Sepp (KI).",

    // Game
    round: "Runde",
    bidding: "Ansage",
    willPhaseTitle: "Magst du spielen?",
    declarePhaseTitle: "Was spielst du?",
    willPlay: "I dad spuin!",
    pass: "Weiter",
    retreat: "Doch weiter",
    tout: "Tout",
    currentHighBid: "Aktuelles Gebot",
    yourTurn: "Du bist dran",
    waitingFor: "Warte auf",
    cards: "Karten",
    points: "Augen",
    trick: "Stich",
    lastTrick: "Letzter Stich",
    game: "Spiel",
    caller: "Spieler",
    partner: "Mitspieler",
    quit: "Spiel verlassen",

    // Round over
    roundOver: "Runde beendet",
    declarersWin: "Spielerpartei gewinnt",
    defendersWin: "Nichtspieler gewinnen",
    schneider: "Schneider",
    schwarz: "Schwarz",
    laufende: "Laufende",
    standings: "Punktestand",
    ready: "Bereit für die nächste Runde",
    readyWaiting: "Warte auf Mitspieler …",
    isReady: "bereit",
    notReady: "wartet",

    // Connection / reconnect
    paused: "Spiel pausiert – Verbindung unterbrochen",
    reconnectHint: "Erstelle einen neuen Einladungscode und tausche ihn mit deinem Mitspieler. Der Spielstand bleibt erhalten.",
    rules: "Regeln",

    // Statistics
    home: "Startseite",
    stats: "Statistik",
    statsPlayed: "Spiele",
    statsWon: "Gewonnen",
    statsLost: "Verloren",
    statsWinRate: "Siegquote",
    statsAll: "Alle",
    statsMultiplayer: "Mehrspieler",
    statsRecent: "Letzte Spiele",
    statsEmpty: "Noch keine beendeten Spiele – fertig gespielte Partien erscheinen hier automatisch.",
    statsSoloOpponent: "KI-Runde",

    gameTypes: {
      [GameType.SAUSPIEL]: "Sauspiel",
      [GameType.WENZ]: "Wenz",
      [GameType.SOLO_ACORNS]: "Eichel-Solo",
      [GameType.SOLO_LEAVES]: "Gras-Solo",
      [GameType.SOLO_HEARTS]: "Herz-Solo",
      [GameType.SOLO_BELLS]: "Schellen-Solo",
    },
    suits: {
      [Suit.ACORNS]: "Eichel",
      [Suit.LEAVES]: "Gras",
      [Suit.HEARTS]: "Herz",
      [Suit.BELLS]: "Schellen",
    },
  },
  en: {
    playerName: "Player name",
    listLength: "List length",
    rounds: "rounds",
    listOver: "List over",
    rematch: "Rematch",
    winner: "Winner",
    devSkip: "Skip Trick (Dev)",
    devSkipRound: "Skip Round (Dev)",
    hostGame: "Host",
    joinGame: "Join",
    soloGame: "Solo",
    soloIntro: "Start a game against three AI players right away – fully offline, no connection at all.",
    startGame: "Start game",
    soloOffline: "Offline (solo)",
    hostIntro: "Copy the invite code and send it to your partner. They'll generate a reply code for you to paste here.",
    joinIntro: "Paste the host's invite code and generate a reply code.",
    inviteCode: "Invite code",
    replyCode: "Reply code",
    pasteInvite: "Paste invite code",
    pasteInviteHint: "Paste invite code here …",
    pasteReply: "Paste reply code",
    pasteReplyHint: "Paste reply code here …",
    generateReply: "Generate reply code",
    replyCodeHint: "Copy this reply code and send it to the host.",
    connect: "Connect",
    creatingCode: "Creating invite code …",
    copy: "Copy",
    copied: "Copied!",
    share: "Share",
    waitingForPeer: "Waiting for your partner …",
    connected: "Connected",
    connecting: "Connecting …",
    disconnected: "Disconnected",
    failed: "Failed",
    invalidCode: "Invalid code. Please check it and try again.",
    codeExpired: "Connection failed. A new invite code was created — please share it again.",
    heroTagline: "Bavarian Schafkopf for two – serverless, installable offline, with two AI seats.",
    heroHint: "You sit on seat 1, your partner on seat 3. Seats 2 and 4 are played by Resi and Sepp (AI).",

    round: "Round",
    bidding: "Bidding",
    willPhaseTitle: "Do you want to play?",
    declarePhaseTitle: "What do you play?",
    willPlay: "I'd play!",
    pass: "Pass",
    retreat: "Retreat",
    tout: "Tout",
    currentHighBid: "Current high bid",
    yourTurn: "Your turn",
    waitingFor: "Waiting for",
    cards: "cards",
    points: "pts",
    trick: "Trick",
    lastTrick: "Last trick",
    game: "Game",
    caller: "Declarer",
    partner: "Partner",
    quit: "Leave game",

    roundOver: "Round over",
    declarersWin: "Declaring side wins",
    defendersWin: "Defenders win",
    schneider: "Schneider",
    schwarz: "Schwarz",
    laufende: "Matadors",
    standings: "Standings",
    ready: "Ready for next round",
    readyWaiting: "Waiting for partner …",
    isReady: "ready",
    notReady: "waiting",

    paused: "Game paused – connection lost",
    reconnectHint: "Create a new invite code and exchange it with your partner. The game state is preserved.",
    rules: "Rules",

    // Statistics
    home: "Home",
    stats: "Statistics",
    statsPlayed: "Played",
    statsWon: "Won",
    statsLost: "Lost",
    statsWinRate: "Win rate",
    statsAll: "All",
    statsMultiplayer: "Multiplayer",
    statsRecent: "Recent games",
    statsEmpty: "No finished games yet — completed lists show up here automatically.",
    statsSoloOpponent: "AI table",

    gameTypes: {
      [GameType.SAUSPIEL]: "Sauspiel",
      [GameType.WENZ]: "Wenz",
      [GameType.SOLO_ACORNS]: "Acorn Solo",
      [GameType.SOLO_LEAVES]: "Leaf Solo",
      [GameType.SOLO_HEARTS]: "Heart Solo",
      [GameType.SOLO_BELLS]: "Bell Solo",
    },
    suits: {
      [Suit.ACORNS]: "Acorns",
      [Suit.LEAVES]: "Leaves",
      [Suit.HEARTS]: "Hearts",
      [Suit.BELLS]: "Bells",
    },
  },
};

export function getCardSuitTranslated(suit: Suit, lang: Language): string {
  return translations[lang].suits[suit];
}

export function getCardValueTranslated(value: CardValue, lang: Language): string {
  if (lang === "de" && value === CardValue.KING) return "König";
  if (lang === "en" && value === CardValue.ACE) return "Ace";
  if (lang === "en" && value === CardValue.KING) return "King";
  return value;
}

/** Human-readable contract label, e.g. "Sauspiel (Eichel)" or "Wenz Tout". */
export function gameLabel(
  lang: Language,
  gameType: GameType,
  calledSuit?: Suit,
  isTout?: boolean,
): string {
  const t = translations[lang];
  let label: string = t.gameTypes[gameType];
  if (gameType === GameType.SAUSPIEL && calledSuit) {
    label += ` (${t.suits[calledSuit]})`;
  }
  if (isTout) label += " Tout";
  return label;
}

/** Render a structured engine log entry in the viewer's language. */
export function formatLog(entry: LogEntry, lang: Language): string {
  const p = entry.params ?? {};
  const name = String(p.name ?? "");
  const game =
    p.gameType !== undefined
      ? gameLabel(lang, p.gameType as GameType, p.calledSuit as Suit | undefined, Boolean(p.isTout))
      : "";
  const card =
    p.suit !== undefined && p.value !== undefined
      ? `${getCardSuitTranslated(p.suit as Suit, lang)}-${getCardValueTranslated(p.value as CardValue, lang)}`
      : "";

  const de: Record<string, string> = {
    "log.lobby": "Lobby bereit.",
    "log.deal": `Runde ${p.round}: ${p.dealer} gibt.`,
    "log.will": `${name}: I dad spuin!`,
    "log.pass": `${name}: Weiter.`,
    "log.retreat": `${name} zieht zurück.`,
    "log.declare": `${name} bietet ${game}.`,
    "log.allPass": "Alle weiter – es wird zusammengeworfen und neu gegeben.",
    "log.contract": `${name} spielt ${game}.`,
    "log.play": `${name} spielt ${card}.`,
    "log.trickWon": `${name} nimmt den Stich (${p.points} Augen).`,
    "log.roundOver": `Runde beendet – ${p.names} gewinnt.`,
    "log.ready": `${name} ist bereit.`,
    "log.paused": "Verbindung unterbrochen – Spiel pausiert.",
    "log.resumed": "Wieder verbunden – weiter geht's!",
  };
  const en: Record<string, string> = {
    "log.lobby": "Lobby ready.",
    "log.deal": `Round ${p.round}: ${p.dealer} deals.`,
    "log.will": `${name}: I'd play!`,
    "log.pass": `${name}: pass.`,
    "log.retreat": `${name} retreats.`,
    "log.declare": `${name} bids ${game}.`,
    "log.allPass": "All pass – cards are thrown in and redealt.",
    "log.contract": `${name} plays ${game}.`,
    "log.play": `${name} plays ${card}.`,
    "log.trickWon": `${name} takes the trick (${p.points} pts).`,
    "log.roundOver": `Round over – ${p.names} wins.`,
    "log.ready": `${name} is ready.`,
    "log.paused": "Connection lost – game paused.",
    "log.resumed": "Reconnected – game on!",
  };

  return (lang === "de" ? de : en)[entry.key] ?? entry.key;
}
