/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameType, Suit, CardValue } from "../types";

export type Language = "en" | "de";

export const translations = {
  en: {
    // General / Menu tabs
    appTitle: "Schafkopf Pro",
    appVersion: "v3.0",
    offlineEdition: "Offline Master Edition",
    home: "Home",
    board: "Board",
    multiplayer: "Multiplayer",
    aiCoaching: "AI Coach",
    stats: "Stats & Medals",
    rules: "Rules Guide",
    servus: "Servus & Griaß di!",
    welcomeText: "Welcome to your ultimate companion for traditional Bavarian Schafkopf. Ready to challenge our master strategy engine?",
    configureProfile: "Configure Player Profile",
    playerName: "Player Name",
    opponentLevel: "Opponent Strategy Level",
    startSingleplayer: "Start Game (Singleplayer)",
    bavarianQuote: "Bavarian Quote",
    quoteText: `"Wer ko, der ko! If your partner holds the Called Ace, try to smear points when they take a trick!"`,
    backToHome: "Back to Home Menu",
    rulesAndGuide: "Rules & Guide",
    rulesSubtitle: "Point tallies and card hierarchy",
    performanceIndex: "Performance Index",
    wins: "wins",
    declarer: "Declarer",
    partner: "Partner",
    defender: "Defender",
    avgPoints: "Avg Points",
    acrossRounds: "across all rounds",
    gamesPlayedAs: "Games Played As",
    gamesPlayed: "Games Played",
    winRate: "Win Rate",
    winsOf: "Wins: {won} of {played}",
    coachReady: "Ready",
    coachEmpty: "Empty",
    coachDesc: "Statistical move-by-move feedback",
    coachingAdvice: "AI Coach Advice",
    passPlayDesc: "Couch co-op with local friends",
    passPlayTitle: "Pass & Play",
    statsAndMedals: "Stats & Medals",
    medalsDesc: "Wins: {won} of {played}",

    // Multiplayer view
    offlinePassPlay: "Pass & Play (Offline)",
    localHotspot: "Local Hotspot / Bluetooth",
    enterPlayerNames: "Enter Player Names & Seat Configuration",
    positionLabel: "Position {num}",
    dealerLabel: "Dealer",
    playerTypeHuman: "Human Player",
    playerTypeAI: "AI Opponent",
    startPassPlayGame: "Start Pass & Play Game",
    zeroServerTitle: "Zero-Server Offline Network",
    zeroServerSubtitle: "Connect multiple devices directly on a local network or mobile hotspot",
    zeroServerDesc: "When playing outdoors or in traditional Bavarian taverns without an internet connection, one player should open a mobile hotspot. All other players connect to this hotspot. This establishes a fully local peer-to-peer WebRTC network completely serverless!",
    hostOfflineLobby: "Host Offline Bluetooth Lobby",
    joinDirectPeer: "Join Direct Peer Code",
    scanLocalTavern: "Scan Local Tavern Networks",
    scanning: "Scanning...",
    connect: "Connect",
    lobbyHost: "Lobby Hosted by",
    playersJoined: "players",
    strength: "Strength",
    ping: "Ping",

    // Rules
    howToPlay: "How to Play",
    rulesOverview: "Rules Overview",
    cardPoints: "Card Point Values",
    trumpHierarchy: "Trump Hierarchy",
    closeRules: "Close",

    // Bidding pop-up
    declareGame: "Declare Your Game",
    passChoice: "Pass (Weiter)",
    callAce: "Call {suit} Ace",
    noPartnerSuit: "No callable suits",
    playWenz: "Play Wenz",
    heartsSolo: "Hearts Solo",
    suitSolo: "{suit} Solo",

    // Card suits & values
    suit_ACORNS: "Acorns",
    suit_LEAVES: "Leaves",
    suit_HEARTS: "Hearts",
    suit_BELLS: "Bells",
    
    val_7: "7",
    val_8: "8",
    val_9: "9",
    val_U: "Unter",
    val_O: "Ober",
    val_K: "King",
    val_10: "10",
    val_A: "Ace",

    // Game logs / status
    yourHand: "Your Hand",
    activeTurnPlay: "Your turn! Tap card",
    awaitingAI: "Awaiting turn...",
    noCardsLeft: "No cards remaining. Wait for round summary.",
    dealerIs: "Dealer is {name}.",
    biddingBegin: "Cards dealt. Let the bidding begin!",
    passedWeiter: "Passed (Weiter)",
    calledSuitAce: "Sauspiel (Calling {suit})",
    ramschActive: "Everyone passed! Ramsch Mode Activated!",
    trickCompleted: "Trick completed! {name} wins the trick!",
    nextTrickLed: "Next trick led by {name}.",
    roundCompletedTally: "Round completed! Let's tally the cards.",
    proceedToAnalysis: "Proceed to Coach Analysis",
    scoreSummary: "Score Summary",
    gamePassedNoScore: "The game was passed by everyone (or Ramsch ended). No declarer won.",
    wonGameDetails: "{declarer} won the game with {points} points collected!",
    lostGameDetails: "{declarer} lost the game with only {points} points collected!",
    partnersScore: "Partner was {partner}. Together they gathered {points} points.",
    defendersScore: "Defenders gathered {points} points.",
    ramschWinnerDetails: "{winner} won Ramsch by gathering the fewest points: {points}!",
    ramschLoserDetails: "{loser} lost Ramsch by gathering the most points: {points}!",
    playAgain: "Play Next Round",
    
    // Stats View
    resetStats: "Reset Statistics",
    statsResetCompleted: "Statistics reset successfully.",
    recentContracts: "Contract Types Analysis",
    achievements: "Achievements & Medals",
    medalsCount: "Medals Unlocked",
    
    // AI analysis
    coachingSummary: "Game Performance Coaching",
    ratingLabel: "Performance Rating",
    overallAssessment: "Overall Assessment",
    trickLabel: "Trick {num}",
    yourMove: "Your Move",
    coachBestMove: "Coach Recommendation",
    optimalPlay: "Optimal Play",
    suboptimalPlay: "Suboptimal Play",
    noGamesPlayedYet: "No game has been completed in this session yet. Play a round on the Board first!",

    // Strategy levels
    easyLevel: "G'sell (Beginner)",
    mediumLevel: "Meister (Advanced)",
    hardLevel: "Großmeister (Expert)",

    // Game UI top buttons
    menu: "Menu",
    exitGame: "Exit Game",
  },
  de: {
    // General / Menu tabs
    appTitle: "Schafkopf Pro",
    appVersion: "v3.0",
    offlineEdition: "Offline Meister Edition",
    home: "Startseite",
    board: "Spielfeld",
    multiplayer: "Mehrspieler",
    aiCoaching: "KI-Trainer",
    stats: "Statistiken & Medals",
    rules: "Spielregeln",
    servus: "Servus & Griaß di!",
    welcomeText: "Willkommen bei deinem ultimativen Begleiter für das traditionelle bayerische Schafkopfen. Bereit für die Herausforderung?",
    configureProfile: "Spielerprofil konfigurieren",
    playerName: "Spielername",
    opponentLevel: "Gegner-Spielstärke",
    startSingleplayer: "Spiel starten (Einzelspieler)",
    bavarianQuote: "Bayerischer Spruch",
    quoteText: `"Wer ko, der ko! Wenn dein Partner das gerufene Ass hat, versuche Punkte zu schmieren!"`,
    backToHome: "Zurück zum Hauptmenü",
    rulesAndGuide: "Regeln & Anleitung",
    rulesSubtitle: "Punkteverteilung und Kartenhierarchie",
    performanceIndex: "Leistungsindex",
    wins: "Siege",
    declarer: "Spieler (Ansager)",
    partner: "Mitspieler (Partner)",
    defender: "Gegenspieler",
    avgPoints: "Schnitt-Punkte",
    acrossRounds: "über alle Runden",
    gamesPlayedAs: "Spiele gespielt als",
    gamesPlayed: "Spiele gesamt",
    winRate: "Siegrate",
    winsOf: "Siege: {won} von {played}",
    coachReady: "Bereit",
    coachEmpty: "Leer",
    coachDesc: "Zug-um-Zug Feedback & Analysen",
    coachingAdvice: "KI-Trainer Feedback",
    passPlayDesc: "Lokales Spiel auf einem Gerät",
    passPlayTitle: "Pass & Play",
    statsAndMedals: "Erfolge & Statistiken",
    medalsDesc: "Siege: {won} von {played}",

    // Multiplayer view
    offlinePassPlay: "Pass & Play (Offline)",
    localHotspot: "Lokaler Hotspot / Bluetooth",
    enterPlayerNames: "Spielernamen & Platzbelegung",
    positionLabel: "Position {num}",
    dealerLabel: "Geber",
    playerTypeHuman: "Menschlicher Spieler",
    playerTypeAI: "KI-Gegner",
    startPassPlayGame: "Pass & Play Spiel starten",
    zeroServerTitle: "Serverloses Offline-Netzwerk",
    zeroServerSubtitle: "Verbinde Geräte direkt im lokalen Netz oder Hotspot",
    zeroServerDesc: "Wenn du im Biergarten oder der Gaststubn ohne Internet spielst, kann ein Spieler einen mobilen Hotspot öffnen. Alle anderen verbinden sich mit diesem Hotspot für eine komplett serverlose Direktverbindung!",
    hostOfflineLobby: "Lokale Bluetooth-Lobby erstellen",
    joinDirectPeer: "Mit Direkt-Code beitreten",
    scanLocalTavern: "Wirtshaus-Netzwerke suchen",
    scanning: "Suche läuft...",
    connect: "Verbinden",
    lobbyHost: "Lobby gehostet von",
    playersJoined: "Spieler",
    strength: "Signalstärke",
    ping: "Ping",

    // Rules
    howToPlay: "Spielanleitung",
    rulesOverview: "Schafkopf-Regeln",
    cardPoints: "Karten-Augenwerte",
    trumpHierarchy: "Trumpf-Reihenfolge",
    closeRules: "Schließen",

    // Bidding pop-up
    declareGame: "Spiel ansagen",
    passChoice: "Weiter (Passen)",
    callAce: "Sauspiel auf {suit}-As",
    noPartnerSuit: "Kein Ruf-As spielbar",
    playWenz: "Wenz spielen",
    heartsSolo: "Herz-Solo",
    suitSolo: "{suit}-Solo",

    // Card suits & values
    suit_ACORNS: "Eichel",
    suit_LEAVES: "Gras",
    suit_HEARTS: "Herz",
    suit_BELLS: "Schellen",
    
    val_7: "7",
    val_8: "8",
    val_9: "9",
    val_U: "Unter",
    val_O: "Ober",
    val_K: "König",
    val_10: "10",
    val_A: "As / Sau",

    // Game logs / status
    yourHand: "Deine Karten",
    activeTurnPlay: "Du bist dran! Karte tippen",
    awaitingAI: "Warte auf Mitspieler...",
    noCardsLeft: "Keine Karten mehr. Berechne Rundenergebnis.",
    dealerIs: "Geber ist {name}.",
    biddingBegin: "Karten gegeben. Die Spielansage beginnt!",
    passedWeiter: "Weiter (Gepasst)",
    calledSuitAce: "Sauspiel (Ruft {suit})",
    ramschActive: "Alle gepasst! Ramsch aktiviert!",
    trickCompleted: "Stich beendet! {name} holt den Stich!",
    nextTrickLed: "Nächster Stich angespielt von {name}.",
    roundCompletedTally: "Runde beendet! Augen werden gezählt.",
    proceedToAnalysis: "Zum KI-Trainer-Feedback",
    scoreSummary: "Spielergebnis",
    gamePassedNoScore: "Das Spiel wurde von allen gepasst. Keine Augen gewertet.",
    wonGameDetails: "{declarer} hat gewonnen mit {points} Augen!",
    lostGameDetails: "{declarer} hat verloren mit nur {points} Augen!",
    partnersScore: "Mitspieler war {partner}. Zusammen haben sie {points} Augen erzielt.",
    defendersScore: "Die Gegenspieler erzielten {points} Augen.",
    ramschWinnerDetails: "{winner} gewinnt Ramsch mit den wenigsten Augen: {points}!",
    ramschLoserDetails: "{loser} verliert Ramsch mit den meisten Augen: {points}!",
    playAgain: "Nächste Runde geben",
    
    // Stats View
    resetStats: "Statistiken zurücksetzen",
    statsResetCompleted: "Statistiken wurden erfolgreich zurückgesetzt.",
    recentContracts: "Häufigkeit der Spielarten",
    achievements: "Erfolge & Medaillen",
    medalsCount: "Medaillen freigeschaltet",
    
    // AI analysis
    coachingSummary: "Spielanalyse & KI-Bewertung",
    ratingLabel: "Leistungsbewertung",
    overallAssessment: "Gesamtbeurteilung",
    trickLabel: "Stich {num}",
    yourMove: "Dein Spielzug",
    coachBestMove: "Trainer-Empfehlung",
    optimalPlay: "Optimaler Spielzug",
    suboptimalPlay: "Suboptimaler Spielzug",
    noGamesPlayedYet: "In dieser Sitzung wurde noch kein Spiel beendet. Spiele zuerst eine Runde auf dem Spielfeld!",

    // Strategy levels
    easyLevel: "G'sell (Anfänger)",
    mediumLevel: "Meister (Fortgeschritten)",
    hardLevel: "Großmeister (Experte)",

    // Game UI top buttons
    menu: "Menü",
    exitGame: "Spiel beenden",
  }
};

export function getCardSuitTranslated(suit: Suit, lang: Language): string {
  return translations[lang][`suit_${suit}` as keyof typeof translations[typeof lang]] || suit;
}

export function getCardValueTranslated(value: CardValue, lang: Language): string {
  return translations[lang][`val_${value}` as keyof typeof translations[typeof lang]] || value;
}

export function getCardLabelTranslated(suit: Suit, value: CardValue, lang: Language): string {
  const s = getCardSuitTranslated(suit, lang);
  const v = getCardValueTranslated(value, lang);
  if (lang === "de") {
    return `${s}-${v}`;
  }
  return `${s} ${v}`;
}
