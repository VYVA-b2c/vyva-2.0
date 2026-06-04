import type {
  SocialGameKind,
  SocialGameLanguage,
  SocialGameReadyMember,
  SocialGameRound,
  SocialGameTable,
  SocialLanguage,
} from "../../src/social/types";

type ExtraGameLanguage = Exclude<SocialGameLanguage, SocialLanguage>;

const socialGameLanguages: SocialGameLanguage[] = ["es", "en", "fr", "de", "it", "pt"];

const gameKindLabels: Record<SocialGameKind, Record<SocialGameLanguage, string>> = {
  chess: { es: "ajedrez", en: "chess", fr: "echecs", de: "Schach", it: "scacchi", pt: "xadrez" },
  word: {
    es: "juegos de palabras",
    en: "word games",
    fr: "jeux de mots",
    de: "Wortspiele",
    it: "giochi di parole",
    pt: "jogos de palavras",
  },
  dominoes: { es: "domino", en: "dominoes", fr: "dominos", de: "Domino", it: "domino", pt: "domino" },
  trivia: { es: "preguntas", en: "trivia", fr: "quiz", de: "Quizfragen", it: "quiz", pt: "perguntas" },
};

const readyMembers: Record<SocialGameLanguage, SocialGameReadyMember[]> = {
  en: [
    {
      id: "member-ana",
      name: "Ana",
      gameKind: "word",
      statusLabel: "Ana likes word games",
      sharedTopic: "word games",
    },
    {
      id: "member-luis",
      name: "Luis",
      gameKind: "chess",
      statusLabel: "Luis is solving chess",
      sharedTopic: "chess clues",
    },
  ],
  es: [
    {
      id: "member-ana",
      name: "Ana",
      gameKind: "word",
      statusLabel: "A Ana le gustan las palabras",
      sharedTopic: "juegos de palabras",
    },
    {
      id: "member-luis",
      name: "Luis",
      gameKind: "chess",
      statusLabel: "Luis esta resolviendo ajedrez",
      sharedTopic: "pistas de ajedrez",
    },
  ],
  de: [
    {
      id: "member-ana",
      name: "Ana",
      gameKind: "word",
      statusLabel: "Ana mag Wortspiele",
      sharedTopic: "Wortspiele",
    },
    {
      id: "member-luis",
      name: "Luis",
      gameKind: "chess",
      statusLabel: "Luis loest Schach",
      sharedTopic: "Schachhinweise",
    },
  ],
  fr: [
    {
      id: "member-ana",
      name: "Ana",
      gameKind: "word",
      statusLabel: "Ana aime les jeux de mots",
      sharedTopic: "jeux de mots",
    },
    {
      id: "member-luis",
      name: "Luis",
      gameKind: "chess",
      statusLabel: "Luis resout des indices d'echecs",
      sharedTopic: "indices d'echecs",
    },
  ],
  it: [
    {
      id: "member-ana",
      name: "Ana",
      gameKind: "word",
      statusLabel: "Ad Ana piacciono i giochi di parole",
      sharedTopic: "giochi di parole",
    },
    {
      id: "member-luis",
      name: "Luis",
      gameKind: "chess",
      statusLabel: "Luis risolve indizi di scacchi",
      sharedTopic: "indizi di scacchi",
    },
  ],
  pt: [
    {
      id: "member-ana",
      name: "Ana",
      gameKind: "word",
      statusLabel: "Ana gosta de jogos de palavras",
      sharedTopic: "jogos de palavras",
    },
    {
      id: "member-luis",
      name: "Luis",
      gameKind: "chess",
      statusLabel: "Luis esta resolvendo pistas de xadrez",
      sharedTopic: "pistas de xadrez",
    },
  ],
};

type LocalizedText = Record<SocialLanguage, string>;

type CuratedGamePuzzleTheme = {
  id: string;
  tag: string;
  body: LocalizedText;
  choices: Record<SocialLanguage, string[]>;
  answer: LocalizedText;
  hint: LocalizedText;
  successMessage: LocalizedText;
  variants: Array<{
    suffix?: string;
    body?: LocalizedText;
    prompt: LocalizedText;
    choices?: Record<SocialLanguage, string[]>;
    answer?: LocalizedText;
    hint?: LocalizedText;
    successMessage?: LocalizedText;
    estimatedDurationSeconds?: number;
  }>;
};

const chessRoundTitles: LocalizedText = {
  en: "Chess clue",
  es: "Pista de ajedrez",
  de: "Schachhinweis",
};

const chessPuzzleThemes: CuratedGamePuzzleTheme[] = [
  {
    id: "chess-clue-fork",
    tag: "fork",
    body: {
      en: "Spot a friendly tactic.",
      es: "Encuentra una tactica amable.",
      de: "Erkenne eine freundliche Taktik.",
    },
    choices: {
      en: ["Fork", "Castle", "Trade pawns"],
      es: ["Horquilla", "Enroque", "Cambiar peones"],
      de: ["Gabel", "Rochade", "Bauern tauschen"],
    },
    answer: { en: "Fork", es: "Horquilla", de: "Gabel" },
    hint: {
      en: "One piece makes two threats at the same time.",
      es: "Una pieza crea dos amenazas a la vez.",
      de: "Eine Figur macht zwei Drohungen gleichzeitig.",
    },
    successMessage: {
      en: "Nice steady thinking. Forks are a classic way to start a chess chat.",
      es: "Muy bien pensado. Las horquillas son un clasico para empezar a hablar de ajedrez.",
      de: "Ruhig gedacht. Gabeln sind ein klassischer Einstieg in ein Schachgespraech.",
    },
    variants: [
      {
        prompt: {
          en: "White's knight can check the king and attack the queen. What tactic is this?",
          es: "El caballo blanco puede dar jaque al rey y atacar la reina. Que tactica es?",
          de: "Der weisse Springer kann dem Koenig Schach geben und die Dame angreifen. Welche Taktik ist das?",
        },
        estimatedDurationSeconds: 90,
      },
      {
        suffix: "rook-king",
        prompt: {
          en: "A white rook checks the king on one line and also attacks a loose bishop. What pattern should White name?",
          es: "Una torre blanca da jaque al rey en una linea y tambien ataca un alfil suelto. Que patron deben nombrar las blancas?",
          de: "Ein weisser Turm gibt dem Koenig Schach und greift zugleich einen ungedeckten Laeufer an. Welches Muster ist das?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "queen-two-targets",
        prompt: {
          en: "The queen moves to the center and attacks both a rook and an unprotected knight. What tactic is White using?",
          es: "La reina va al centro y ataca una torre y un caballo sin defensa. Que tactica usan las blancas?",
          de: "Die Dame zieht ins Zentrum und greift Turm und ungedeckten Springer an. Welche Taktik nutzt Weiss?",
        },
        estimatedDurationSeconds: 90,
      },
      {
        suffix: "pawn-check",
        prompt: {
          en: "A pawn advances with check and also opens an attack on a rook. What is the two-threat idea?",
          es: "Un peon avanza con jaque y tambien abre un ataque a una torre. Como se llama la idea de dos amenazas?",
          de: "Ein Bauer zieht mit Schach vor und oeffnet zugleich einen Angriff auf einen Turm. Wie heisst die Zwei-Drohungs-Idee?",
        },
        estimatedDurationSeconds: 95,
      },
    ],
  },
  {
    id: "chess-clue-back-rank",
    tag: "back-rank-mate",
    body: {
      en: "Find the trapped king.",
      es: "Encuentra al rey atrapado.",
      de: "Finde den gefangenen Koenig.",
    },
    choices: {
      en: ["Back-rank mate", "En passant", "Pawn promotion"],
      es: ["Mate de primera fila", "Al paso", "Promocion"],
      de: ["Grundreihenmatt", "En passant", "Umwandlung"],
    },
    answer: { en: "Back-rank mate", es: "Mate de primera fila", de: "Grundreihenmatt" },
    hint: {
      en: "The king has no safe square because its own pawns block the escape.",
      es: "El rey no puede escapar porque sus propios peones cierran la salida.",
      de: "Der Koenig hat kein Fluchtfeld, weil die eigenen Bauern den Weg versperren.",
    },
    successMessage: {
      en: "Good eye. Back-rank patterns are small puzzles that many chess players enjoy.",
      es: "Buen ojo. Los mates de primera fila son pequenos retos que muchos jugadores disfrutan.",
      de: "Gut gesehen. Grundreihenmatt ist ein kleines Muster, das viele Schachspieler moegen.",
    },
    variants: [
      {
        prompt: {
          en: "Black's king is stuck behind its own pawns and White has a rook on the open file. What idea should White look for?",
          es: "El rey negro esta bloqueado por sus peones y una torre blanca tiene una columna abierta. Que idea deben buscar las blancas?",
          de: "Der schwarze Koenig steht hinter eigenen Bauern fest, und ein weisser Turm hat eine offene Linie. Welche Idee sollte Weiss suchen?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "queen-file",
        prompt: {
          en: "The black king sits on the last rank with no escape, and White's queen can slide to the back line. What finish is near?",
          es: "El rey negro esta en la ultima fila sin salida, y la reina blanca puede entrar en esa linea. Que final esta cerca?",
          de: "Der schwarze Koenig steht auf der Grundreihe ohne Fluchtfeld, und die weisse Dame kann dorthin ziehen. Welcher Abschluss droht?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "rook-lift",
        prompt: {
          en: "A rook lift brings White's rook to the last rank while the king's own pawns trap it. What mate pattern is this?",
          es: "Una torre blanca llega a la ultima fila mientras los peones del rey lo atrapan. Que patron de mate es?",
          de: "Ein Turmschwenk bringt den weissen Turm auf die Grundreihe, waehrend eigene Bauern den Koenig fangen. Welches Mattbild ist das?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "escape-square",
        prompt: {
          en: "Before using the rook, White notices the king has no luft square. What classic back-line idea should White check?",
          es: "Antes de usar la torre, las blancas ven que el rey no tiene casilla de aire. Que idea clasica deben revisar?",
          de: "Vor dem Turmzug sieht Weiss, dass der Koenig kein Luftfeld hat. Welche klassische Grundreihenidee sollte Weiss pruefen?",
        },
        estimatedDurationSeconds: 95,
      },
    ],
  },
  {
    id: "chess-clue-pin",
    tag: "pin",
    body: {
      en: "Name the pressure.",
      es: "Nombra la presion.",
      de: "Benenne den Druck.",
    },
    choices: {
      en: ["Pinned", "Promoted", "Castled"],
      es: ["Clavada", "Promovida", "Enrocada"],
      de: ["Gefesselt", "Umgewandelt", "Rochiert"],
    },
    answer: { en: "Pinned", es: "Clavada", de: "Gefesselt" },
    hint: {
      en: "The attacked piece is stuck protecting something more important.",
      es: "La pieza atacada queda quieta porque protege algo mas importante.",
      de: "Die angegriffene Figur bleibt stehen, weil sie etwas Wichtigeres schuetzt.",
    },
    successMessage: {
      en: "Exactly. Pins make calm conversation starters because the pattern is easy to discuss.",
      es: "Exacto. Las clavadas son faciles de comentar con otra persona.",
      de: "Genau. Fesselungen sind leicht gemeinsam zu besprechen.",
    },
    variants: [
      {
        prompt: {
          en: "A bishop attacks a knight, and the knight cannot move because the king is behind it. What is the knight?",
          es: "Un alfil ataca a un caballo, y el caballo no puede moverse porque el rey esta detras. Como esta la pieza?",
          de: "Ein Laeufer greift einen Springer an, und der Springer darf nicht weg, weil der Koenig dahinter steht. Wie nennt man das?",
        },
        estimatedDurationSeconds: 85,
      },
      {
        suffix: "rook-queen",
        prompt: {
          en: "A rook attacks a bishop, but the queen sits behind the bishop on the same file. What has White created?",
          es: "Una torre ataca un alfil, pero la reina esta detras en la misma columna. Que crearon las blancas?",
          de: "Ein Turm greift einen Laeufer an, doch die Dame steht dahinter auf derselben Linie. Was hat Weiss geschaffen?",
        },
        estimatedDurationSeconds: 90,
      },
      {
        suffix: "knight-frozen",
        prompt: {
          en: "Black's knight wants to move, but moving would expose the king to a rook. What word describes that knight?",
          es: "El caballo negro quiere moverse, pero al hacerlo expondria al rey a una torre. Que palabra describe al caballo?",
          de: "Der schwarze Springer moechte ziehen, wuerde aber den Koenig einem Turm oeffnen. Welches Wort beschreibt den Springer?",
        },
        estimatedDurationSeconds: 90,
      },
      {
        suffix: "queen-bishop",
        prompt: {
          en: "White's bishop lines up a knight with the king behind it. Why is the knight hard for Black to move?",
          es: "El alfil blanco alinea un caballo con el rey detras. Por que le cuesta moverse al caballo negro?",
          de: "Der weisse Laeufer stellt einen Springer vor den Koenig. Warum kann Schwarz den Springer kaum ziehen?",
        },
        estimatedDurationSeconds: 90,
      },
    ],
  },
  {
    id: "chess-clue-skewer",
    tag: "skewer",
    body: {
      en: "Look past the king.",
      es: "Mira detras del rey.",
      de: "Schau hinter den Koenig.",
    },
    choices: {
      en: ["Skewer", "Stalemate", "Castle"],
      es: ["Rayo X", "Ahogado", "Enroque"],
      de: ["Spiess", "Patt", "Rochade"],
    },
    answer: { en: "Skewer", es: "Rayo X", de: "Spiess" },
    hint: {
      en: "The valuable piece must move first, leaving another target behind it.",
      es: "La pieza valiosa debe moverse primero y deja otro objetivo detras.",
      de: "Die wertvolle Figur muss zuerst weg und laesst ein Ziel dahinter zurueck.",
    },
    successMessage: {
      en: "Well spotted. Skewers are satisfying because the second target appears after the check.",
      es: "Muy bien visto. Los rayos X son satisfactorios porque aparece el segundo objetivo.",
      de: "Gut erkannt. Ein Spiess ist schoen, weil das zweite Ziel nach dem Schach sichtbar wird.",
    },
    variants: [
      {
        prompt: {
          en: "A bishop gives check to the king, and the queen sits behind the king on the same line. What tactic is this?",
          es: "Un alfil da jaque al rey, y la reina esta detras en la misma linea. Que tactica es?",
          de: "Ein Laeufer gibt dem Koenig Schach, und die Dame steht dahinter auf derselben Linie. Welche Taktik ist das?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "rook-king",
        prompt: {
          en: "A rook checks the king on an open file, and a loose rook waits behind the king. What should White call this pattern?",
          es: "Una torre da jaque por una columna abierta, y otra torre suelta espera detras del rey. Como se llama el patron?",
          de: "Ein Turm gibt auf einer offenen Linie Schach, und ein ungedeckter Turm steht hinter dem Koenig. Wie heisst das Muster?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "queen-line",
        prompt: {
          en: "White's queen checks the king along a diagonal. A bishop sits behind the king. What tactic may win the bishop?",
          es: "La reina blanca da jaque por una diagonal. Un alfil esta detras del rey. Que tactica puede ganar el alfil?",
          de: "Die weisse Dame gibt auf einer Diagonale Schach. Hinter dem Koenig steht ein Laeufer. Welche Taktik kann den Laeufer gewinnen?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "king-queen",
        prompt: {
          en: "The king and queen are lined up, with the king in front. What tactic attacks the queen after the king moves?",
          es: "El rey y la reina estan alineados, con el rey delante. Que tactica ataca la reina cuando el rey se mueve?",
          de: "Koenig und Dame stehen auf einer Linie, der Koenig vorn. Welche Taktik greift die Dame nach dem Koenigszug an?",
        },
        estimatedDurationSeconds: 95,
      },
    ],
  },
  {
    id: "chess-clue-discovered-attack",
    tag: "discovered-attack",
    body: {
      en: "Open the line.",
      es: "Abre la linea.",
      de: "Oeffne die Linie.",
    },
    choices: {
      en: ["Discovered attack", "Draw offer", "Stalemate"],
      es: ["Ataque descubierto", "Oferta de tablas", "Ahogado"],
      de: ["Abzugsangriff", "Remisangebot", "Patt"],
    },
    answer: { en: "Discovered attack", es: "Ataque descubierto", de: "Abzugsangriff" },
    hint: {
      en: "The moving piece uncovers a second piece that was waiting behind it.",
      es: "La pieza que se mueve descubre a otra pieza que esperaba detras.",
      de: "Die ziehende Figur legt eine zweite Figur frei, die dahinter gewartet hat.",
    },
    successMessage: {
      en: "Sharp clue solving. Discovered attacks feel clever without needing a long game.",
      es: "Respuesta clara. Los ataques descubiertos parecen inteligentes sin necesitar una partida larga.",
      de: "Klar geloest. Abzugsangriffe wirken schlau, ohne eine lange Partie zu brauchen.",
    },
    variants: [
      {
        prompt: {
          en: "A knight moves away and opens a rook's line toward the queen. What kind of tactic did White create?",
          es: "Un caballo se aparta y abre la linea de una torre hacia la reina. Que tactica crean las blancas?",
          de: "Ein Springer zieht weg und oeffnet die Turmlinie zur Dame. Welche Taktik entsteht?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "bishop-rook",
        prompt: {
          en: "White moves a bishop with check, and the rook behind it now attacks Black's queen. What is the hidden idea?",
          es: "Las blancas mueven un alfil con jaque, y la torre detras ataca la reina negra. Cual es la idea escondida?",
          de: "Weiss zieht einen Laeufer mit Schach, und der Turm dahinter greift nun die schwarze Dame an. Welche Idee steckt dahinter?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "pawn-opens-bishop",
        prompt: {
          en: "A pawn steps forward and uncovers a bishop aiming at a rook. What tactical family is this?",
          es: "Un peon avanza y descubre un alfil que apunta a una torre. A que familia tactica pertenece?",
          de: "Ein Bauer zieht vor und legt einen Laeufer frei, der auf einen Turm zielt. Zu welcher Taktikfamilie gehoert das?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "queen-unmasked",
        prompt: {
          en: "A knight jumps away with tempo, and the queen behind it suddenly attacks the king. What attack has appeared?",
          es: "Un caballo salta con tiempo, y la reina detras ataca de repente al rey. Que ataque aparecio?",
          de: "Ein Springer springt mit Tempo weg, und die Dame dahinter greift ploetzlich den Koenig an. Welcher Angriff entsteht?",
        },
        estimatedDurationSeconds: 100,
      },
    ],
  },
  {
    id: "chess-clue-mate-net",
    tag: "mate-net",
    body: {
      en: "Close the escape squares.",
      es: "Cierra las casillas de escape.",
      de: "Schliesse die Fluchtfelder.",
    },
    choices: {
      en: ["Checkmate", "Offer a draw", "Move a pawn"],
      es: ["Jaque mate", "Ofrecer tablas", "Mover un peon"],
      de: ["Schachmatt", "Remis anbieten", "Bauer ziehen"],
    },
    answer: { en: "Checkmate", es: "Jaque mate", de: "Schachmatt" },
    hint: {
      en: "A protected attacking piece can finish the game when every escape is covered.",
      es: "Una pieza atacante protegida puede terminar la partida si todas las salidas estan cubiertas.",
      de: "Eine geschuetzte Angriffsfigur kann beenden, wenn alle Fluchtfelder gedeckt sind.",
    },
    successMessage: {
      en: "Lovely finish. Mate patterns are a natural reason to invite another player in.",
      es: "Bonito final. Los patrones de mate invitan naturalmente a jugar con otra persona.",
      de: "Schoener Abschluss. Mattbilder sind ein natuerlicher Grund, jemanden zum Spiel einzuladen.",
    },
    variants: [
      {
        prompt: {
          en: "The king has no safe square, and White's queen can move next to it while protected by a bishop. What should White look for?",
          es: "El rey no tiene casilla segura y la reina blanca puede acercarse protegida por un alfil. Que deben buscar las blancas?",
          de: "Der Koenig hat kein sicheres Feld, und die weisse Dame kann geschuetzt vom Laeufer nah heran. Wonach sollte Weiss suchen?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "rook-net",
        prompt: {
          en: "White's rook controls the open file, the bishop covers the escape, and the king is boxed in. What final idea is near?",
          es: "La torre blanca controla la columna, el alfil cubre la salida y el rey esta encerrado. Que idea final esta cerca?",
          de: "Der weisse Turm kontrolliert die offene Linie, der Laeufer deckt die Flucht, und der Koenig ist eingesperrt. Welche Schlussidee droht?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "queen-knight",
        prompt: {
          en: "The queen and knight cover all the squares around the king. What should White check for before moving?",
          es: "La reina y el caballo cubren todas las casillas alrededor del rey. Que deben comprobar las blancas antes de mover?",
          de: "Dame und Springer decken alle Felder um den Koenig. Wonach sollte Weiss vor dem Zug schauen?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "corner",
        prompt: {
          en: "Black's king is in the corner, its own pieces block the exits, and White has a protected queen check. What is the goal?",
          es: "El rey negro esta en la esquina, sus piezas bloquean las salidas y la reina blanca da jaque protegida. Cual es el objetivo?",
          de: "Der schwarze Koenig steht in der Ecke, eigene Figuren blockieren die Ausgaenge, und Weiss hat ein geschuetztes Damenschach. Was ist das Ziel?",
        },
        estimatedDurationSeconds: 100,
      },
    ],
  },
  {
    id: "chess-clue-double-attack",
    tag: "double-attack",
    body: {
      en: "Find two targets.",
      es: "Encuentra dos objetivos.",
      de: "Finde zwei Ziele.",
    },
    choices: {
      en: ["Double attack", "Resign", "Touch move"],
      es: ["Ataque doble", "Abandonar", "Pieza tocada"],
      de: ["Doppelangriff", "Aufgeben", "Beruehrt gefuehrt"],
    },
    answer: { en: "Double attack", es: "Ataque doble", de: "Doppelangriff" },
    hint: {
      en: "The move matters because it threatens two useful things at once.",
      es: "La jugada importa porque amenaza dos cosas utiles a la vez.",
      de: "Der Zug zaehlt, weil er zwei nuetzliche Dinge zugleich bedroht.",
    },
    successMessage: {
      en: "Good scan. Double attacks are easy to enjoy at the table.",
      es: "Buena mirada. Los ataques dobles se disfrutan facilmente en la mesa.",
      de: "Guter Blick. Doppelangriffe machen am Tisch leicht Freude.",
    },
    variants: [
      {
        prompt: {
          en: "White's queen can move with check and also attack a loose rook. What idea is White using?",
          es: "La reina blanca puede mover con jaque y tambien atacar una torre suelta. Que idea usan las blancas?",
          de: "Die weisse Dame kann mit Schach ziehen und zugleich einen losen Turm angreifen. Welche Idee nutzt Weiss?",
        },
        estimatedDurationSeconds: 90,
      },
      {
        suffix: "bishop-targets",
        prompt: {
          en: "A bishop move attacks the rook and also threatens mate next move. What kind of pressure is that?",
          es: "Un movimiento de alfil ataca la torre y tambien amenaza mate en la siguiente. Que tipo de presion es?",
          de: "Ein Laeuferzug greift den Turm an und droht zugleich Matt im naechsten Zug. Welche Art Druck ist das?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "knight-center",
        prompt: {
          en: "A knight jumps to the center and attacks both queen and bishop. What should Viktor call the tactic?",
          es: "Un caballo salta al centro y ataca a la reina y al alfil. Como debe llamar Viktor la tactica?",
          de: "Ein Springer springt ins Zentrum und greift Dame und Laeufer an. Wie sollte Viktor die Taktik nennen?",
        },
        estimatedDurationSeconds: 90,
      },
      {
        suffix: "queen-mate-threat",
        prompt: {
          en: "White attacks a rook while also threatening checkmate. What is the shared name for this two-threat move?",
          es: "Las blancas atacan una torre y tambien amenazan jaque mate. Cual es el nombre comun de esta jugada con dos amenazas?",
          de: "Weiss greift einen Turm an und droht zugleich Schachmatt. Wie heisst dieser Zug mit zwei Drohungen?",
        },
        estimatedDurationSeconds: 95,
      },
    ],
  },
  {
    id: "chess-clue-deflection",
    tag: "deflection",
    body: {
      en: "Pull away the guard.",
      es: "Aparta al defensor.",
      de: "Lenke den Waechter weg.",
    },
    choices: {
      en: ["Deflection", "Castling", "Repetition"],
      es: ["Desviacion", "Enroque", "Repeticion"],
      de: ["Ablenkung", "Rochade", "Wiederholung"],
    },
    answer: { en: "Deflection", es: "Desviacion", de: "Ablenkung" },
    hint: {
      en: "The defender is tempted or forced away from an important job.",
      es: "El defensor es atraido o forzado lejos de una tarea importante.",
      de: "Der Verteidiger wird von einer wichtigen Aufgabe weggelenkt.",
    },
    successMessage: {
      en: "Nicely read. Deflection clues feel like small chess stories.",
      es: "Muy bien leido. Las desviaciones parecen pequenas historias de ajedrez.",
      de: "Schoen gelesen. Ablenkungen fuehlen sich wie kleine Schachgeschichten an.",
    },
    variants: [
      {
        prompt: {
          en: "A queen guards mate, but White can make the queen capture a piece and leave the guard duty. What is this idea?",
          es: "Una reina evita el mate, pero las blancas pueden hacer que capture una pieza y deje su defensa. Que idea es?",
          de: "Eine Dame verhindert Matt, aber Weiss kann sie zum Schlagen zwingen und von der Deckung weglocken. Welche Idee ist das?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "rook-guard",
        prompt: {
          en: "A rook protects the back rank. White offers a capture that pulls the rook away. What tactic is White trying?",
          es: "Una torre protege la primera fila. Las blancas ofrecen una captura que aleja la torre. Que tactica intentan?",
          de: "Ein Turm schuetzt die Grundreihe. Weiss bietet einen Schlag an, der den Turm wegzieht. Welche Taktik versucht Weiss?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "bishop-guard",
        prompt: {
          en: "A bishop protects the queen. White can force that bishop to move, leaving the queen loose. What is the tactic?",
          es: "Un alfil protege la reina. Las blancas pueden forzar al alfil a moverse y dejar la reina suelta. Que tactica es?",
          de: "Ein Laeufer deckt die Dame. Weiss kann den Laeufer zum Ziehen zwingen, sodass die Dame lose steht. Welche Taktik ist das?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "king-defender",
        prompt: {
          en: "The knight defends a mate square. White can lure the knight away with a capture. What clue should Viktor give?",
          es: "El caballo defiende una casilla de mate. Las blancas pueden atraerlo con una captura. Que pista debe dar Viktor?",
          de: "Der Springer deckt ein Mattfeld. Weiss kann ihn mit einem Schlag weglocken. Welchen Hinweis sollte Viktor geben?",
        },
        estimatedDurationSeconds: 100,
      },
    ],
  },
  {
    id: "chess-clue-attraction",
    tag: "attraction",
    body: {
      en: "Invite the king closer.",
      es: "Invita al rey a acercarse.",
      de: "Locke den Koenig naeher.",
    },
    choices: {
      en: ["Attraction", "Promotion", "Draw offer"],
      es: ["Atraccion", "Promocion", "Oferta de tablas"],
      de: ["Hinlenkung", "Umwandlung", "Remisangebot"],
    },
    answer: { en: "Attraction", es: "Atraccion", de: "Hinlenkung" },
    hint: {
      en: "A piece is offered so the enemy piece lands on a worse square.",
      es: "Se ofrece una pieza para que la pieza rival caiga en una casilla peor.",
      de: "Eine Figur wird angeboten, damit die gegnerische Figur auf ein schlechteres Feld kommt.",
    },
    successMessage: {
      en: "Good sense of direction. Attraction puzzles make tactics feel almost magnetic.",
      es: "Buen sentido de direccion. Las atracciones hacen que la tactica parezca magnetica.",
      de: "Gutes Richtungsgefuehl. Hinlenkungen wirken fast magnetisch.",
    },
    variants: [
      {
        prompt: {
          en: "White sacrifices a rook so the king must step onto a square where the queen can mate. What tactic is this?",
          es: "Las blancas sacrifican una torre para que el rey pise una casilla donde la reina puede dar mate. Que tactica es?",
          de: "Weiss opfert einen Turm, damit der Koenig auf ein Feld zieht, wo die Dame mattsetzen kann. Welche Taktik ist das?",
        },
        estimatedDurationSeconds: 105,
      },
      {
        suffix: "queen-square",
        prompt: {
          en: "A queen offer pulls the king onto a line controlled by a bishop. What is White using?",
          es: "Una oferta de reina atrae al rey a una linea controlada por un alfil. Que usan las blancas?",
          de: "Ein Damenangebot lockt den Koenig auf eine Linie, die ein Laeufer kontrolliert. Was nutzt Weiss?",
        },
        estimatedDurationSeconds: 105,
      },
      {
        suffix: "knight-square",
        prompt: {
          en: "A knight sacrifice draws the king into a fork square. What is the name of the drawing-in tactic?",
          es: "Un sacrificio de caballo atrae al rey a una casilla de horquilla. Como se llama la tactica de atraer?",
          de: "Ein Springeropfer lockt den Koenig auf ein Gabelfeld. Wie heisst diese Hinlenkung?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "rook-file",
        prompt: {
          en: "White offers a bishop so the king moves onto an open rook file. What tactical idea is at work?",
          es: "Las blancas ofrecen un alfil para que el rey entre en una columna abierta de torre. Que idea tactica funciona?",
          de: "Weiss bietet einen Laeufer an, damit der Koenig auf eine offene Turmlinie zieht. Welche taktische Idee wirkt?",
        },
        estimatedDurationSeconds: 100,
      },
    ],
  },
  {
    id: "chess-clue-overloaded-defender",
    tag: "overloaded-defender",
    body: {
      en: "Ask too much of one defender.",
      es: "Pide demasiado a un defensor.",
      de: "Ueberlaste einen Verteidiger.",
    },
    choices: {
      en: ["Overloaded defender", "Touch move", "Threefold draw"],
      es: ["Defensor sobrecargado", "Pieza tocada", "Triple repeticion"],
      de: ["Ueberlasteter Verteidiger", "Beruehrt gefuehrt", "Dreifache Wiederholung"],
    },
    answer: { en: "Overloaded defender", es: "Defensor sobrecargado", de: "Ueberlasteter Verteidiger" },
    hint: {
      en: "One defender has two jobs and cannot do both after the next move.",
      es: "Un defensor tiene dos tareas y no puede cumplir ambas tras la siguiente jugada.",
      de: "Ein Verteidiger hat zwei Aufgaben und kann nach dem naechsten Zug nicht beide erfuellen.",
    },
    successMessage: {
      en: "That is the idea. Overloaded defenders are satisfying once you see both jobs.",
      es: "Esa es la idea. Los defensores sobrecargados son claros cuando ves sus dos tareas.",
      de: "Das ist die Idee. Ueberlastete Verteidiger sind schoen, sobald man beide Aufgaben sieht.",
    },
    variants: [
      {
        prompt: {
          en: "Black's rook defends mate and also protects the queen. White can attack one job first. What is that defender?",
          es: "La torre negra evita el mate y tambien protege la reina. Las blancas pueden atacar una tarea primero. Como esta ese defensor?",
          de: "Der schwarze Turm verhindert Matt und deckt zugleich die Dame. Weiss kann eine Aufgabe zuerst angreifen. Wie steht dieser Verteidiger da?",
        },
        estimatedDurationSeconds: 105,
      },
      {
        suffix: "bishop-two-jobs",
        prompt: {
          en: "A bishop guards the rook and the back-rank square. White can make it choose. What pattern is this?",
          es: "Un alfil defiende la torre y una casilla de mate. Las blancas pueden hacerlo elegir. Que patron es?",
          de: "Ein Laeufer deckt den Turm und ein Mattfeld. Weiss kann ihn zur Wahl zwingen. Welches Muster ist das?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "queen-two-jobs",
        prompt: {
          en: "Black's queen defends the knight and stops mate. White notices it cannot keep both duties. What clue fits?",
          es: "La reina negra defiende el caballo y evita el mate. Las blancas ven que no puede hacer ambas cosas. Que pista encaja?",
          de: "Die schwarze Dame deckt den Springer und verhindert Matt. Weiss sieht, dass sie nicht beides halten kann. Welcher Hinweis passt?",
        },
        estimatedDurationSeconds: 105,
      },
      {
        suffix: "knight-guard",
        prompt: {
          en: "A knight protects a rook and a key escape square. White can stretch that knight too far. What is it called?",
          es: "Un caballo protege una torre y una casilla de escape clave. Las blancas pueden exigirle demasiado. Como se llama?",
          de: "Ein Springer deckt einen Turm und ein wichtiges Fluchtfeld. Weiss kann ihn ueberfordern. Wie nennt man das?",
        },
        estimatedDurationSeconds: 100,
      },
    ],
  },
  {
    id: "chess-clue-remove-defender",
    tag: "remove-defender",
    body: {
      en: "Take away the guard.",
      es: "Quita al defensor.",
      de: "Entferne den Verteidiger.",
    },
    choices: {
      en: ["Remove the defender", "Castle long", "Claim a draw"],
      es: ["Quitar el defensor", "Enrocar largo", "Reclamar tablas"],
      de: ["Verteidiger entfernen", "Lang rochieren", "Remis reklamieren"],
    },
    answer: { en: "Remove the defender", es: "Quitar el defensor", de: "Verteidiger entfernen" },
    hint: {
      en: "The guarded piece becomes loose after its helper disappears.",
      es: "La pieza defendida queda suelta cuando desaparece quien la ayuda.",
      de: "Die gedeckte Figur steht lose, sobald ihr Helfer verschwindet.",
    },
    successMessage: {
      en: "Clean reading. Removing a defender turns a quiet clue into a clear win.",
      es: "Buena lectura. Quitar un defensor convierte una pista tranquila en una ganancia clara.",
      de: "Sauber gesehen. Einen Verteidiger zu entfernen macht aus einem ruhigen Hinweis einen klaren Gewinn.",
    },
    variants: [
      {
        prompt: {
          en: "The knight protects the queen. White can capture the knight first. What tactical idea is this?",
          es: "El caballo protege la reina. Las blancas pueden capturar primero el caballo. Que idea tactica es?",
          de: "Der Springer deckt die Dame. Weiss kann zuerst den Springer schlagen. Welche taktische Idee ist das?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "bishop-guard",
        prompt: {
          en: "A bishop is the only guard of a rook. White can trade off the bishop before taking the rook. What is the plan?",
          es: "Un alfil es el unico defensor de una torre. Las blancas pueden cambiar el alfil antes de tomar la torre. Cual es el plan?",
          de: "Ein Laeufer ist der einzige Verteidiger eines Turms. Weiss kann den Laeufer tauschen und dann den Turm nehmen. Was ist der Plan?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "mate-square",
        prompt: {
          en: "A rook guards the mate square. White can capture that rook before giving check. What should White do to the guard?",
          es: "Una torre defiende la casilla de mate. Las blancas pueden capturar esa torre antes de dar jaque. Que deben hacer con el defensor?",
          de: "Ein Turm deckt das Mattfeld. Weiss kann diesen Turm schlagen, bevor das Schach kommt. Was sollte Weiss mit dem Verteidiger tun?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "pawn-guard",
        prompt: {
          en: "A pawn is the only defender of the bishop. White can take the pawn first. What idea is Viktor pointing to?",
          es: "Un peon es el unico defensor del alfil. Las blancas pueden tomar primero el peon. A que idea apunta Viktor?",
          de: "Ein Bauer ist der einzige Verteidiger des Laeufers. Weiss kann zuerst den Bauern nehmen. Auf welche Idee zeigt Viktor?",
        },
        estimatedDurationSeconds: 90,
      },
    ],
  },
  {
    id: "chess-clue-clearance",
    tag: "clearance",
    body: {
      en: "Make room for the best piece.",
      es: "Haz espacio para la mejor pieza.",
      de: "Mach Platz fuer die beste Figur.",
    },
    choices: {
      en: ["Clearance", "Flag fall", "Resign"],
      es: ["Despeje", "Caida de bandera", "Abandonar"],
      de: ["Raeumung", "Zeitueberschreitung", "Aufgeben"],
    },
    answer: { en: "Clearance", es: "Despeje", de: "Raeumung" },
    hint: {
      en: "One piece moves away so another piece can use the square or line.",
      es: "Una pieza se aparta para que otra use la casilla o la linea.",
      de: "Eine Figur raeumt, damit eine andere Figur Feld oder Linie nutzen kann.",
    },
    successMessage: {
      en: "Nice table vision. Clearance moves make a plan feel tidy.",
      es: "Buena vision de mesa. Los despejes hacen que el plan se vea ordenado.",
      de: "Gute Brettsicht. Raeumungszuege lassen einen Plan ordentlich wirken.",
    },
    variants: [
      {
        prompt: {
          en: "A knight leaves a square so the queen can move there with mate. What kind of move did the knight make?",
          es: "Un caballo deja una casilla para que la reina entre con mate. Que tipo de jugada hizo el caballo?",
          de: "Ein Springer verlaesst ein Feld, damit die Dame dort mattsetzen kann. Welche Art Zug war das?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "rook-file",
        prompt: {
          en: "White moves a bishop away to open a rook file. What is the name of this making-space idea?",
          es: "Las blancas apartan un alfil para abrir una columna a la torre. Como se llama esta idea de hacer espacio?",
          de: "Weiss zieht einen Laeufer weg, um eine Turmlinie zu oeffnen. Wie heisst diese Platzmach-Idee?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "queen-square",
        prompt: {
          en: "A rook steps aside so the queen can use the back rank. What tactic is being prepared?",
          es: "Una torre se aparta para que la reina use la ultima fila. Que tactica se prepara?",
          de: "Ein Turm tritt zur Seite, damit die Dame die Grundreihe nutzen kann. Welche Taktik wird vorbereitet?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "diagonal",
        prompt: {
          en: "White clears a diagonal by moving a pawn with tempo. What clue describes that move?",
          es: "Las blancas despejan una diagonal moviendo un peon con tiempo. Que pista describe esa jugada?",
          de: "Weiss raeumt eine Diagonale, indem ein Bauer mit Tempo zieht. Welcher Hinweis beschreibt den Zug?",
        },
        estimatedDurationSeconds: 90,
      },
    ],
  },
  {
    id: "chess-clue-in-between",
    tag: "zwischenzug",
    body: {
      en: "Pause for the stronger move.",
      es: "Pausa para la jugada mas fuerte.",
      de: "Halte fuer den staerkeren Zug inne.",
    },
    choices: {
      en: ["In-between move", "Illegal move", "Castling"],
      es: ["Jugada intermedia", "Jugada ilegal", "Enroque"],
      de: ["Zwischenzug", "Illegaler Zug", "Rochade"],
    },
    answer: { en: "In-between move", es: "Jugada intermedia", de: "Zwischenzug" },
    hint: {
      en: "Before recapturing, there may be a forcing move with check or threat.",
      es: "Antes de recapturar, puede haber una jugada forzada con jaque o amenaza.",
      de: "Vor dem Zurueckschlagen kann es einen zwingenden Zug mit Schach oder Drohung geben.",
    },
    successMessage: {
      en: "Patient and smart. In-between moves reward taking one extra breath.",
      es: "Paciente e inteligente. Las jugadas intermedias premian respirar una vez mas.",
      de: "Geduldig und klug. Zwischenzuege belohnen einen zusaetzlichen Atemzug.",
    },
    variants: [
      {
        prompt: {
          en: "Black captured a bishop, but White can give check before recapturing. What is that extra move called?",
          es: "Las negras capturaron un alfil, pero las blancas pueden dar jaque antes de recapturar. Como se llama esa jugada extra?",
          de: "Schwarz schlug einen Laeufer, aber Weiss kann vor dem Zurueckschlagen Schach geben. Wie heisst dieser Extrazug?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "queen-threat",
        prompt: {
          en: "Instead of taking back right away, White first attacks the queen with tempo. What type of move is this?",
          es: "En vez de recapturar enseguida, las blancas atacan primero la reina con tiempo. Que tipo de jugada es?",
          de: "Statt sofort zurueckzuschlagen, greift Weiss zuerst die Dame mit Tempo an. Welche Zugart ist das?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "mate-threat",
        prompt: {
          en: "White is down a piece for the moment, but has a checking move before the normal recapture. What should Viktor call it?",
          es: "Las blancas pierden una pieza por ahora, pero tienen un jaque antes de la recaptura normal. Como debe llamarlo Viktor?",
          de: "Weiss ist kurzzeitig eine Figur hinten, hat aber vor dem normalen Rueckschlag ein Schach. Wie sollte Viktor das nennen?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "rook-check",
        prompt: {
          en: "A rook check comes between the capture and the recapture. What chess word fits that surprise?",
          es: "Un jaque de torre aparece entre la captura y la recaptura. Que palabra de ajedrez encaja con la sorpresa?",
          de: "Ein Turmschach kommt zwischen Schlag und Rueckschlag. Welches Schachwort passt zu dieser Ueberraschung?",
        },
        estimatedDurationSeconds: 95,
      },
    ],
  },
  {
    id: "chess-clue-trapped-piece",
    tag: "trapped-piece",
    body: {
      en: "Find the piece with no room.",
      es: "Encuentra la pieza sin espacio.",
      de: "Finde die Figur ohne Raum.",
    },
    choices: {
      en: ["Trapped piece", "Passed pawn", "Draw offer"],
      es: ["Pieza atrapada", "Peon pasado", "Oferta de tablas"],
      de: ["Gefangene Figur", "Freibauer", "Remisangebot"],
    },
    answer: { en: "Trapped piece", es: "Pieza atrapada", de: "Gefangene Figur" },
    hint: {
      en: "The target is attacked and has no safe square to run to.",
      es: "El objetivo esta atacado y no tiene casilla segura a donde huir.",
      de: "Das Ziel ist angegriffen und hat kein sicheres Fluchtfeld.",
    },
    successMessage: {
      en: "Good spatial sense. Trapped pieces make clear short puzzles.",
      es: "Buen sentido espacial. Las piezas atrapadas hacen retos cortos y claros.",
      de: "Gutes Raumgefuehl. Gefangene Figuren ergeben klare kurze Aufgaben.",
    },
    variants: [
      {
        prompt: {
          en: "Black's queen has wandered to the edge, and White's rook cuts off the escape. What is the queen?",
          es: "La reina negra fue al borde, y la torre blanca corta la salida. Como esta la reina?",
          de: "Die schwarze Dame ist an den Rand geraten, und der weisse Turm schneidet die Flucht ab. Wie steht die Dame?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "bishop-corner",
        prompt: {
          en: "A bishop is attacked in the corner, and every retreat square is covered. What kind of clue is this?",
          es: "Un alfil esta atacado en la esquina y todas sus casillas de retirada estan cubiertas. Que tipo de pista es?",
          de: "Ein Laeufer wird in der Ecke angegriffen, und alle Rueckzugsfelder sind gedeckt. Welche Art Hinweis ist das?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "rook-boxed",
        prompt: {
          en: "A rook is boxed in by pawns and a knight attack. What phrase describes the rook?",
          es: "Una torre esta encerrada por peones y un ataque de caballo. Que frase describe la torre?",
          de: "Ein Turm ist von Bauern und einem Springerangriff eingesperrt. Welche Wendung beschreibt den Turm?",
        },
        estimatedDurationSeconds: 90,
      },
      {
        suffix: "knight-edge",
        prompt: {
          en: "The knight on the rim is attacked and has no safe hop. What has White found?",
          es: "El caballo en el borde esta atacado y no tiene salto seguro. Que encontraron las blancas?",
          de: "Der Springer am Rand ist angegriffen und hat keinen sicheren Sprung. Was hat Weiss gefunden?",
        },
        estimatedDurationSeconds: 90,
      },
    ],
  },
  {
    id: "chess-clue-promotion",
    tag: "promotion",
    body: {
      en: "Help the pawn become more.",
      es: "Ayuda al peon a ser mas.",
      de: "Hilf dem Bauern, mehr zu werden.",
    },
    choices: {
      en: ["Promotion", "Castling", "Stalemate"],
      es: ["Promocion", "Enroque", "Ahogado"],
      de: ["Umwandlung", "Rochade", "Patt"],
    },
    answer: { en: "Promotion", es: "Promocion", de: "Umwandlung" },
    hint: {
      en: "A pawn that reaches the last rank can become a queen, rook, bishop, or knight.",
      es: "Un peon que llega a la ultima fila puede convertirse en reina, torre, alfil o caballo.",
      de: "Ein Bauer auf der letzten Reihe kann Dame, Turm, Laeufer oder Springer werden.",
    },
    successMessage: {
      en: "Well guided. Promotion puzzles feel hopeful because a small pawn becomes powerful.",
      es: "Bien guiado. Las promociones se sienten optimistas porque un peon pequeno se vuelve fuerte.",
      de: "Gut gefuehrt. Umwandlungen fuehlen sich hoffnungsvoll an, weil ein kleiner Bauer stark wird.",
    },
    variants: [
      {
        prompt: {
          en: "White's pawn is one step from the last rank, and the path is clear. What should White plan?",
          es: "El peon blanco esta a un paso de la ultima fila y el camino esta libre. Que deben planear las blancas?",
          de: "Der weisse Bauer ist einen Schritt vor der letzten Reihe, und der Weg ist frei. Was sollte Weiss planen?",
        },
        estimatedDurationSeconds: 85,
      },
      {
        suffix: "with-check",
        prompt: {
          en: "A pawn can move to the last rank with check. What special chess event happens there?",
          es: "Un peon puede llegar a la ultima fila con jaque. Que evento especial ocurre alli?",
          de: "Ein Bauer kann mit Schach auf die letzte Reihe ziehen. Welches besondere Ereignis passiert dort?",
        },
        estimatedDurationSeconds: 90,
      },
      {
        suffix: "race",
        prompt: {
          en: "Both sides have passed pawns, but White's pawn queens first. What is White racing toward?",
          es: "Ambos tienen peones pasados, pero el peon blanco llega primero. Hacia que corren las blancas?",
          de: "Beide Seiten haben Freibauern, aber der weisse Bauer wandelt zuerst um. Worauf laeuft Weiss zu?",
        },
        estimatedDurationSeconds: 90,
      },
      {
        suffix: "underpromotion",
        prompt: {
          en: "The pawn reaches the last rank, and a knight is better than a queen because it gives check. What family is this?",
          es: "El peon llega a la ultima fila, y un caballo es mejor que una reina porque da jaque. A que familia pertenece?",
          de: "Der Bauer erreicht die letzte Reihe, und ein Springer ist besser als eine Dame, weil er Schach gibt. Zu welcher Familie gehoert das?",
        },
        estimatedDurationSeconds: 105,
      },
    ],
  },
  {
    id: "chess-clue-open-file",
    tag: "open-file",
    body: {
      en: "Use the clear road.",
      es: "Usa el camino libre.",
      de: "Nutze die freie Strasse.",
    },
    choices: {
      en: ["Open file", "Knight fork", "Touch move"],
      es: ["Columna abierta", "Horquilla de caballo", "Pieza tocada"],
      de: ["Offene Linie", "Springergabel", "Beruehrt gefuehrt"],
    },
    answer: { en: "Open file", es: "Columna abierta", de: "Offene Linie" },
    hint: {
      en: "A rook or queen is strongest when a file has no pawns in the way.",
      es: "Una torre o reina es mas fuerte cuando una columna no tiene peones en medio.",
      de: "Turm oder Dame sind stark, wenn auf einer Linie keine Bauern im Weg stehen.",
    },
    successMessage: {
      en: "Nice board reading. Open files give rooks a simple purpose.",
      es: "Buena lectura del tablero. Las columnas abiertas dan a las torres un proposito claro.",
      de: "Gute Brettsicht. Offene Linien geben Tuermern eine klare Aufgabe.",
    },
    variants: [
      {
        prompt: {
          en: "White has a rook and no pawns block the d-file. What road should the rook use?",
          es: "Las blancas tienen una torre y ningun peon bloquea la columna d. Que camino debe usar la torre?",
          de: "Weiss hat einen Turm, und kein Bauer blockiert die d-Linie. Welche Strasse sollte der Turm nutzen?",
        },
        estimatedDurationSeconds: 85,
      },
      {
        suffix: "queen",
        prompt: {
          en: "The queen can move onto a file with no pawns and pressure the king. What kind of file is it?",
          es: "La reina puede entrar en una columna sin peones y presionar al rey. Que tipo de columna es?",
          de: "Die Dame kann auf eine Linie ohne Bauern ziehen und den Koenig unter Druck setzen. Welche Linie ist das?",
        },
        estimatedDurationSeconds: 90,
      },
      {
        suffix: "double-rooks",
        prompt: {
          en: "Both white rooks can stack on a clear file. What feature of the board makes that strong?",
          es: "Las dos torres blancas pueden doblarse en una columna despejada. Que rasgo del tablero lo hace fuerte?",
          de: "Beide weissen Tuerme koennen sich auf einer freien Linie verdoppeln. Welches Brettmerkmal macht das stark?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "entry-square",
        prompt: {
          en: "A rook has a clear file and an entry square on the seventh rank. What should White notice first?",
          es: "Una torre tiene una columna libre y una casilla de entrada en la septima fila. Que deben notar primero las blancas?",
          de: "Ein Turm hat eine freie Linie und ein Eintrittsfeld auf der siebten Reihe. Was sollte Weiss zuerst bemerken?",
        },
        estimatedDurationSeconds: 95,
      },
    ],
  },
  {
    id: "chess-clue-outpost",
    tag: "outpost",
    body: {
      en: "Find the safe home.",
      es: "Encuentra la casa segura.",
      de: "Finde das sichere Feld.",
    },
    choices: {
      en: ["Outpost", "Back-rank mate", "Resign"],
      es: ["Puesto avanzado", "Mate de primera fila", "Abandonar"],
      de: ["Vorposten", "Grundreihenmatt", "Aufgeben"],
    },
    answer: { en: "Outpost", es: "Puesto avanzado", de: "Vorposten" },
    hint: {
      en: "A knight loves a protected square where pawns cannot chase it away.",
      es: "A un caballo le gusta una casilla protegida donde los peones no pueden echarlo.",
      de: "Ein Springer liebt ein gedecktes Feld, von dem Bauern ihn nicht vertreiben koennen.",
    },
    successMessage: {
      en: "Good positional clue. Outposts are gentle puzzles for people who like strategy.",
      es: "Buena pista posicional. Los puestos avanzados son retos tranquilos para quien disfruta la estrategia.",
      de: "Guter Positionshinweis. Vorposten sind ruhige Aufgaben fuer strategische Spieler.",
    },
    variants: [
      {
        prompt: {
          en: "White's knight can land on d5, protected by a pawn, and no black pawn can chase it. What is that square?",
          es: "El caballo blanco puede ir a d5, protegido por un peon, y ningun peon negro puede echarlo. Que es esa casilla?",
          de: "Der weisse Springer kann nach d5, von einem Bauern gedeckt, und kein schwarzer Bauer kann ihn vertreiben. Was ist dieses Feld?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "bishop",
        prompt: {
          en: "A bishop can settle on a protected central square that cannot be challenged by pawns. What positional idea is this?",
          es: "Un alfil puede instalarse en una casilla central protegida que los peones no pueden disputar. Que idea posicional es?",
          de: "Ein Laeufer kann sich auf einem gedeckten Zentralfeld niederlassen, das Bauern nicht angreifen koennen. Welche Positionsidee ist das?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "knight-e5",
        prompt: {
          en: "The e5 square is guarded by White and safe from enemy pawns. What kind of home is it for a knight?",
          es: "La casilla e5 esta defendida por las blancas y a salvo de peones enemigos. Que tipo de casa es para un caballo?",
          de: "Das Feld e5 ist von Weiss gedeckt und sicher vor gegnerischen Bauern. Was fuer ein Zuhause ist es fuer einen Springer?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "anchor",
        prompt: {
          en: "White does not win material yet, but places a knight on a protected square deep in Black's side. What clue fits?",
          es: "Las blancas no ganan material aun, pero colocan un caballo en una casilla protegida dentro del campo negro. Que pista encaja?",
          de: "Weiss gewinnt noch kein Material, setzt aber einen Springer auf ein gedecktes Feld tief im schwarzen Lager. Welcher Hinweis passt?",
        },
        estimatedDurationSeconds: 100,
      },
    ],
  },
  {
    id: "chess-clue-passed-pawn",
    tag: "passed-pawn",
    body: {
      en: "Notice the free runner.",
      es: "Observa al corredor libre.",
      de: "Sieh den freien Laeufer.",
    },
    choices: {
      en: ["Passed pawn", "Pinned queen", "Castle"],
      es: ["Peon pasado", "Reina clavada", "Enroque"],
      de: ["Freibauer", "Gefesselte Dame", "Rochade"],
    },
    answer: { en: "Passed pawn", es: "Peon pasado", de: "Freibauer" },
    hint: {
      en: "No enemy pawn stands in front of it or on nearby files to stop it.",
      es: "Ningun peon enemigo esta delante ni en columnas vecinas para frenarlo.",
      de: "Kein gegnerischer Bauer steht davor oder auf Nachbarlinien, um ihn zu stoppen.",
    },
    successMessage: {
      en: "Good eye for progress. Passed pawns give partners something easy to cheer for.",
      es: "Buen ojo para el avance. Los peones pasados dan algo facil que animar.",
      de: "Guter Blick fuer Fortschritt. Freibauern geben Partnern etwas Einfaches zum Mitfiebern.",
    },
    variants: [
      {
        prompt: {
          en: "White's pawn has no enemy pawn in front or beside it to stop the run. What is this pawn called?",
          es: "El peon blanco no tiene peon enemigo delante ni al lado para detener su carrera. Como se llama?",
          de: "Der weisse Bauer hat keinen gegnerischen Bauern vor sich oder daneben, der ihn stoppt. Wie heisst dieser Bauer?",
        },
        estimatedDurationSeconds: 85,
      },
      {
        suffix: "outside",
        prompt: {
          en: "A pawn on the edge can run while the kings are far away. What kind of pawn is giving White hope?",
          es: "Un peon en el borde puede correr mientras los reyes estan lejos. Que tipo de peon da esperanza a las blancas?",
          de: "Ein Bauer am Rand kann laufen, waehrend die Koenige weit weg sind. Welche Art Bauer gibt Weiss Hoffnung?",
        },
        estimatedDurationSeconds: 90,
      },
      {
        suffix: "protected",
        prompt: {
          en: "White has a passed pawn protected by another pawn. What should White value in the endgame?",
          es: "Las blancas tienen un peon pasado protegido por otro peon. Que deben valorar en el final?",
          de: "Weiss hat einen Freibauern, der von einem anderen Bauern gedeckt ist. Was sollte Weiss im Endspiel schaetzen?",
        },
        estimatedDurationSeconds: 90,
      },
      {
        suffix: "race",
        prompt: {
          en: "In the pawn race, White's pawn has a clear lane to the end. What kind of pawn is leading?",
          es: "En la carrera de peones, el peon blanco tiene un carril libre hasta el final. Que tipo de peon va delante?",
          de: "Im Bauernrennen hat der weisse Bauer eine freie Bahn bis zum Ende. Welche Art Bauer fuehrt?",
        },
        estimatedDurationSeconds: 90,
      },
    ],
  },
  {
    id: "chess-clue-stalemate-trap",
    tag: "stalemate-trap",
    body: {
      en: "Avoid the draw trap.",
      es: "Evita la trampa de tablas.",
      de: "Vermeide die Remisfalle.",
    },
    choices: {
      en: ["Stalemate", "Checkmate", "Promotion"],
      es: ["Ahogado", "Jaque mate", "Promocion"],
      de: ["Patt", "Schachmatt", "Umwandlung"],
    },
    answer: { en: "Stalemate", es: "Ahogado", de: "Patt" },
    hint: {
      en: "If the king is not in check but has no legal move, the game is drawn.",
      es: "Si el rey no esta en jaque pero no tiene jugada legal, la partida es tablas.",
      de: "Wenn der Koenig nicht im Schach steht, aber keinen legalen Zug hat, ist die Partie remis.",
    },
    successMessage: {
      en: "Careful thinking. Spotting stalemate keeps a winning game friendly and clear.",
      es: "Pensamiento cuidadoso. Ver el ahogado mantiene una partida ganada clara y amable.",
      de: "Sorgfaeltig gedacht. Patt zu sehen haelt eine gewonnene Partie klar und freundlich.",
    },
    variants: [
      {
        prompt: {
          en: "Black's king is not in check, but every legal move is gone. What result should White avoid?",
          es: "El rey negro no esta en jaque, pero no tiene jugadas legales. Que resultado deben evitar las blancas?",
          de: "Der schwarze Koenig steht nicht im Schach, hat aber keinen legalen Zug. Welches Ergebnis sollte Weiss vermeiden?",
        },
        estimatedDurationSeconds: 90,
      },
      {
        suffix: "queen-too-close",
        prompt: {
          en: "White's queen can take the last escape square without giving check. What danger does Viktor warn about?",
          es: "La reina blanca puede quitar la ultima salida sin dar jaque. De que peligro avisa Viktor?",
          de: "Die weisse Dame kann das letzte Fluchtfeld nehmen, ohne Schach zu geben. Vor welcher Gefahr warnt Viktor?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "king-box",
        prompt: {
          en: "White is winning, but boxing the king too tightly without check could draw the game. What is the trap?",
          es: "Las blancas ganan, pero encerrar demasiado al rey sin jaque puede empatar. Cual es la trampa?",
          de: "Weiss steht auf Gewinn, aber den Koenig ohne Schach zu eng einzusperren kann remis machen. Welche Falle ist das?",
        },
        estimatedDurationSeconds: 95,
      },
      {
        suffix: "last-pawn",
        prompt: {
          en: "Only the black king remains, and White must give check rather than remove every move. What draw should White remember?",
          es: "Solo queda el rey negro, y las blancas deben dar jaque en vez de quitar todas las jugadas. Que tablas deben recordar?",
          de: "Nur der schwarze Koenig bleibt, und Weiss muss Schach geben statt alle Zuege zu nehmen. Welches Remis sollte Weiss bedenken?",
        },
        estimatedDurationSeconds: 95,
      },
    ],
  },
  {
    id: "chess-clue-opposition",
    tag: "opposition",
    body: {
      en: "Win the king dance.",
      es: "Gana el baile de reyes.",
      de: "Gewinne den Koenigstanz.",
    },
    choices: {
      en: ["Opposition", "Skewer", "Castle"],
      es: ["Oposicion", "Rayo X", "Enroque"],
      de: ["Opposition", "Spiess", "Rochade"],
    },
    answer: { en: "Opposition", es: "Oposicion", de: "Opposition" },
    hint: {
      en: "Kings face each other, and the side not to move often has to give way.",
      es: "Los reyes se miran, y quien no quiere moverse suele ceder.",
      de: "Die Koenige stehen sich gegenueber, und die Seite am Zugzwang muss oft weichen.",
    },
    successMessage: {
      en: "Quiet and smart. Opposition is a lovely endgame clue for patient players.",
      es: "Tranquilo e inteligente. La oposicion es una buena pista de final para jugadores pacientes.",
      de: "Ruhig und klug. Opposition ist ein schoener Endspielhinweis fuer geduldige Spieler.",
    },
    variants: [
      {
        prompt: {
          en: "The two kings face each other with one square between them. What endgame idea helps White make progress?",
          es: "Los dos reyes se enfrentan con una casilla entre ellos. Que idea de final ayuda a las blancas a avanzar?",
          de: "Die beiden Koenige stehen sich mit einem Feld dazwischen gegenueber. Welche Endspielidee hilft Weiss weiter?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "pawn-ending",
        prompt: {
          en: "White wants to escort a pawn, but first the king must force Black's king to step aside. What idea is this?",
          es: "Las blancas quieren escoltar un peon, pero primero el rey debe obligar al rey negro a apartarse. Que idea es?",
          de: "Weiss will einen Bauern begleiten, doch zuerst muss der Koenig den schwarzen Koenig zur Seite draengen. Welche Idee ist das?",
        },
        estimatedDurationSeconds: 100,
      },
      {
        suffix: "distant",
        prompt: {
          en: "The kings are far apart, but White counts the squares to make Black yield later. What endgame clue fits?",
          es: "Los reyes estan lejos, pero las blancas cuentan casillas para que las negras cedan despues. Que pista de final encaja?",
          de: "Die Koenige sind weit auseinander, aber Weiss zaehlt Felder, damit Schwarz spaeter weichen muss. Welcher Endspielhinweis passt?",
        },
        estimatedDurationSeconds: 105,
      },
      {
        suffix: "shoulder",
        prompt: {
          en: "White's king steps in front of Black's king so the pawn can advance. What king technique is being used?",
          es: "El rey blanco se coloca frente al rey negro para que el peon avance. Que tecnica de rey se usa?",
          de: "Der weisse Koenig stellt sich vor den schwarzen Koenig, damit der Bauer vorankommt. Welche Koenigstechnik wird genutzt?",
        },
        estimatedDurationSeconds: 100,
      },
    ],
  },
];

function buildChessPuzzleBank(language: SocialLanguage): SocialGameRound[] {
  return chessPuzzleThemes.flatMap((theme) =>
    theme.variants.map((variant) => ({
      id: variant.suffix ? `${theme.id}-${variant.suffix}` : theme.id,
      kind: "chess" as const,
      title: chessRoundTitles[language],
      body: (variant.body ?? theme.body)[language],
      prompt: variant.prompt[language],
      choices: (variant.choices ?? theme.choices)[language],
      answer: (variant.answer ?? theme.answer)[language],
      hint: (variant.hint ?? theme.hint)[language],
      tags: ["games", "chess", "game:chess", `chess:${theme.tag}`],
      estimatedDurationSeconds: variant.estimatedDurationSeconds ?? 95,
      successMessage: (variant.successMessage ?? theme.successMessage)[language],
    })),
  );
}

type ExtraChessConcept = {
  answer: string;
  choices: readonly [string, string, string];
  description: string;
  hint: string;
};

const extraChessCopy: Record<ExtraGameLanguage, { title: string; body: string; question: string; successMessage: string; positionLabel: (index: number) => string }> = {
  fr: {
    title: "Indice d'echecs",
    body: "Repere une idee tactique amicale.",
    question: "Quelle idee faut-il nommer?",
    successMessage: "Bien vu. Les petits motifs d'echecs lancent facilement une conversation.",
    positionLabel: (index) => `Position ${index + 1}:`,
  },
  it: {
    title: "Indizio di scacchi",
    body: "Trova una piccola idea tattica.",
    question: "Quale idea bisogna nominare?",
    successMessage: "Ben visto. I piccoli schemi di scacchi fanno partire una conversazione facile.",
    positionLabel: (index) => `Posizione ${index + 1}:`,
  },
  pt: {
    title: "Pista de xadrez",
    body: "Encontre uma pequena ideia tatica.",
    question: "Que ideia deve ser nomeada?",
    successMessage: "Boa observacao. Pequenos padroes de xadrez abrem uma conversa facil.",
    positionLabel: (index) => `Posicao ${index + 1}:`,
  },
};

const extraChessConcepts: Record<string, Record<ExtraGameLanguage, ExtraChessConcept>> = {
  fork: {
    fr: { answer: "Fourchette", choices: ["Fourchette", "Roque", "Echange de pions"], description: "une piece menace deux cibles en meme temps.", hint: "Cherche les deux menaces creees par une seule piece." },
    it: { answer: "Forchetta", choices: ["Forchetta", "Arrocco", "Cambio di pedoni"], description: "un pezzo minaccia due bersagli nello stesso momento.", hint: "Cerca le due minacce create da un solo pezzo." },
    pt: { answer: "Garfo", choices: ["Garfo", "Roque", "Troca de peoes"], description: "uma peca ameaca dois alvos ao mesmo tempo.", hint: "Procure duas ameacas criadas por uma unica peca." },
  },
  "back-rank-mate": {
    fr: { answer: "Mat du couloir", choices: ["Mat du couloir", "En passant", "Promotion"], description: "le roi reste bloque derriere ses propres pions.", hint: "Le roi n'a pas de case de fuite." },
    it: { answer: "Matto di corridoio", choices: ["Matto di corridoio", "En passant", "Promozione"], description: "il re resta bloccato dietro i propri pedoni.", hint: "Il re non ha una casa di fuga." },
    pt: { answer: "Mate de corredor", choices: ["Mate de corredor", "En passant", "Promocao"], description: "o rei fica preso atras dos proprios peoes.", hint: "O rei nao tem casa de fuga." },
  },
  pin: {
    fr: { answer: "Clouage", choices: ["Clouage", "Pat", "Roque"], description: "une piece ne peut presque pas bouger car une piece plus importante est derriere.", hint: "Regarde la ligne entre l'attaquant et la piece de valeur." },
    it: { answer: "Inchiodatura", choices: ["Inchiodatura", "Stallo", "Arrocco"], description: "un pezzo non puo quasi muoversi perche dietro c'e un pezzo piu importante.", hint: "Guarda la linea tra attaccante e pezzo di valore." },
    pt: { answer: "Cravada", choices: ["Cravada", "Afogamento", "Roque"], description: "uma peca quase nao pode se mover porque ha uma peca mais importante atras.", hint: "Veja a linha entre atacante e peca valiosa." },
  },
  skewer: {
    fr: { answer: "Enfilade", choices: ["Enfilade", "Fourchette", "Nulle rapide"], description: "la piece de valeur bouge et laisse une autre piece attaquee derriere.", hint: "La piece importante est devant." },
    it: { answer: "Infilata", choices: ["Infilata", "Forchetta", "Patta veloce"], description: "il pezzo di valore si sposta e lascia dietro un altro bersaglio.", hint: "Il pezzo importante e davanti." },
    pt: { answer: "Espeto", choices: ["Espeto", "Garfo", "Empate rapido"], description: "a peca valiosa se move e deixa outro alvo atras.", hint: "A peca importante esta na frente." },
  },
  "discovered-attack": {
    fr: { answer: "Attaque decouverte", choices: ["Attaque decouverte", "Roque long", "Pion isole"], description: "une piece bouge et ouvre l'attaque d'une autre piece.", hint: "Le coup revele une ligne cachee." },
    it: { answer: "Attacco di scoperta", choices: ["Attacco di scoperta", "Arrocco lungo", "Pedone isolato"], description: "un pezzo si muove e apre l'attacco di un altro pezzo.", hint: "La mossa rivela una linea nascosta." },
    pt: { answer: "Ataque descoberto", choices: ["Ataque descoberto", "Roque grande", "Peao isolado"], description: "uma peca se move e abre o ataque de outra.", hint: "O lance revela uma linha escondida." },
  },
  "mate-net": {
    fr: { answer: "Filet de mat", choices: ["Filet de mat", "Echange force", "Pion double"], description: "plusieurs pieces retirent les cases de fuite du roi.", hint: "Le roi est entoure peu a peu." },
    it: { answer: "Rete di matto", choices: ["Rete di matto", "Cambio forzato", "Pedone doppiato"], description: "piu pezzi tolgono al re le case di fuga.", hint: "Il re viene circondato poco alla volta." },
    pt: { answer: "Rede de mate", choices: ["Rede de mate", "Troca forcada", "Peao dobrado"], description: "varias pecas tiram as casas de fuga do rei.", hint: "O rei fica cercado aos poucos." },
  },
  "double-attack": {
    fr: { answer: "Double attaque", choices: ["Double attaque", "Roque", "Final de pions"], description: "un coup cree deux problemes a la fois.", hint: "Compte les deux menaces apres le coup." },
    it: { answer: "Doppio attacco", choices: ["Doppio attacco", "Arrocco", "Finale di pedoni"], description: "una mossa crea due problemi insieme.", hint: "Conta le due minacce dopo la mossa." },
    pt: { answer: "Ataque duplo", choices: ["Ataque duplo", "Roque", "Final de peoes"], description: "um lance cria dois problemas ao mesmo tempo.", hint: "Conte as duas ameacas depois do lance." },
  },
  deflection: {
    fr: { answer: "Deviation", choices: ["Deviation", "Promotion", "Opposition"], description: "on attire un defenseur loin de sa tache.", hint: "La piece defendait quelque chose d'important." },
    it: { answer: "Deviazione", choices: ["Deviazione", "Promozione", "Opposizione"], description: "si porta un difensore lontano dal suo compito.", hint: "Il pezzo stava difendendo qualcosa di importante." },
    pt: { answer: "Desvio", choices: ["Desvio", "Promocao", "Oposicao"], description: "um defensor e afastado da sua tarefa.", hint: "A peca defendia algo importante." },
  },
  attraction: {
    fr: { answer: "Attraction", choices: ["Attraction", "Clouage", "Pion passe"], description: "on attire une piece sur une case moins sure.", hint: "La piece est invitee au mauvais endroit." },
    it: { answer: "Attrazione", choices: ["Attrazione", "Inchiodatura", "Pedone passato"], description: "si attira un pezzo su una casa meno sicura.", hint: "Il pezzo viene invitato nel posto sbagliato." },
    pt: { answer: "Atracao", choices: ["Atracao", "Cravada", "Peao passado"], description: "uma peca e atraida para uma casa menos segura.", hint: "A peca e convidada para o lugar errado." },
  },
  "overloaded-defender": {
    fr: { answer: "Defenseur surcharge", choices: ["Defenseur surcharge", "Roque", "Pat"], description: "une piece defend trop de choses a la fois.", hint: "Le defenseur ne peut pas tout proteger." },
    it: { answer: "Difensore sovraccarico", choices: ["Difensore sovraccarico", "Arrocco", "Stallo"], description: "un pezzo difende troppe cose insieme.", hint: "Il difensore non puo proteggere tutto." },
    pt: { answer: "Defensor sobrecarregado", choices: ["Defensor sobrecarregado", "Roque", "Afogamento"], description: "uma peca defende coisas demais ao mesmo tempo.", hint: "O defensor nao consegue proteger tudo." },
  },
  "remove-defender": {
    fr: { answer: "Supprimer le defenseur", choices: ["Supprimer le defenseur", "Changer de couleur", "Roque court"], description: "on capture ou echange la piece qui protege.", hint: "La cible devient faible apres le depart du defenseur." },
    it: { answer: "Eliminare il difensore", choices: ["Eliminare il difensore", "Cambiare colore", "Arrocco corto"], description: "si cattura o cambia il pezzo che protegge.", hint: "Il bersaglio diventa debole quando il difensore sparisce." },
    pt: { answer: "Remover defensor", choices: ["Remover defensor", "Trocar de cor", "Roque pequeno"], description: "captura-se ou troca-se a peca que protege.", hint: "O alvo fica fraco quando o defensor sai." },
  },
  clearance: {
    fr: { answer: "Degagement", choices: ["Degagement", "Fourchette", "Nulle"], description: "une piece libere une case ou une ligne pour une autre.", hint: "Le premier coup fait de la place." },
    it: { answer: "Sgombero", choices: ["Sgombero", "Forchetta", "Patta"], description: "un pezzo libera una casa o una linea per un altro.", hint: "La prima mossa fa spazio." },
    pt: { answer: "Liberacao", choices: ["Liberacao", "Garfo", "Empate"], description: "uma peca libera uma casa ou linha para outra.", hint: "O primeiro lance abre espaco." },
  },
  zwischenzug: {
    fr: { answer: "Coup intermediaire", choices: ["Coup intermediaire", "Roque", "Promotion"], description: "on glisse un coup utile avant la reponse attendue.", hint: "Ne reponds pas tout de suite: il y a un coup entre les deux." },
    it: { answer: "Mossa intermedia", choices: ["Mossa intermedia", "Arrocco", "Promozione"], description: "si inserisce una mossa utile prima della risposta prevista.", hint: "Non rispondere subito: c'e una mossa in mezzo." },
    pt: { answer: "Lance intermediario", choices: ["Lance intermediario", "Roque", "Promocao"], description: "entra um lance util antes da resposta esperada.", hint: "Nao responda logo: ha um lance no meio." },
  },
  "trapped-piece": {
    fr: { answer: "Piece piegee", choices: ["Piece piegee", "Pion passe", "Roque"], description: "une piece attaquee n'a presque plus de cases.", hint: "Regarde toutes les cases de fuite." },
    it: { answer: "Pezzo intrappolato", choices: ["Pezzo intrappolato", "Pedone passato", "Arrocco"], description: "un pezzo attaccato ha quasi nessuna casa.", hint: "Controlla tutte le case di fuga." },
    pt: { answer: "Peca presa", choices: ["Peca presa", "Peao passado", "Roque"], description: "uma peca atacada quase nao tem casas.", hint: "Confira todas as casas de fuga." },
  },
  promotion: {
    fr: { answer: "Promotion", choices: ["Promotion", "Clouage", "Pat"], description: "un pion atteint la derniere rangee et devient plus fort.", hint: "Le pion arrive au bout du plateau." },
    it: { answer: "Promozione", choices: ["Promozione", "Inchiodatura", "Stallo"], description: "un pedone arriva in fondo e diventa piu forte.", hint: "Il pedone raggiunge l'ultima traversa." },
    pt: { answer: "Promocao", choices: ["Promocao", "Cravada", "Afogamento"], description: "um peao chega ao fim e fica mais forte.", hint: "O peao chega a ultima fileira." },
  },
  "open-file": {
    fr: { answer: "Colonne ouverte", choices: ["Colonne ouverte", "Fourchette", "Pion bloque"], description: "une tour utilise une colonne sans pions.", hint: "La ligne verticale est libre." },
    it: { answer: "Colonna aperta", choices: ["Colonna aperta", "Forchetta", "Pedone bloccato"], description: "una torre usa una colonna senza pedoni.", hint: "La linea verticale e libera." },
    pt: { answer: "Coluna aberta", choices: ["Coluna aberta", "Garfo", "Peao bloqueado"], description: "uma torre usa uma coluna sem peoes.", hint: "A linha vertical esta livre." },
  },
  outpost: {
    fr: { answer: "Avant-poste", choices: ["Avant-poste", "Roque", "Echec perpetuel"], description: "un cavalier s'installe sur une case forte et stable.", hint: "La piece est protegee et difficile a chasser." },
    it: { answer: "Avamposto", choices: ["Avamposto", "Arrocco", "Scacco perpetuo"], description: "un cavallo si sistema su una casa forte e stabile.", hint: "Il pezzo e protetto e difficile da scacciare." },
    pt: { answer: "Posto avancado", choices: ["Posto avancado", "Roque", "Xeque perpetuo"], description: "um cavalo fica numa casa forte e estavel.", hint: "A peca esta protegida e dificil de expulsar." },
  },
  "passed-pawn": {
    fr: { answer: "Pion passe", choices: ["Pion passe", "Mat du couloir", "Roque"], description: "aucun pion adverse ne peut arreter ce pion directement.", hint: "Le chemin devant le pion est clair." },
    it: { answer: "Pedone passato", choices: ["Pedone passato", "Matto di corridoio", "Arrocco"], description: "nessun pedone avversario puo fermarlo direttamente.", hint: "La strada davanti al pedone e libera." },
    pt: { answer: "Peao passado", choices: ["Peao passado", "Mate de corredor", "Roque"], description: "nenhum peao adversario pode para-lo diretamente.", hint: "O caminho a frente do peao esta livre." },
  },
  "stalemate-trap": {
    fr: { answer: "Piege de pat", choices: ["Piege de pat", "Promotion facile", "Roque"], description: "le cote en difficulte cherche a ne plus avoir de coup legal.", hint: "Sans echec et sans coup legal, la partie est nulle." },
    it: { answer: "Trappola di stallo", choices: ["Trappola di stallo", "Promozione facile", "Arrocco"], description: "chi e in difficolta cerca di non avere mosse legali.", hint: "Senza scacco e senza mosse legali, e patta." },
    pt: { answer: "Armadilha de afogamento", choices: ["Armadilha de afogamento", "Promocao facil", "Roque"], description: "o lado pior tenta ficar sem lance legal.", hint: "Sem xeque e sem lance legal, e empate." },
  },
  opposition: {
    fr: { answer: "Opposition", choices: ["Opposition", "Fourchette", "Attaque decouverte"], description: "les rois se font face pour gagner le passage.", hint: "Les rois comptent les cases entre eux." },
    it: { answer: "Opposizione", choices: ["Opposizione", "Forchetta", "Attacco di scoperta"], description: "i re si fronteggiano per guadagnare il passaggio.", hint: "I re contano le case tra loro." },
    pt: { answer: "Oposicao", choices: ["Oposicao", "Garfo", "Ataque descoberto"], description: "os reis se encaram para ganhar passagem.", hint: "Os reis contam as casas entre eles." },
  },
};

function buildExtraChessPuzzleBank(language: ExtraGameLanguage): SocialGameRound[] {
  const copy = extraChessCopy[language];

  return chessPuzzleThemes.flatMap((theme) => {
    const concept = extraChessConcepts[theme.tag][language];

    return theme.variants.map((variant, index) => ({
      id: variant.suffix ? `${theme.id}-${variant.suffix}` : theme.id,
      kind: "chess" as const,
      title: copy.title,
      body: copy.body,
      prompt: `${copy.positionLabel(index)} ${concept.description} ${copy.question}`,
      choices: [...concept.choices],
      answer: concept.answer,
      hint: concept.hint,
      tags: ["games", "chess", "game:chess", `chess:${theme.tag}`],
      estimatedDurationSeconds: variant.estimatedDurationSeconds ?? 95,
      successMessage: copy.successMessage,
    }));
  });
}

const chessPuzzleBank: Record<SocialGameLanguage, SocialGameRound[]> = {
  en: buildChessPuzzleBank("en"),
  es: buildChessPuzzleBank("es"),
  de: buildChessPuzzleBank("de"),
  fr: buildExtraChessPuzzleBank("fr"),
  it: buildExtraChessPuzzleBank("it"),
  pt: buildExtraChessPuzzleBank("pt"),
};

type WordPuzzleVariant = {
  suffix: string;
  tiles?: LocalizedText;
  clue?: LocalizedText;
  baseWord?: LocalizedText;
  letter?: LocalizedText;
  choices: Record<SocialLanguage, string[]>;
  answer: LocalizedText;
  hint: LocalizedText;
  estimatedDurationSeconds?: number;
};

type WordPuzzleTheme = {
  id: string;
  tag: string;
  body: LocalizedText;
  successMessage: LocalizedText;
  prompt: (variant: WordPuzzleVariant, language: SocialLanguage) => string;
  variants: WordPuzzleVariant[];
};

const wordRoundTitles: LocalizedText = {
  en: "Word tiles",
  es: "Letras",
  de: "Wortsteine",
};

function localizedField(variant: WordPuzzleVariant, field: keyof WordPuzzleVariant, language: SocialLanguage) {
  const value = variant[field];
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return (value as LocalizedText)[language] ?? "";
}

function buildWordPuzzleBank(language: SocialLanguage): SocialGameRound[] {
  return wordPuzzleThemes.flatMap((theme) =>
    theme.variants.map((variant) => ({
      id: `${theme.id}-${variant.suffix}`,
      kind: "word" as const,
      title: wordRoundTitles[language],
      body: theme.body[language],
      prompt: theme.prompt(variant, language),
      choices: variant.choices[language],
      answer: variant.answer[language],
      hint: variant.hint[language],
      tags: ["games", "scrabble", "words", "game:word", `word:${theme.tag}`],
      estimatedDurationSeconds: variant.estimatedDurationSeconds ?? 80,
      successMessage: theme.successMessage[language],
    })),
  );
}

const wordPuzzleThemes: WordPuzzleTheme[] = [
  {
    id: "word-tiles-anagram",
    tag: "anagram",
    body: { en: "Make a word from the tiles.", es: "Forma una palabra con las letras.", de: "Bilde ein Wort aus den Steinen." },
    successMessage: {
      en: "Lovely. Anagrams make word games feel quick and social.",
      es: "Bonito. Los anagramas hacen que las letras sean rapidas y sociales.",
      de: "Sehr schoen. Anagramme machen Wortspiele kurz und gesellig.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Nutze die Buchstaben ${localizedField(variant, "tiles", language)}. Welches Wort passt?`
        : language === "en"
          ? `Use the tiles ${localizedField(variant, "tiles", language)}. Which word can you make?`
          : `Usa las letras ${localizedField(variant, "tiles", language)}. Que palabra puedes formar?`,
    variants: [
      {
        suffix: "smile",
        tiles: { en: "S, M, I, L, E", es: "S, A, L, U, D", de: "H, A, L, L, O" },
        choices: { en: ["SMILE", "LIMES", "MILES"], es: ["SALUD", "DULSA", "LUDAS"], de: ["HALLO", "LOHLA", "HOLAL"] },
        answer: { en: "SMILE", es: "SALUD", de: "HALLO" },
        hint: { en: "Choose the word you could send as a greeting.", es: "Elige una palabra que tambien es un buen deseo.", de: "Waehle das Wort, mit dem ein Gruss beginnt." },
        estimatedDurationSeconds: 75,
      },
      {
        suffix: "peace",
        tiles: { en: "P, E, A, C, E", es: "P, A, Z", de: "R, U, H, E" },
        choices: { en: ["PEACE", "PACES", "CAPES"], es: ["PAZ", "ZAP", "PAS"], de: ["RUHE", "HEUR", "UHER"] },
        answer: { en: "PEACE", es: "PAZ", de: "RUHE" },
        hint: { en: "It means calm between people.", es: "Significa calma entre personas.", de: "Es bedeutet Stille und Frieden." },
      },
      {
        suffix: "garden",
        tiles: { en: "G, A, R, D, E, N", es: "J, A, R, D, I, N", de: "G, A, R, T, E, N" },
        choices: { en: ["GARDEN", "DANGER", "RANGED"], es: ["JARDIN", "DINJAR", "RINDJA"], de: ["GARTEN", "TRAGEN", "NAGERT"] },
        answer: { en: "GARDEN", es: "JARDIN", de: "GARTEN" },
        hint: { en: "Think flowers and a quiet path.", es: "Piensa en flores y un camino tranquilo.", de: "Denk an Blumen und einen ruhigen Weg." },
      },
      {
        suffix: "music",
        tiles: { en: "M, U, S, I, C", es: "M, U, S, I, C, A", de: "M, U, S, I, K" },
        choices: { en: ["MUSIC", "MUCIS", "SUMIC"], es: ["MUSICA", "CASIUM", "SUMICA"], de: ["MUSIK", "KUSIM", "SUMIK"] },
        answer: { en: "MUSIC", es: "MUSICA", de: "MUSIK" },
        hint: { en: "Choose the word for songs and melody.", es: "Elige la palabra de canciones y melodia.", de: "Waehle das Wort fuer Lieder und Melodie." },
      },
    ],
  },
  {
    id: "word-tiles-best-word",
    tag: "best-word",
    body: { en: "Pick the clearest word.", es: "Elige la palabra mas clara.", de: "Waehle das klarste Wort." },
    successMessage: {
      en: "Good choice. Finding a familiar word makes the next chat easier.",
      es: "Buena eleccion. Una palabra familiar abre la charla.",
      de: "Gute Wahl. Ein vertrautes Wort macht das Gespraech leichter.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Aus den Buchstaben ${localizedField(variant, "tiles", language)}: welches Wort ist am freundlichsten?`
        : language === "en"
          ? `From the tiles ${localizedField(variant, "tiles", language)}, which friendly word is best?`
          : `Con las letras ${localizedField(variant, "tiles", language)}, que palabra amable es mejor?`,
    variants: [
      {
        suffix: "table",
        tiles: { en: "T, A, B, L, E", es: "M, E, S, A", de: "T, I, S, C, H" },
        choices: { en: ["TABLE", "BLEAT", "BETAL"], es: ["MESA", "SEMA", "AMES"], de: ["TISCH", "SICHT", "CHITS"] },
        answer: { en: "TABLE", es: "MESA", de: "TISCH" },
        hint: { en: "It is where the games sit.", es: "Es donde estan los juegos.", de: "Dort liegen die Spiele." },
      },
      {
        suffix: "friend",
        tiles: { en: "F, R, I, E, N, D", es: "A, M, I, G, O", de: "F, R, E, U, N, D" },
        choices: { en: ["FRIEND", "FINDER", "DINERF"], es: ["AMIGO", "MAGIO", "GOIMA"], de: ["FREUND", "FUNDRE", "RUNDEF"] },
        answer: { en: "FRIEND", es: "AMIGO", de: "FREUND" },
        hint: { en: "Someone you enjoy meeting.", es: "Alguien que disfrutas ver.", de: "Jemand, den man gern trifft." },
      },
      {
        suffix: "health",
        tiles: { en: "H, E, A, L, T, H", es: "S, A, L, U, D", de: "G, E, S, U, N, D" },
        choices: { en: ["HEALTH", "LATHEH", "THELAH"], es: ["SALUD", "DULSA", "LUDAS"], de: ["GESUND", "DUNSEG", "SUNDGE"] },
        answer: { en: "HEALTH", es: "SALUD", de: "GESUND" },
        hint: { en: "It is about feeling well.", es: "Tiene que ver con estar bien.", de: "Es geht darum, sich wohl zu fuehlen." },
      },
      {
        suffix: "memory",
        tiles: { en: "M, E, M, O, R, Y", es: "M, E, M, O, R, I, A", de: "M, E, R, K, E, N" },
        choices: { en: ["MEMORY", "YOMMER", "REMOMY"], es: ["MEMORIA", "AMOREMI", "MIREOMA"], de: ["MERKEN", "KREMEN", "NERKEM"] },
        answer: { en: "MEMORY", es: "MEMORIA", de: "MERKEN" },
        hint: { en: "This word fits remembering games.", es: "Esta palabra encaja con juegos de recordar.", de: "Dieses Wort passt zu Merkspielen." },
      },
    ],
  },
  {
    id: "word-tiles-add-letter",
    tag: "add-letter",
    body: { en: "Add one tile to make a new word.", es: "Anade una letra para formar otra palabra.", de: "Fuege einen Stein hinzu." },
    successMessage: {
      en: "Nicely spotted. One tile can change the whole table.",
      es: "Bien visto. Una letra puede cambiar toda la mesa.",
      de: "Gut gesehen. Ein Stein kann den ganzen Tisch veraendern.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Fuege ${localizedField(variant, "letter", language)} zu ${localizedField(variant, "baseWord", language)} hinzu. Welches neue Wort entsteht?`
        : language === "en"
          ? `Add ${localizedField(variant, "letter", language)} to ${localizedField(variant, "baseWord", language)}. Which new word can you make?`
          : `Anade ${localizedField(variant, "letter", language)} a ${localizedField(variant, "baseWord", language)}. Que palabra nueva puedes formar?`,
    variants: [
      {
        suffix: "heart",
        baseWord: { en: "HEAR", es: "AMOR", de: "HERZ" },
        letter: { en: "T", es: "ES", de: "EN" },
        choices: { en: ["HEART", "EARTH", "HATER"], es: ["AMORES", "ROMESA", "MORAES"], de: ["HERZEN", "ZEHREN", "REHENZ"] },
        answer: { en: "HEART", es: "AMORES", de: "HERZEN" },
        hint: { en: "Think warmth and care.", es: "Piensa en carino.", de: "Denk an Waerme und Zuneigung." },
      },
      {
        suffix: "plant",
        baseWord: { en: "PLAN", es: "PLANTA", de: "PFLANZ" },
        letter: { en: "T", es: "R", de: "E" },
        choices: { en: ["PLANT", "PLANE", "PANEL"], es: ["PLANTAR", "RAPTALN", "TANLAPR"], de: ["PFLANZE", "ZAPFELN", "FLANZEP"] },
        answer: { en: "PLANT", es: "PLANTAR", de: "PFLANZE" },
        hint: { en: "It grows in a pot or garden.", es: "Crece en maceta o jardin.", de: "Sie waechst im Topf oder Garten." },
      },
      {
        suffix: "shore",
        baseWord: { en: "SORE", es: "ORILLA", de: "UFER" },
        letter: { en: "H", es: "S", de: "N" },
        choices: { en: ["SHORE", "HORSE", "HOERS"], es: ["ORILLAS", "SILLARO", "RILLOSA"], de: ["UFERN", "RUFER", "FREUN"] },
        answer: { en: "SHORE", es: "ORILLAS", de: "UFERN" },
        hint: { en: "Think of water meeting land.", es: "Piensa en agua junto a tierra.", de: "Denk an Wasser und Land." },
      },
      {
        suffix: "chair",
        baseWord: { en: "HAIR", es: "SILLA", de: "STUHL" },
        letter: { en: "C", es: "S", de: "E" },
        choices: { en: ["CHAIR", "CAHIR", "RACHI"], es: ["SILLAS", "SISALL", "SALILS"], de: ["STUHLE", "HUSTEL", "LESTUH"] },
        answer: { en: "CHAIR", es: "SILLAS", de: "STUHLE" },
        hint: { en: "A good seat for a game.", es: "Un buen asiento para jugar.", de: "Ein guter Sitz fuer ein Spiel." },
      },
    ],
  },
  {
    id: "word-tiles-front-hook",
    tag: "front-hook",
    body: { en: "Place a tile at the front.", es: "Pon una letra al principio.", de: "Setze einen Stein nach vorn." },
    successMessage: {
      en: "Good hook. Front letters are a tidy way to grow a word.",
      es: "Buen gancho. Una letra al principio hace crecer la palabra.",
      de: "Guter Haken. Anfangsbuchstaben lassen Woerter wachsen.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Welche Wahl setzt einen Buchstaben vor ${localizedField(variant, "baseWord", language)} und ergibt ein neues Wort?`
        : language === "en"
          ? `Which choice adds a front tile to ${localizedField(variant, "baseWord", language)} and makes a new word?`
          : `Que opcion anade una letra delante de ${localizedField(variant, "baseWord", language)} y forma otra palabra?`,
    variants: [
      {
        suffix: "stone",
        baseWord: { en: "TONE", es: "ALA", de: "EIS" },
        choices: { en: ["STONE", "TONES", "ONSET"], es: ["SALA", "ALAS", "LASA"], de: ["REIS", "EISR", "SERI"] },
        answer: { en: "STONE", es: "SALA", de: "REIS" },
        hint: { en: "Add S at the front.", es: "Anade S al principio.", de: "Setze R nach vorn." },
      },
      {
        suffix: "train",
        baseWord: { en: "RAIN", es: "RAMA", de: "AST" },
        choices: { en: ["TRAIN", "RAINY", "RINAT"], es: ["TRAMA", "RAMAT", "MARAT"], de: ["MAST", "STAM", "AMST"] },
        answer: { en: "TRAIN", es: "TRAMA", de: "MAST" },
        hint: { en: "One letter turns rain into travel.", es: "Una letra cambia la rama en una historia.", de: "Ein Buchstabe macht daraus einen Mast." },
      },
      {
        suffix: "light",
        baseWord: { en: "RIGHT", es: "ALTO", de: "RAND" },
        choices: { en: ["LIGHT", "RIGHTS", "THRIG"], es: ["SALTO", "TALOS", "ALTOS"], de: ["BRAND", "RANDB", "DANBR"] },
        answer: { en: "LIGHT", es: "SALTO", de: "BRAND" },
        hint: { en: "Add L to make something bright.", es: "Anade S para una palabra de movimiento.", de: "Setze B davor." },
      },
      {
        suffix: "bread",
        baseWord: { en: "READ", es: "ROSA", de: "ROT" },
        choices: { en: ["BREAD", "DAREB", "BEARD"], es: ["PROSA", "ROSAP", "SAPRO"], de: ["BROT", "ROTB", "TROB"] },
        answer: { en: "BREAD", es: "PROSA", de: "BROT" },
        hint: { en: "Add B for something from the bakery.", es: "Anade P para una palabra de escritura.", de: "Setze B davor fuer Essen." },
      },
    ],
  },
  {
    id: "word-tiles-back-hook",
    tag: "back-hook",
    body: { en: "Place a tile at the end.", es: "Pon una letra al final.", de: "Setze einen Stein ans Ende." },
    successMessage: {
      en: "Nice ending. Back hooks are useful word-table moves.",
      es: "Buen final. Las letras al final ayudan mucho.",
      de: "Gutes Ende. Schlussbuchstaben helfen am Worttisch.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Welche Wahl setzt etwas ans Ende von ${localizedField(variant, "baseWord", language)}?`
        : language === "en"
          ? `Which choice adds a tile at the end of ${localizedField(variant, "baseWord", language)}?`
          : `Que opcion anade una letra al final de ${localizedField(variant, "baseWord", language)}?`,
    variants: [
      {
        suffix: "player",
        baseWord: { en: "PLAY", es: "JUEGO", de: "SPIEL" },
        choices: { en: ["PLAYER", "REPLAY", "PAYLER"], es: ["JUEGOS", "JUEGON", "JUEGOR"], de: ["SPIELE", "SPIELT", "PEILST"] },
        answer: { en: "PLAYER", es: "JUEGOS", de: "SPIELE" },
        hint: { en: "It names someone who plays.", es: "Es el plural de juego.", de: "Es ist die Mehrzahl." },
      },
      {
        suffix: "cards",
        baseWord: { en: "CARD", es: "CARTA", de: "KARTE" },
        choices: { en: ["CARDS", "SCARD", "DARCS"], es: ["CARTAS", "CASTAR", "RASCAT"], de: ["KARTEN", "RANKTE", "TANKER"] },
        answer: { en: "CARDS", es: "CARTAS", de: "KARTEN" },
        hint: { en: "Add S for more than one.", es: "Anade S para mas de una.", de: "Fuege N fuer die Mehrzahl hinzu." },
      },
      {
        suffix: "turns",
        baseWord: { en: "TURN", es: "TURNO", de: "ZUG" },
        choices: { en: ["TURNS", "RUNTS", "TRUNS"], es: ["TURNOS", "SOTURN", "NUTROS"], de: ["ZUGE", "ZEUG", "GEUZ"] },
        answer: { en: "TURNS", es: "TURNOS", de: "ZUGE" },
        hint: { en: "A game has many of these.", es: "Una partida tiene varios.", de: "Ein Spiel hat mehrere davon." },
      },
      {
        suffix: "scores",
        baseWord: { en: "SCORE", es: "PUNTO", de: "PUNKT" },
        choices: { en: ["SCORES", "CROSSE", "CORSES"], es: ["PUNTOS", "SUPONT", "TUSPON"], de: ["PUNKTE", "PUNTEK", "KUPTEN"] },
        answer: { en: "SCORES", es: "PUNTOS", de: "PUNKTE" },
        hint: { en: "Add S for more than one score.", es: "Anade S para mas de un punto.", de: "Fuege E fuer die Mehrzahl hinzu." },
      },
    ],
  },
  {
    id: "word-tiles-blank",
    tag: "blank",
    body: { en: "Choose the blank tile.", es: "Elige la ficha en blanco.", de: "Waehle den leeren Stein." },
    successMessage: {
      en: "Good blank choice. Flexible tiles make word games playful.",
      es: "Buena ficha en blanco. Las letras flexibles hacen el juego divertido.",
      de: "Gute Blanko-Wahl. Freie Steine machen Wortspiele lebendig.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Welche Buchstabe passt in ${localizedField(variant, "clue", language)}?`
        : language === "en"
          ? `Which blank tile completes ${localizedField(variant, "clue", language)}?`
          : `Que letra en blanco completa ${localizedField(variant, "clue", language)}?`,
    variants: [
      {
        suffix: "brave",
        clue: { en: "BRA_E", es: "_ALOR", de: "M_T" },
        choices: { en: ["V", "P", "S"], es: ["V", "C", "P"], de: ["U", "A", "I"] },
        answer: { en: "V", es: "V", de: "U" },
        hint: { en: "The completed word means courageous.", es: "La palabra completa significa coraje.", de: "Das fertige Wort bedeutet tapfer." },
      },
      {
        suffix: "share",
        clue: { en: "S_ARE", es: "C_MPIR", de: "TE_LEN" },
        choices: { en: ["H", "C", "P"], es: ["O", "A", "E"], de: ["I", "A", "O"] },
        answer: { en: "H", es: "O", de: "I" },
        hint: { en: "It is something friends do.", es: "Es algo que hacen los amigos.", de: "Das tun Freunde miteinander." },
      },
      {
        suffix: "clear",
        clue: { en: "CLE_R", es: "CL_RO", de: "K_AR" },
        choices: { en: ["A", "E", "I"], es: ["A", "E", "I"], de: ["L", "N", "R"] },
        answer: { en: "A", es: "A", de: "L" },
        hint: { en: "The word means easy to understand.", es: "Significa facil de entender.", de: "Es bedeutet gut zu verstehen." },
      },
      {
        suffix: "round",
        clue: { en: "RO_ND", es: "R_NDA", de: "R_NDE" },
        choices: { en: ["U", "A", "I"], es: ["O", "A", "U"], de: ["U", "A", "O"] },
        answer: { en: "U", es: "O", de: "U" },
        hint: { en: "This is one short game turn.", es: "Es una vuelta breve de juego.", de: "Das ist eine kurze Spielrunde." },
      },
    ],
  },
  {
    id: "word-tiles-prefix",
    tag: "prefix",
    body: { en: "Add a beginning.", es: "Anade un comienzo.", de: "Fuege einen Anfang hinzu." },
    successMessage: {
      en: "Nice prefix. Small beginnings can change meaning.",
      es: "Buen prefijo. Un inicio pequeno cambia el significado.",
      de: "Guter Anfang. Kleine Vorsilben veraendern Sinn.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Welches Wort entsteht mit einem passenden Anfang vor ${localizedField(variant, "baseWord", language)}?`
        : language === "en"
          ? `Which word adds a helpful beginning to ${localizedField(variant, "baseWord", language)}?`
          : `Que palabra anade un comienzo util a ${localizedField(variant, "baseWord", language)}?`,
    variants: [
      {
        suffix: "replay",
        baseWord: { en: "PLAY", es: "HACER", de: "SPIEL" },
        choices: { en: ["REPLAY", "PLAYER", "PAYREL"], es: ["REHACER", "HACERE", "CERHAE"], de: ["VORSPIEL", "SPIELVOR", "PEILVORS"] },
        answer: { en: "REPLAY", es: "REHACER", de: "VORSPIEL" },
        hint: { en: "RE means do it again.", es: "RE indica hacer otra vez.", de: "VOR steht am Anfang." },
      },
      {
        suffix: "undo",
        baseWord: { en: "DO", es: "ORDEN", de: "TUN" },
        choices: { en: ["UNDO", "DUNO", "OUND"], es: ["DESORDEN", "ORDENES", "REDONOS"], de: ["UNTUN", "TUNUN", "NUTUN"] },
        answer: { en: "UNDO", es: "DESORDEN", de: "UNTUN" },
        hint: { en: "UN changes the action.", es: "DES cambia la idea.", de: "UN veraendert die Handlung." },
      },
      {
        suffix: "preview",
        baseWord: { en: "VIEW", es: "VISTA", de: "SICHT" },
        choices: { en: ["PREVIEW", "REVIEWP", "VIEWPER"], es: ["PREVISTA", "VISTAPRE", "REVISTAP"], de: ["VORSICHT", "SICHTVOR", "RICHTVOS"] },
        answer: { en: "PREVIEW", es: "PREVISTA", de: "VORSICHT" },
        hint: { en: "PRE means before.", es: "PRE indica antes.", de: "VOR bedeutet vorher." },
      },
      {
        suffix: "return",
        baseWord: { en: "TURN", es: "VOLVER", de: "KEHR" },
        choices: { en: ["RETURN", "TURNER", "UNTRER"], es: ["REVOLVER", "VOLVERE", "VERLOVER"], de: ["RUECKKEHR", "KEHRRUECK", "KUEHRRECK"] },
        answer: { en: "RETURN", es: "REVOLVER", de: "RUECKKEHR" },
        hint: { en: "RE means back or again.", es: "RE puede indicar vuelta.", de: "RUECK bedeutet zurueck." },
      },
    ],
  },
  {
    id: "word-tiles-suffix",
    tag: "suffix",
    body: { en: "Add an ending.", es: "Anade un final.", de: "Fuege ein Ende hinzu." },
    successMessage: {
      en: "Good ending. Suffixes help words grow gently.",
      es: "Buen final. Los sufijos hacen crecer palabras.",
      de: "Gutes Ende. Nachsilben lassen Woerter wachsen.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Welche Wahl haengt ein sinnvolles Ende an ${localizedField(variant, "baseWord", language)}?`
        : language === "en"
          ? `Which choice adds a meaningful ending to ${localizedField(variant, "baseWord", language)}?`
          : `Que opcion anade un final con sentido a ${localizedField(variant, "baseWord", language)}?`,
    variants: [
      {
        suffix: "kindness",
        baseWord: { en: "KIND", es: "AMABLE", de: "FREUND" },
        choices: { en: ["KINDNESS", "KINDLY", "DINKNESS"], es: ["AMABLEZA", "AMABLES", "BELAMAZA"], de: ["FREUNDLICH", "FREUNDEN", "FREUNDLOS"] },
        answer: { en: "KINDNESS", es: "AMABLEZA", de: "FREUNDLICH" },
        hint: { en: "It names a warm quality.", es: "Nombra una cualidad calida.", de: "Es beschreibt warmes Verhalten." },
      },
      {
        suffix: "helpful",
        baseWord: { en: "HELP", es: "AYUDA", de: "HILFE" },
        choices: { en: ["HELPFUL", "HELPER", "FELPHU"], es: ["AYUDAR", "AYUDAS", "DUAYAR"], de: ["HILFREICH", "HILFEN", "REICHHILF"] },
        answer: { en: "HELPFUL", es: "AYUDAR", de: "HILFREICH" },
        hint: { en: "It describes someone who gives support.", es: "Tiene que ver con dar apoyo.", de: "So ist jemand, der unterstuetzt." },
      },
      {
        suffix: "joyful",
        baseWord: { en: "JOY", es: "ALEGRE", de: "FROH" },
        choices: { en: ["JOYFUL", "ENJOY", "FLOYJU"], es: ["ALEGRIA", "ALEGRES", "GALERIA"], de: ["FROHLICH", "FROHEN", "LICHFROH"] },
        answer: { en: "JOYFUL", es: "ALEGRIA", de: "FROHLICH" },
        hint: { en: "It is full of happiness.", es: "Esta lleno de alegria.", de: "Es voll Freude." },
      },
      {
        suffix: "rested",
        baseWord: { en: "REST", es: "DESCANSO", de: "RUHE" },
        choices: { en: ["RESTED", "RESTER", "STREDE"], es: ["DESCANSAR", "DESCANSOS", "CANSARDES"], de: ["RUHIG", "RUHEN", "HURIG"] },
        answer: { en: "RESTED", es: "DESCANSAR", de: "RUHIG" },
        hint: { en: "It follows a good pause.", es: "Viene tras una buena pausa.", de: "Es passt nach einer guten Pause." },
      },
    ],
  },
  {
    id: "word-tiles-two-letter",
    tag: "two-letter",
    body: { en: "Find the tiny helper word.", es: "Encuentra la palabra corta.", de: "Finde das kleine Hilfswort." },
    successMessage: {
      en: "Small words do big work on a word board.",
      es: "Las palabras cortas ayudan mucho en el tablero.",
      de: "Kleine Woerter helfen stark auf dem Wortbrett.",
    },
    prompt: (variant, language) => localizedField(variant, "clue", language),
    variants: [
      {
        suffix: "to",
        clue: { en: "Which two-letter word can point toward a place?", es: "Que palabra corta significa direccion hacia un lugar?", de: "Welches kurze Wort zeigt Richtung zu einem Ort?" },
        choices: { en: ["TO", "OT", "TA"], es: ["A", "LA", "AL"], de: ["ZU", "UZ", "ZA"] },
        answer: { en: "TO", es: "A", de: "ZU" },
        hint: { en: "You might go to the table.", es: "Puedes ir a la mesa.", de: "Man geht zu dem Tisch." },
        estimatedDurationSeconds: 65,
      },
      {
        suffix: "in",
        clue: { en: "Which two-letter word means inside?", es: "Que palabra corta significa dentro?", de: "Welches kurze Wort bedeutet drinnen?" },
        choices: { en: ["IN", "NI", "AN"], es: ["EN", "NE", "EL"], de: ["IN", "NI", "AN"] },
        answer: { en: "IN", es: "EN", de: "IN" },
        hint: { en: "The tiles are in the bag.", es: "Las letras estan en la bolsa.", de: "Die Steine sind in der Tasche." },
      },
      {
        suffix: "we",
        clue: { en: "Which tiny word means you and me together?", es: "Que palabra corta significa tu y yo juntos?", de: "Welches kleine Wort bedeutet du und ich zusammen?" },
        choices: { en: ["WE", "EW", "ME"], es: ["NOS", "SON", "UNO"], de: ["WIR", "IRW", "WER"] },
        answer: { en: "WE", es: "NOS", de: "WIR" },
        hint: { en: "It is the word for together.", es: "Es la palabra de estar juntos.", de: "Es ist das Wort fuer zusammen." },
      },
      {
        suffix: "am",
        clue: { en: "Which tiny word completes 'I __ ready'?", es: "Que palabra completa 'yo __ listo'?", de: "Welches kurze Wort passt zu 'ich __ bereit'?" },
        choices: { en: ["AM", "MA", "ME"], es: ["ESTOY", "SOY", "VOY"], de: ["BIN", "NIB", "BEI"] },
        answer: { en: "AM", es: "ESTOY", de: "BIN" },
        hint: { en: "It helps say how you are.", es: "Ayuda a decir como estas.", de: "Es hilft zu sagen, wie du bist." },
      },
    ],
  },
  {
    id: "word-tiles-score",
    tag: "score",
    body: { en: "Pick the simple high-value word.", es: "Elige la palabra de mas valor sencillo.", de: "Waehle das einfache Wort mit hohem Wert." },
    successMessage: {
      en: "Good scoring instinct. High-value letters can make a small word sparkle.",
      es: "Buen instinto de puntos. Letras valiosas hacen brillar una palabra corta.",
      de: "Gutes Punktegefuehl. Wertvolle Buchstaben lassen kleine Woerter glaenzen.",
    },
    prompt: (variant, language) => localizedField(variant, "clue", language),
    variants: [
      {
        suffix: "jazz",
        clue: { en: "Which word uses the valuable J and Z tiles?", es: "Que palabra usa letras valiosas como J y Z?", de: "Welches Wort nutzt wertvolle Buchstaben wie J und Z?" },
        choices: { en: ["JAZZ", "MILD", "TREE"], es: ["JAZZ", "MESA", "CASA"], de: ["JAZZ", "TISCH", "BAUM"] },
        answer: { en: "JAZZ", es: "JAZZ", de: "JAZZ" },
        hint: { en: "The rare letters stand out.", es: "Las letras raras destacan.", de: "Die seltenen Buchstaben fallen auf." },
      },
      {
        suffix: "quiz",
        clue: { en: "Which short word feels most valuable because of Q and Z?", es: "Que palabra corta parece mas valiosa por Q y Z?", de: "Welches kurze Wort wirkt wegen Q und Z besonders wertvoll?" },
        choices: { en: ["QUIZ", "SAND", "MILK"], es: ["QUIZ", "LUNA", "MANO"], de: ["QUIZ", "HAUS", "HAND"] },
        answer: { en: "QUIZ", es: "QUIZ", de: "QUIZ" },
        hint: { en: "Q and Z are the stars here.", es: "Q y Z son las estrellas.", de: "Q und Z sind hier die Stars." },
      },
      {
        suffix: "box",
        clue: { en: "Which word uses the stronger X tile?", es: "Que palabra usa la X fuerte?", de: "Welches Wort nutzt den starken X-Stein?" },
        choices: { en: ["BOX", "BOY", "BOW"], es: ["EXTRA", "ESTAR", "TAREA"], de: ["EXTRA", "ERSTE", "ARTEN"] },
        answer: { en: "BOX", es: "EXTRA", de: "EXTRA" },
        hint: { en: "Look for X.", es: "Busca la X.", de: "Achte auf X." },
      },
      {
        suffix: "joy",
        clue: { en: "Which word uses the J tile and also feels cheerful?", es: "Que palabra usa J y tambien suena alegre?", de: "Welches Wort nutzt J und klingt froh?" },
        choices: { en: ["JOY", "TOY", "BOY"], es: ["JUEGO", "FUEGO", "LUEGO"], de: ["JUBEL", "NEBEL", "HEBEL"] },
        answer: { en: "JOY", es: "JUEGO", de: "JUBEL" },
        hint: { en: "Choose the happy J word.", es: "Elige la palabra alegre con J.", de: "Waehle das frohe J-Wort." },
      },
    ],
  },
  {
    id: "word-tiles-food",
    tag: "category-food",
    body: { en: "Find the food word.", es: "Encuentra la palabra de comida.", de: "Finde das Essenswort." },
    successMessage: {
      en: "Tasty clue. Food words are easy conversation starters.",
      es: "Pista sabrosa. Las comidas abren conversacion.",
      de: "Leckerer Hinweis. Essenswoerter starten leicht Gespraeche.",
    },
    prompt: (variant, language) => localizedField(variant, "clue", language),
    variants: [
      {
        suffix: "apple",
        clue: { en: "Which choice is a fruit?", es: "Que opcion es una fruta?", de: "Welche Wahl ist eine Frucht?" },
        choices: { en: ["APPLE", "CHAIR", "CLOCK"], es: ["MANZANA", "SILLA", "RELOJ"], de: ["APFEL", "STUHL", "UHR"] },
        answer: { en: "APPLE", es: "MANZANA", de: "APFEL" },
        hint: { en: "It can be red or green.", es: "Puede ser roja o verde.", de: "Er kann rot oder gruen sein." },
      },
      {
        suffix: "bread",
        clue: { en: "Which word comes from the bakery?", es: "Que palabra viene de la panaderia?", de: "Welches Wort kommt aus der Baeckerei?" },
        choices: { en: ["BREAD", "RIVER", "PHOTO"], es: ["PAN", "RIO", "FOTO"], de: ["BROT", "FLUSS", "FOTO"] },
        answer: { en: "BREAD", es: "PAN", de: "BROT" },
        hint: { en: "It is good with soup.", es: "Va bien con sopa.", de: "Es passt gut zu Suppe." },
      },
      {
        suffix: "lemon",
        clue: { en: "Which word is yellow and fresh?", es: "Que palabra es amarilla y fresca?", de: "Welches Wort ist gelb und frisch?" },
        choices: { en: ["LEMON", "TABLE", "PAPER"], es: ["LIMON", "MESA", "PAPEL"], de: ["ZITRONE", "TISCH", "PAPIER"] },
        answer: { en: "LEMON", es: "LIMON", de: "ZITRONE" },
        hint: { en: "It can flavor tea.", es: "Puede dar sabor al te.", de: "Sie passt in Tee." },
      },
      {
        suffix: "soup",
        clue: { en: "Which word is warm in a bowl?", es: "Que palabra es caliente en un cuenco?", de: "Welches Wort ist warm in einer Schale?" },
        choices: { en: ["SOUP", "SOAP", "SLOPE"], es: ["SOPA", "SAPO", "PASO"], de: ["SUPPE", "PUPPE", "PESUP"] },
        answer: { en: "SOUP", es: "SOPA", de: "SUPPE" },
        hint: { en: "A spoon helps.", es: "Ayuda una cuchara.", de: "Ein Loeffel hilft." },
      },
    ],
  },
  {
    id: "word-tiles-home",
    tag: "category-home",
    body: { en: "Find the home word.", es: "Encuentra la palabra de casa.", de: "Finde das Zuhause-Wort." },
    successMessage: {
      en: "Comfortable clue. Home words feel familiar at the table.",
      es: "Pista comoda. Las palabras de casa se sienten familiares.",
      de: "Gemutlicher Hinweis. Zuhause-Woerter fuehlen sich vertraut an.",
    },
    prompt: (variant, language) => localizedField(variant, "clue", language),
    variants: [
      {
        suffix: "chair",
        clue: { en: "Which choice is something you sit on?", es: "En que opcion te puedes sentar?", de: "Worauf kann man sitzen?" },
        choices: { en: ["CHAIR", "CLOUD", "RIVER"], es: ["SILLA", "NUBE", "RIO"], de: ["STUHL", "WOLKE", "FLUSS"] },
        answer: { en: "CHAIR", es: "SILLA", de: "STUHL" },
        hint: { en: "It belongs near the table.", es: "Esta cerca de la mesa.", de: "Er steht nah am Tisch." },
      },
      {
        suffix: "lamp",
        clue: { en: "Which word gives light at home?", es: "Que palabra da luz en casa?", de: "Welches Wort gibt Licht zu Hause?" },
        choices: { en: ["LAMP", "LAND", "LAMB"], es: ["LAMPARA", "MANTA", "PLANTA"], de: ["LAMPE", "MAPPE", "RAMPE"] },
        answer: { en: "LAMP", es: "LAMPARA", de: "LAMPE" },
        hint: { en: "It helps you read.", es: "Ayuda a leer.", de: "Sie hilft beim Lesen." },
      },
      {
        suffix: "clock",
        clue: { en: "Which word tells time?", es: "Que palabra marca la hora?", de: "Welches Wort zeigt die Zeit?" },
        choices: { en: ["CLOCK", "BLOCK", "CLOAK"], es: ["RELOJ", "JOLER", "LOJER"], de: ["UHR", "RUH", "HUR"] },
        answer: { en: "CLOCK", es: "RELOJ", de: "UHR" },
        hint: { en: "It has hands or numbers.", es: "Tiene agujas o numeros.", de: "Sie hat Zeiger oder Zahlen." },
      },
      {
        suffix: "window",
        clue: { en: "Which word lets you look outside?", es: "Que palabra te deja mirar afuera?", de: "Welches Wort laesst dich nach draussen schauen?" },
        choices: { en: ["WINDOW", "PILLOW", "MEADOW"], es: ["VENTANA", "MANTA", "VENA"], de: ["FENSTER", "RESTENF", "ERFENTS"] },
        answer: { en: "WINDOW", es: "VENTANA", de: "FENSTER" },
        hint: { en: "Light comes through it.", es: "La luz entra por ahi.", de: "Licht kommt hindurch." },
      },
    ],
  },
  {
    id: "word-tiles-greeting",
    tag: "greeting",
    body: { en: "Choose a social word.", es: "Elige una palabra social.", de: "Waehle ein geselliges Wort." },
    successMessage: {
      en: "Warm word. Social words make it easier to say hello.",
      es: "Palabra calida. Las palabras sociales facilitan saludar.",
      de: "Warmes Wort. Gesellige Woerter machen Hallo leichter.",
    },
    prompt: (variant, language) => localizedField(variant, "clue", language),
    variants: [
      {
        suffix: "hello",
        clue: { en: "Which word starts a friendly chat?", es: "Que palabra inicia una charla amable?", de: "Welches Wort beginnt ein freundliches Gespraech?" },
        choices: { en: ["HELLO", "HOLLOW", "ALLOW"], es: ["HOLA", "OLA", "ALHO"], de: ["HALLO", "HOLLA", "LOHLA"] },
        answer: { en: "HELLO", es: "HOLA", de: "HALLO" },
        hint: { en: "It is the first friendly word.", es: "Es la primera palabra amable.", de: "Es ist das erste freundliche Wort." },
      },
      {
        suffix: "thanks",
        clue: { en: "Which word shows gratitude?", es: "Que palabra muestra gratitud?", de: "Welches Wort zeigt Dank?" },
        choices: { en: ["THANKS", "STHANK", "SNATHK"], es: ["GRACIAS", "GARCIAS", "SACRIGA"], de: ["DANKE", "DENKE", "KANTE"] },
        answer: { en: "THANKS", es: "GRACIAS", de: "DANKE" },
        hint: { en: "You say it after help.", es: "Se dice tras recibir ayuda.", de: "Man sagt es nach Hilfe." },
      },
      {
        suffix: "welcome",
        clue: { en: "Which word makes someone feel invited?", es: "Que palabra hace sentir invitado a alguien?", de: "Welches Wort laedt freundlich ein?" },
        choices: { en: ["WELCOME", "COMEWEL", "MELOWEC"], es: ["BIENVENIDO", "VENIDOBIEN", "BIENDOVEN"], de: ["WILLKOMMEN", "KOMMENWILL", "WILLKOMNE"] },
        answer: { en: "WELCOME", es: "BIENVENIDO", de: "WILLKOMMEN" },
        hint: { en: "It belongs at the door.", es: "Pertenece a la entrada.", de: "Es passt an die Tuer." },
      },
      {
        suffix: "friend",
        clue: { en: "Which word names someone kind to play with?", es: "Que palabra nombra a alguien amable para jugar?", de: "Welches Wort nennt jemanden, mit dem man gern spielt?" },
        choices: { en: ["FRIEND", "FINDER", "DINER"], es: ["AMIGO", "MAGIO", "GOIMA"], de: ["FREUND", "FUNDRE", "RUNDEF"] },
        answer: { en: "FRIEND", es: "AMIGO", de: "FREUND" },
        hint: { en: "A good partner at the table.", es: "Una buena compania en la mesa.", de: "Ein guter Partner am Tisch." },
      },
    ],
  },
  {
    id: "word-tiles-board",
    tag: "board-game",
    body: { en: "Find the game-table word.", es: "Encuentra la palabra de juego.", de: "Finde das Spieltisch-Wort." },
    successMessage: {
      en: "That fits the table. Game words give people something easy to share.",
      es: "Encaja con la mesa. Las palabras de juego se comparten facilmente.",
      de: "Das passt zum Tisch. Spielwoerter teilen sich leicht.",
    },
    prompt: (variant, language) => localizedField(variant, "clue", language),
    variants: [
      {
        suffix: "tile",
        clue: { en: "Which word names a small letter piece?", es: "Que palabra nombra una pieza con letra?", de: "Welches Wort nennt einen kleinen Buchstabenstein?" },
        choices: { en: ["TILE", "LITE", "TIE"], es: ["FICHA", "HACIF", "CHIFA"], de: ["STEIN", "EINST", "NIEST"] },
        answer: { en: "TILE", es: "FICHA", de: "STEIN" },
        hint: { en: "You place it on the board.", es: "La colocas en el tablero.", de: "Man legt ihn aufs Brett." },
      },
      {
        suffix: "board",
        clue: { en: "Which word is the surface for play?", es: "Que palabra es la superficie de juego?", de: "Welches Wort ist die Spielflaeche?" },
        choices: { en: ["BOARD", "BROAD", "ROABD"], es: ["TABLERO", "BOLERAT", "ROTABLE"], de: ["BRETT", "TREBT", "BTERT"] },
        answer: { en: "BOARD", es: "TABLERO", de: "BRETT" },
        hint: { en: "The tiles rest on it.", es: "Las fichas descansan ahi.", de: "Die Steine liegen darauf." },
      },
      {
        suffix: "score",
        clue: { en: "Which word counts points?", es: "Que palabra cuenta puntos?", de: "Welches Wort zaehlt Punkte?" },
        choices: { en: ["SCORE", "CORES", "ROCES"], es: ["PUNTO", "POTUN", "TUNPO"], de: ["PUNKT", "TUNPK", "KUNPT"] },
        answer: { en: "SCORE", es: "PUNTO", de: "PUNKT" },
        hint: { en: "It tells how the round is going.", es: "Dice como va la ronda.", de: "Es zeigt, wie die Runde laeuft." },
      },
      {
        suffix: "turn",
        clue: { en: "Which word means your time to play?", es: "Que palabra significa tu momento de jugar?", de: "Welches Wort bedeutet dein Moment im Spiel?" },
        choices: { en: ["TURN", "RUNT", "TUNR"], es: ["TURNO", "TRUNO", "NUTRO"], de: ["ZUG", "GUZ", "UZG"] },
        answer: { en: "TURN", es: "TURNO", de: "ZUG" },
        hint: { en: "Everyone gets one.", es: "Cada persona tiene uno.", de: "Jeder bekommt einen." },
      },
    ],
  },
  {
    id: "word-tiles-word-ladder",
    tag: "word-ladder",
    body: { en: "Change one letter.", es: "Cambia una letra.", de: "Aendere einen Buchstaben." },
    successMessage: {
      en: "Good small change. One letter can make a new path.",
      es: "Buen cambio pequeno. Una letra abre otro camino.",
      de: "Gute kleine Aenderung. Ein Buchstabe oeffnet einen neuen Weg.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Aendere einen Buchstaben in ${localizedField(variant, "baseWord", language)}. Welche Wahl ist ein neues Wort?`
        : language === "en"
          ? `Change one letter in ${localizedField(variant, "baseWord", language)}. Which choice is a new word?`
          : `Cambia una letra en ${localizedField(variant, "baseWord", language)}. Que opcion es otra palabra?`,
    variants: [
      {
        suffix: "cat-car",
        baseWord: { en: "CAT", es: "CASA", de: "HAUS" },
        choices: { en: ["CAR", "CART", "CAST"], es: ["CAMA", "CASAS", "COSA"], de: ["MAUS", "HAUSE", "HANS"] },
        answer: { en: "CAR", es: "CAMA", de: "MAUS" },
        hint: { en: "Only the last letter changes.", es: "Solo cambia una letra.", de: "Nur ein Buchstabe aendert sich." },
      },
      {
        suffix: "sand-send",
        baseWord: { en: "SAND", es: "PATO", de: "HAND" },
        choices: { en: ["SEND", "STAND", "SANDS"], es: ["GATO", "PLATO", "PATOS"], de: ["WAND", "HAEND", "HANDY"] },
        answer: { en: "SEND", es: "GATO", de: "WAND" },
        hint: { en: "Change A to E.", es: "Cambia P por G.", de: "Aendere H zu W." },
      },
      {
        suffix: "lamp-limp",
        baseWord: { en: "LAMP", es: "LUNA", de: "LAMP" },
        choices: { en: ["LIMP", "CLAMP", "LAMPS"], es: ["LANA", "LUNAS", "LUNAR"], de: ["LUMP", "LAMPE", "PALM"] },
        answer: { en: "LIMP", es: "LANA", de: "LUMP" },
        hint: { en: "One vowel changes.", es: "Cambia una vocal.", de: "Ein Vokal aendert sich." },
      },
      {
        suffix: "boat-coat",
        baseWord: { en: "BOAT", es: "MANO", de: "BOOT" },
        choices: { en: ["COAT", "BLOAT", "BOATS"], es: ["MALO", "MANOS", "MONA"], de: ["BROT", "BOOTE", "OBOT"] },
        answer: { en: "COAT", es: "MALO", de: "BROT" },
        hint: { en: "Change the first letter.", es: "Cambia una letra del centro.", de: "Aendere einen Buchstaben." },
      },
    ],
  },
  {
    id: "word-tiles-compound",
    tag: "compound",
    body: { en: "Join two small words.", es: "Une dos partes.", de: "Verbinde zwei kleine Woerter." },
    successMessage: {
      en: "Nice joining. Compound words feel like two tiles clicking together.",
      es: "Buena union. Las palabras compuestas encajan como fichas.",
      de: "Schoen verbunden. Zusammengesetzte Woerter klicken wie zwei Steine.",
    },
    prompt: (variant, language) => localizedField(variant, "clue", language),
    variants: [
      {
        suffix: "sunday",
        clue: { en: "SUN + DAY makes which word?", es: "CUMPLE + ANOS forma que palabra?", de: "SONNE + TAG ergibt welches Wort?" },
        choices: { en: ["SUNDAY", "DAYSUN", "SANDY"], es: ["CUMPLEANOS", "ANOSCUMPLE", "CUMPLOS"], de: ["SONNTAG", "TAGSONN", "SONGTAN"] },
        answer: { en: "SUNDAY", es: "CUMPLEANOS", de: "SONNTAG" },
        hint: { en: "It names a day.", es: "Es un dia especial.", de: "Es ist ein Tag." },
      },
      {
        suffix: "teacup",
        clue: { en: "TEA + CUP makes which word?", es: "CAFE + TERA forma que palabra?", de: "TEE + TASSE ergibt welches Wort?" },
        choices: { en: ["TEACUP", "CUPTEA", "PEACUT"], es: ["CAFETERA", "TERACAFE", "CAFETARE"], de: ["TEETASSE", "TASSETEE", "TEETASE"] },
        answer: { en: "TEACUP", es: "CAFETERA", de: "TEETASSE" },
        hint: { en: "It belongs with a warm drink.", es: "Tiene que ver con bebida caliente.", de: "Es passt zu einem warmen Getraenk." },
      },
      {
        suffix: "bookmark",
        clue: { en: "BOOK + MARK makes which word?", es: "MARCA + PAGINA forma que palabra?", de: "BUCH + ZEICHEN ergibt welches Wort?" },
        choices: { en: ["BOOKMARK", "MARKBOOK", "BROOKMAK"], es: ["MARCAPAGINAS", "PAGINAMARCA", "MARCANAS"], de: ["LESEZEICHEN", "ZEICHENLESE", "LESEZEIC"] },
        answer: { en: "BOOKMARK", es: "MARCAPAGINAS", de: "LESEZEICHEN" },
        hint: { en: "It helps you keep your place.", es: "Ayuda a guardar tu lugar.", de: "Es merkt die Buchseite." },
      },
      {
        suffix: "fireplace",
        clue: { en: "FIRE + PLACE makes which word?", es: "CHIMENEA es una palabra de que lugar calido?", de: "KAMIN + ECKE ergibt welches warmes Wort?" },
        choices: { en: ["FIREPLACE", "PLACEFIRE", "FIREFACE"], es: ["CHIMENEA", "MECANHI", "ENCHIMA"], de: ["KAMINECKE", "ECKEKAMIN", "KAMINNECK"] },
        answer: { en: "FIREPLACE", es: "CHIMENEA", de: "KAMINECKE" },
        hint: { en: "It makes a room warm.", es: "Hace calida una sala.", de: "Es macht den Raum warm." },
      },
    ],
  },
  {
    id: "word-tiles-vowel",
    tag: "vowel-choice",
    body: { en: "Choose the right vowel.", es: "Elige la vocal correcta.", de: "Waehle den richtigen Vokal." },
    successMessage: {
      en: "Good ear. Vowels give words their shape.",
      es: "Buen oido. Las vocales dan forma a las palabras.",
      de: "Gutes Ohr. Vokale geben Woertern ihre Form.",
    },
    prompt: (variant, language) => localizedField(variant, "clue", language),
    variants: [
      {
        suffix: "plant",
        clue: { en: "Which vowel completes PL_NT?", es: "Que vocal completa PL_NTA?", de: "Welcher Vokal vervollstaendigt PFL_NZE?" },
        choices: { en: ["A", "E", "O"], es: ["A", "E", "O"], de: ["A", "E", "O"] },
        answer: { en: "A", es: "A", de: "A" },
        hint: { en: "Think garden.", es: "Piensa en jardin.", de: "Denk an Garten." },
      },
      {
        suffix: "river",
        clue: { en: "Which vowel completes R_VER?", es: "Que vocal completa R_O?", de: "Welcher Vokal vervollstaendigt FL_SS?" },
        choices: { en: ["I", "A", "O"], es: ["I", "A", "E"], de: ["U", "A", "I"] },
        answer: { en: "I", es: "I", de: "U" },
        hint: { en: "Water flows there.", es: "El agua fluye ahi.", de: "Dort fliesst Wasser." },
      },
      {
        suffix: "music",
        clue: { en: "Which vowel completes M_SIC?", es: "Que vocal completa M_SICA?", de: "Welcher Vokal vervollstaendigt M_SIK?" },
        choices: { en: ["U", "A", "E"], es: ["U", "A", "E"], de: ["U", "A", "E"] },
        answer: { en: "U", es: "U", de: "U" },
        hint: { en: "Think songs.", es: "Piensa en canciones.", de: "Denk an Lieder." },
      },
      {
        suffix: "table",
        clue: { en: "Which vowel completes T_BLE?", es: "Que vocal completa M_SA?", de: "Welcher Vokal vervollstaendigt T_SCH?" },
        choices: { en: ["A", "I", "O"], es: ["E", "A", "I"], de: ["I", "A", "O"] },
        answer: { en: "A", es: "E", de: "I" },
        hint: { en: "Games sit on it.", es: "Los juegos estan encima.", de: "Spiele liegen darauf." },
      },
    ],
  },
  {
    id: "word-tiles-plural",
    tag: "plural",
    body: { en: "Make more than one.", es: "Haz mas de uno.", de: "Mach die Mehrzahl." },
    successMessage: {
      en: "Good plural. One tile can invite the whole table.",
      es: "Buen plural. Una letra puede invitar a toda la mesa.",
      de: "Gute Mehrzahl. Ein Stein kann den ganzen Tisch einladen.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Welche Wahl macht die Mehrzahl von ${localizedField(variant, "baseWord", language)}?`
        : language === "en"
          ? `Which choice makes more than one ${localizedField(variant, "baseWord", language)}?`
          : `Que opcion hace plural ${localizedField(variant, "baseWord", language)}?`,
    variants: [
      {
        suffix: "cards",
        baseWord: { en: "CARD", es: "CARTA", de: "KARTE" },
        choices: { en: ["CARDS", "CARDER", "SCARD"], es: ["CARTAS", "CARTAR", "CASTRA"], de: ["KARTEN", "KARTER", "TANKER"] },
        answer: { en: "CARDS", es: "CARTAS", de: "KARTEN" },
        hint: { en: "Add S.", es: "Anade S.", de: "Fuege N hinzu." },
      },
      {
        suffix: "tiles",
        baseWord: { en: "TILE", es: "FICHA", de: "STEIN" },
        choices: { en: ["TILES", "STILE", "ISLET"], es: ["FICHAS", "FICHAR", "CHIFAS"], de: ["STEINE", "EINSTE", "NIESTE"] },
        answer: { en: "TILES", es: "FICHAS", de: "STEINE" },
        hint: { en: "A game uses many.", es: "Un juego usa muchas.", de: "Ein Spiel nutzt viele." },
      },
      {
        suffix: "words",
        baseWord: { en: "WORD", es: "PALABRA", de: "WORT" },
        choices: { en: ["WORDS", "SWORD", "DROWS"], es: ["PALABRAS", "PALABRAR", "BRASAPAL"], de: ["WORTE", "WORTS", "TOWER"] },
        answer: { en: "WORDS", es: "PALABRAS", de: "WORTE" },
        hint: { en: "One more letter makes many.", es: "Una letra mas hace muchas.", de: "Ein Ende macht mehrere." },
      },
      {
        suffix: "games",
        baseWord: { en: "GAME", es: "JUEGO", de: "SPIEL" },
        choices: { en: ["GAMES", "MAGES", "MEGAS"], es: ["JUEGOS", "JUEGOR", "GOJUES"], de: ["SPIELE", "SPIELT", "PEILSE"] },
        answer: { en: "GAMES", es: "JUEGOS", de: "SPIELE" },
        hint: { en: "The room has several.", es: "La sala tiene varios.", de: "Der Raum hat mehrere." },
      },
    ],
  },
  {
    id: "word-tiles-gentle-clue",
    tag: "gentle-clue",
    body: { en: "Answer the gentle clue.", es: "Responde la pista amable.", de: "Loese den sanften Hinweis." },
    successMessage: {
      en: "Clear answer. Gentle clues keep the game relaxed.",
      es: "Respuesta clara. Las pistas amables mantienen el juego tranquilo.",
      de: "Klare Antwort. Sanfte Hinweise halten das Spiel entspannt.",
    },
    prompt: (variant, language) => localizedField(variant, "clue", language),
    variants: [
      {
        suffix: "calm",
        clue: { en: "Which word means quiet and peaceful?", es: "Que palabra significa tranquilo?", de: "Welches Wort bedeutet ruhig?" },
        choices: { en: ["CALM", "CLAM", "LAMP"], es: ["CALMA", "CAMA", "LAMA"], de: ["RUHIG", "HIRUG", "GRUHI"] },
        answer: { en: "CALM", es: "CALMA", de: "RUHIG" },
        hint: { en: "It is how the table should feel.", es: "Asi debe sentirse la mesa.", de: "So soll sich der Tisch anfuehlen." },
      },
      {
        suffix: "brave",
        clue: { en: "Which word means courageous?", es: "Que palabra significa con valor?", de: "Welches Wort bedeutet mutig?" },
        choices: { en: ["BRAVE", "BEARV", "RAVEN"], es: ["VALIENTE", "VITALEN", "VENTILA"], de: ["MUTIG", "GUMIT", "TIMUG"] },
        answer: { en: "BRAVE", es: "VALIENTE", de: "MUTIG" },
        hint: { en: "It helps to try a new game.", es: "Ayuda a probar un juego nuevo.", de: "Es hilft bei einem neuen Spiel." },
      },
      {
        suffix: "clear",
        clue: { en: "Which word means easy to understand?", es: "Que palabra significa facil de entender?", de: "Welches Wort bedeutet gut zu verstehen?" },
        choices: { en: ["CLEAR", "LACER", "CRALE"], es: ["CLARO", "CALOR", "CARLO"], de: ["KLAR", "KRAL", "LARK"] },
        answer: { en: "CLEAR", es: "CLARO", de: "KLAR" },
        hint: { en: "A good clue should be this.", es: "Una buena pista debe ser asi.", de: "Ein guter Hinweis sollte so sein." },
      },
      {
        suffix: "warm",
        clue: { en: "Which word means friendly and not cold?", es: "Que palabra significa calido y amable?", de: "Welches Wort bedeutet freundlich und nicht kalt?" },
        choices: { en: ["WARM", "MRAW", "WARD"], es: ["CALIDO", "DOLICA", "COLIDA"], de: ["WARM", "RAMW", "ARMW"] },
        answer: { en: "WARM", es: "CALIDO", de: "WARM" },
        hint: { en: "It can describe a welcome.", es: "Puede describir una bienvenida.", de: "Es kann einen Empfang beschreiben." },
      },
    ],
  },
  {
    id: "word-tiles-rhyme",
    tag: "rhyme",
    body: { en: "Listen for the matching sound.", es: "Escucha el sonido parecido.", de: "Hoere auf den passenden Klang." },
    successMessage: {
      en: "Good ear. Sound clues make word play lighter.",
      es: "Buen oido. Las rimas hacen el juego mas ligero.",
      de: "Gutes Ohr. Klanghinweise machen Wortspiele leichter.",
    },
    prompt: (variant, language) => localizedField(variant, "clue", language),
    variants: [
      {
        suffix: "light-night",
        clue: { en: "Which word rhymes with LIGHT?", es: "Que palabra rima con CASA?", de: "Welches Wort reimt sich auf HAUS?" },
        choices: { en: ["NIGHT", "LAKE", "TREE"], es: ["TASA", "MESA", "LUNA"], de: ["MAUS", "TISCH", "BAUM"] },
        answer: { en: "NIGHT", es: "TASA", de: "MAUS" },
        hint: { en: "The ending sound is the same.", es: "El sonido final es parecido.", de: "Der Endklang ist gleich." },
      },
      {
        suffix: "day-play",
        clue: { en: "Which word rhymes with DAY?", es: "Que palabra rima con PAN?", de: "Welches Wort reimt sich auf MEIN?" },
        choices: { en: ["PLAY", "PLANT", "BREAD"], es: ["SAN", "SOL", "LUZ"], de: ["DEIN", "DORF", "TURM"] },
        answer: { en: "PLAY", es: "SAN", de: "DEIN" },
        hint: { en: "It also fits the game room.", es: "Tiene el mismo sonido final.", de: "Es hat denselben Klang." },
      },
      {
        suffix: "chair-share",
        clue: { en: "Which word rhymes with CHAIR?", es: "Que palabra rima con FLOR?", de: "Welches Wort reimt sich auf TIER?" },
        choices: { en: ["SHARE", "SHORE", "STONE"], es: ["AMOR", "MESA", "SILLA"], de: ["VIER", "HAUS", "LICHT"] },
        answer: { en: "SHARE", es: "AMOR", de: "VIER" },
        hint: { en: "It is also a friendly action.", es: "Termina con el mismo sonido.", de: "Der Endklang passt." },
      },
      {
        suffix: "smile-mile",
        clue: { en: "Which word rhymes with SMILE?", es: "Que palabra rima con RIO?", de: "Welches Wort reimt sich auf SEE?" },
        choices: { en: ["MILE", "MEAL", "MOON"], es: ["MIO", "MESA", "MANO"], de: ["TEE", "TISCH", "TAL"] },
        answer: { en: "MILE", es: "MIO", de: "TEE" },
        hint: { en: "Listen to the final sound.", es: "Escucha el final.", de: "Hoere auf den Schluss." },
      },
    ],
  },
];

type CompactExtraWordPuzzle = readonly [
  themeId: string,
  suffix: string,
  prompt: string,
  choices: readonly [string, string, string],
  answer: string,
  hint: string,
];

const wordThemeTags: Record<string, string> = {
  "word-tiles-anagram": "anagram",
  "word-tiles-best-word": "best-word",
  "word-tiles-add-letter": "add-letter",
  "word-tiles-front-hook": "front-hook",
  "word-tiles-back-hook": "back-hook",
  "word-tiles-blank": "blank",
  "word-tiles-prefix": "prefix",
  "word-tiles-suffix": "suffix",
  "word-tiles-two-letter": "two-letter",
  "word-tiles-score": "score-style",
  "word-tiles-food": "food",
  "word-tiles-home": "home",
  "word-tiles-greeting": "greeting",
  "word-tiles-board": "board-game",
  "word-tiles-word-ladder": "word-ladder",
  "word-tiles-compound": "compound",
  "word-tiles-vowel": "vowel-choice",
  "word-tiles-plural": "plural",
  "word-tiles-gentle-clue": "gentle-clue",
  "word-tiles-rhyme": "rhyme",
};

const extraWordCopy: Record<ExtraGameLanguage, { title: string; body: string; successMessage: string }> = {
  fr: {
    title: "Lettres",
    body: "Resous un petit defi de mots.",
    successMessage: "Bien joue. Les mots courts donnent une raison simple de discuter.",
  },
  it: {
    title: "Tessere",
    body: "Risolvi una breve sfida di parole.",
    successMessage: "Ben fatto. Le parole brevi aprono una conversazione facile.",
  },
  pt: {
    title: "Letras",
    body: "Resolva um pequeno desafio de palavras.",
    successMessage: "Muito bem. Palavras curtas criam uma conversa facil.",
  },
};

const extraWordPuzzleData: Record<ExtraGameLanguage, CompactExtraWordPuzzle[]> = {
  fr: [
    ["word-tiles-anagram", "smile", "Avec les lettres S, O, U, R, I, R, E, quel mot peux-tu former?", ["SOURIRE", "ROSIER", "SOURIE"], "SOURIRE", "C'est un geste amical."],
    ["word-tiles-anagram", "peace", "Avec les lettres P, A, I, X, quel mot calme peux-tu former?", ["PAIX", "PAI", "IXA"], "PAIX", "Cela veut dire calme entre les personnes."],
    ["word-tiles-anagram", "garden", "Avec les lettres J, A, R, D, I, N, quel mot nomme un lieu avec des fleurs?", ["JARDIN", "DINJAR", "RINDJA"], "JARDIN", "On y trouve des fleurs et des allees."],
    ["word-tiles-anagram", "music", "Avec les lettres M, U, S, I, Q, U, E, quel mot nomme les chansons?", ["MUSIQUE", "MIQUESU", "SUQIME"], "MUSIQUE", "Pense aux melodies."],
    ["word-tiles-best-word", "table", "Quel mot est le plus clair pour poser un jeu?", ["TABLE", "BLETA", "TALEB"], "TABLE", "Les jeux reposent souvent dessus."],
    ["word-tiles-best-word", "friend", "Quel mot nomme une personne avec qui jouer avec plaisir?", ["AMI", "MAI", "AIM"], "AMI", "Un bon partenaire de table."],
    ["word-tiles-best-word", "health", "Quel mot parle du fait de se sentir bien?", ["SANTE", "ANTES", "TANES"], "SANTE", "C'est le bien-etre du corps."],
    ["word-tiles-best-word", "memory", "Quel mot va avec les souvenirs?", ["MEMOIRE", "MOIEMER", "REMEMOI"], "MEMOIRE", "Elle garde les moments importants."],
    ["word-tiles-add-letter", "heart", "Ajoute R a COEU. Quel mot chaleureux obtiens-tu?", ["COEUR", "COUR", "ROUE"], "COEUR", "Il evoque l'affection."],
    ["word-tiles-add-letter", "plant", "Ajoute E a PLANT. Quel mot de jardin obtiens-tu?", ["PLANTE", "PLANET", "PANELT"], "PLANTE", "Elle pousse dans un pot."],
    ["word-tiles-add-letter", "shore", "Ajoute E a RIV. Quel mot des bords de l'eau obtiens-tu?", ["RIVE", "VIRE", "IVRE"], "RIVE", "C'est le bord d'une riviere."],
    ["word-tiles-add-letter", "chair", "Ajoute E a CHAIS. Quel mot pour s'asseoir obtiens-tu?", ["CHAISE", "CHASIE", "SACHIE"], "CHAISE", "On s'y installe pour jouer."],
    ["word-tiles-front-hook", "stone", "Ajoute S devant AGE. Quel nouveau mot fais-tu?", ["SAGE", "AGES", "GASE"], "SAGE", "Il signifie calme et prudent."],
    ["word-tiles-front-hook", "train", "Ajoute T devant RAIN. Quel mot de voyage obtiens-tu?", ["TRAIN", "RINTA", "TRIAN"], "TRAIN", "Il circule sur des rails."],
    ["word-tiles-front-hook", "light", "Ajoute S devant OMBRE. Quel mot nouveau obtiens-tu?", ["SOMBRE", "BROMES", "OMBRES"], "SOMBRE", "C'est le contraire de lumineux."],
    ["word-tiles-front-hook", "bread", "Ajoute P devant AIN. Quel mot de boulangerie obtiens-tu?", ["PAIN", "PIAN", "PINA"], "PAIN", "On le partage a table."],
    ["word-tiles-back-hook", "player", "Ajoute X a JEU. Quel mot veut dire plusieurs jeux?", ["JEUX", "JEUXE", "JUEX"], "JEUX", "Le X termine le pluriel."],
    ["word-tiles-back-hook", "cards", "Ajoute S a CARTE. Quel pluriel est correct?", ["CARTES", "CASTER", "TRACES"], "CARTES", "Il y en a beaucoup dans un paquet."],
    ["word-tiles-back-hook", "turns", "Ajoute S a TOUR. Quel mot nomme plusieurs tours?", ["TOURS", "ROUST", "TROUS"], "TOURS", "Chacun attend son tour."],
    ["word-tiles-back-hook", "scores", "Ajoute S a POINT. Quel pluriel est correct?", ["POINTS", "PONITS", "SPINOT"], "POINTS", "On les compte dans un jeu."],
    ["word-tiles-blank", "brave", "Quelle lettre complete BRAV_?", ["E", "A", "I"], "E", "Le mot devient BRAVE."],
    ["word-tiles-blank", "share", "Quelle lettre complete PARTAG_R?", ["E", "A", "I"], "E", "Partager est un geste amical."],
    ["word-tiles-blank", "clear", "Quelle lettre complete CLA_R?", ["I", "A", "E"], "I", "Le mot devient CLAIR."],
    ["word-tiles-blank", "round", "Quelle lettre complete TO_R pour un moment de jeu?", ["U", "A", "I"], "U", "Un tour est un moment pour jouer."],
    ["word-tiles-prefix", "replay", "Quel mot signifie faire encore une fois?", ["REFAIRE", "FAIRER", "FERAIRE"], "REFAIRE", "RE indique souvent a nouveau."],
    ["word-tiles-prefix", "undo", "Quel mot indique que l'ordre est casse?", ["DESORDRE", "ORDRE", "REDOS"], "DESORDRE", "DES change le sens."],
    ["word-tiles-prefix", "preview", "Quel mot annonce quelque chose vu avant?", ["PREVUE", "VUEPRE", "REVUE"], "PREVUE", "PRE indique avant."],
    ["word-tiles-prefix", "return", "Quel mot veut dire venir en arriere?", ["RETOUR", "TOURER", "ROUTER"], "RETOUR", "On revient vers le point de depart."],
    ["word-tiles-suffix", "kindness", "Quel mot nomme la qualite d'etre bon?", ["BONTE", "BETON", "TONBE"], "BONTE", "C'est une qualite douce."],
    ["word-tiles-suffix", "helpful", "Quel mot signifie donner de l'aide?", ["AIDER", "RAIDE", "DIARE"], "AIDER", "On le fait pour un ami."],
    ["word-tiles-suffix", "joyful", "Quel mot signifie plein de joie?", ["JOYEUX", "JOUEYX", "YEUXJO"], "JOYEUX", "Il sourit deja."],
    ["word-tiles-suffix", "rested", "Quel mot signifie que l'on a pris du repos?", ["REPOSE", "EPOSER", "ROSEPE"], "REPOSE", "On se sent mieux apres."],
    ["word-tiles-two-letter", "to", "Quel petit mot relie deux choix: cafe _ the?", ["OU", "UN", "TU"], "OU", "Il propose une option."],
    ["word-tiles-two-letter", "in", "Quel petit mot veut dire a l'interieur?", ["EN", "NE", "LE"], "EN", "Il place quelque chose dedans."],
    ["word-tiles-two-letter", "we", "Quel mot court veut dire toi et moi ensemble?", ["NOUS", "SONU", "UNOS"], "NOUS", "C'est le mot du groupe."],
    ["word-tiles-two-letter", "am", "Quel mot court parle de soi?", ["JE", "ET", "LE"], "JE", "C'est la personne qui parle."],
    ["word-tiles-score", "jazz", "Quel mot court vaut souvent beaucoup dans les jeux de lettres?", ["JAZZ", "ZAZJ", "JAS"], "JAZZ", "Les lettres rares attirent l'oeil."],
    ["word-tiles-score", "quiz", "Quel mot de questions utilise Q et Z?", ["QUIZ", "ZQUI", "QUAI"], "QUIZ", "C'est une serie de questions."],
    ["word-tiles-score", "box", "Quel mot court peut rapporter avec X?", ["BOXE", "BOEX", "EXBO"], "BOXE", "Le X est une lettre forte."],
    ["word-tiles-score", "joy", "Quel mot simple nomme le bonheur?", ["JOIE", "OIEJ", "JOLI"], "JOIE", "Il va avec un sourire."],
    ["word-tiles-food", "apple", "Quel mot nomme un fruit rond?", ["POMME", "MOPME", "POMPE"], "POMME", "On peut la couper en quartiers."],
    ["word-tiles-food", "bread", "Quel mot vient de la boulangerie?", ["PAIN", "PIAN", "PINA"], "PAIN", "Il accompagne souvent le repas."],
    ["word-tiles-food", "lemon", "Quel mot nomme un fruit jaune?", ["CITRON", "TRICON", "CROINT"], "CITRON", "Il est acidule."],
    ["word-tiles-food", "soup", "Quel mot nomme un plat chaud dans un bol?", ["SOUPE", "POUSE", "EPOSU"], "SOUPE", "Elle rechauffe doucement."],
    ["word-tiles-home", "chair", "Quel mot nomme un siege?", ["CHAISE", "SAICHE", "CASIHE"], "CHAISE", "On s'assoit dessus."],
    ["word-tiles-home", "lamp", "Quel mot donne de la lumiere?", ["LAMPE", "PALME", "AMPLE"], "LAMPE", "Elle eclaire la table."],
    ["word-tiles-home", "clock", "Quel mot aide a lire l'heure?", ["HORLOGE", "LOGERHO", "GLOHORE"], "HORLOGE", "Elle marque le temps."],
    ["word-tiles-home", "window", "Quel mot laisse entrer la lumiere?", ["FENETRE", "REFENTE", "FRENETE"], "FENETRE", "On regarde dehors par la."],
    ["word-tiles-greeting", "hello", "Quel mot commence une conversation amicale?", ["BONJOUR", "JOURBON", "BROUJON"], "BONJOUR", "C'est souvent le premier mot."],
    ["word-tiles-greeting", "thanks", "Quel mot montre la gratitude?", ["MERCI", "CRIME", "MIRCE"], "MERCI", "On le dit apres une aide."],
    ["word-tiles-greeting", "welcome", "Quel mot fait sentir quelqu'un invite?", ["BIENVENUE", "VENUEBIEN", "NEUVEIB"], "BIENVENUE", "Il va bien a la porte."],
    ["word-tiles-greeting", "friend", "Quel mot nomme une bonne personne a la table?", ["AMI", "MAI", "AIM"], "AMI", "On aime jouer avec lui."],
    ["word-tiles-board", "tile", "Quel mot nomme une petite piece de jeu?", ["JETON", "JONTE", "TENJO"], "JETON", "On le pose ou on le deplace."],
    ["word-tiles-board", "board", "Quel mot nomme la surface de jeu?", ["PLATEAU", "TOPEAUL", "PALETUO"], "PLATEAU", "Les pieces reposent dessus."],
    ["word-tiles-board", "score", "Quel mot compte les points?", ["SCORE", "CORES", "ROCES"], "SCORE", "Il dit ou en est la partie."],
    ["word-tiles-board", "turn", "Quel mot veut dire le moment de jouer?", ["TOUR", "ROUT", "TROU"], "TOUR", "Chacun en a un."],
    ["word-tiles-word-ladder", "cat-car", "Change une lettre dans CHAT. Quel mot nouveau apparait?", ["CHAR", "CHAT", "CHUT"], "CHAR", "Seule la derniere lettre change."],
    ["word-tiles-word-ladder", "sand-send", "Change une lettre dans SABLE. Quel mot nouveau est correct?", ["TABLE", "SABLES", "SALBE"], "TABLE", "Un seul debut change."],
    ["word-tiles-word-ladder", "lamp-limp", "Change une lettre dans LAMPE. Quel mot nouveau est correct?", ["RAMPE", "LAMPS", "PALME"], "RAMPE", "Le premier son change."],
    ["word-tiles-word-ladder", "boat-coat", "Change une lettre dans BATEAU. Quel mot nouveau est correct?", ["RATEAU", "BATEAUX", "TABEAU"], "RATEAU", "Une lettre donne un outil de jardin."],
    ["word-tiles-compound", "sunday", "Quel mot nomme le jour calme de la semaine?", ["DIMANCHE", "CHEDIMAN", "MANDICHE"], "DIMANCHE", "C'est un jour de repos pour beaucoup."],
    ["word-tiles-compound", "teacup", "THE + TASSE evoque quel mot?", ["TASSE", "TASSETHE", "SETTA"], "TASSE", "Elle tient une boisson chaude."],
    ["word-tiles-compound", "bookmark", "Quel mot garde ta place dans un livre?", ["MARQUEPAGE", "PAGEMARQUE", "PARQUEMAGE"], "MARQUEPAGE", "Il reste entre deux pages."],
    ["word-tiles-compound", "fireplace", "Quel mot nomme le feu doux dans la maison?", ["CHEMINEE", "MECHINEE", "CHENEIM"], "CHEMINEE", "Elle rend la piece chaude."],
    ["word-tiles-vowel", "plant", "Quelle voyelle complete PL_NTE?", ["A", "E", "O"], "A", "Le mot devient PLANTE."],
    ["word-tiles-vowel", "river", "Quelle voyelle complete RIV_?", ["E", "A", "I"], "E", "Le mot devient RIVE."],
    ["word-tiles-vowel", "music", "Quelle voyelle complete MUS_QUE?", ["I", "A", "O"], "I", "Le mot devient MUSIQUE."],
    ["word-tiles-vowel", "table", "Quelle voyelle complete T_BLE?", ["A", "E", "O"], "A", "Le mot devient TABLE."],
    ["word-tiles-plural", "cards", "Quel mot est le pluriel de CARTE?", ["CARTES", "CARTER", "TRACES"], "CARTES", "Le S montre qu'il y en a plusieurs."],
    ["word-tiles-plural", "tiles", "Quel mot est le pluriel de JETON?", ["JETONS", "JONETS", "TENJOS"], "JETONS", "Un jeu en utilise souvent plusieurs."],
    ["word-tiles-plural", "words", "Quel mot est le pluriel de MOT?", ["MOTS", "TOMS", "MOST"], "MOTS", "Ce sont plusieurs mots."],
    ["word-tiles-plural", "games", "Quel mot est le pluriel de JEU?", ["JEUX", "JUEX", "JEUS"], "JEUX", "C'est le pluriel correct."],
    ["word-tiles-gentle-clue", "calm", "Quel mot veut dire tranquille?", ["CALME", "CLAME", "MACLE"], "CALME", "C'est l'ambiance souhaitee."],
    ["word-tiles-gentle-clue", "brave", "Quel mot veut dire courageux?", ["BRAVE", "VERBA", "BAVER"], "BRAVE", "Il aide a essayer un nouveau jeu."],
    ["word-tiles-gentle-clue", "clear", "Quel mot veut dire facile a comprendre?", ["CLAIR", "CRIAL", "RACLI"], "CLAIR", "Une bonne piste doit l'etre."],
    ["word-tiles-gentle-clue", "warm", "Quel mot veut dire amical et pas froid?", ["CHAUD", "DAUCH", "DUCHA"], "CHAUD", "Il peut decrire un accueil."],
    ["word-tiles-rhyme", "light-night", "Quel mot rime avec NUIT?", ["BRUIT", "PAIN", "JEU"], "BRUIT", "La fin sonne pareil."],
    ["word-tiles-rhyme", "day-play", "Quel mot rime avec JOUR?", ["TOUR", "TABLE", "AMI"], "TOUR", "Le son final est le meme."],
    ["word-tiles-rhyme", "chair-share", "Quel mot rime avec COEUR?", ["FLEUR", "CHAISE", "LAMPE"], "FLEUR", "Ecoute la fin du mot."],
    ["word-tiles-rhyme", "smile-mile", "Quel mot rime avec MERCI?", ["ICI", "PAIN", "TOUR"], "ICI", "Le dernier son se repete."],
  ],
  it: [
    ["word-tiles-anagram", "smile", "Con le lettere S, O, R, R, I, S, O, quale parola puoi formare?", ["SORRISO", "RISOSOR", "ROSSI"], "SORRISO", "E un gesto amichevole."],
    ["word-tiles-anagram", "peace", "Con le lettere P, A, C, E, quale parola calma puoi formare?", ["PACE", "PECA", "CAPE"], "PACE", "Significa calma tra persone."],
    ["word-tiles-anagram", "garden", "Con le lettere G, I, A, R, D, I, N, O, quale luogo con fiori puoi formare?", ["GIARDINO", "DINOGIAR", "RIGADINO"], "GIARDINO", "Pensa a fiori e sentieri."],
    ["word-tiles-anagram", "music", "Con le lettere M, U, S, I, C, A, quale parola per le canzoni puoi formare?", ["MUSICA", "CASIUM", "SUMICA"], "MUSICA", "Pensa alle melodie."],
    ["word-tiles-best-word", "table", "Quale parola e piu chiara per appoggiare un gioco?", ["TAVOLO", "VOLATO", "LOVATO"], "TAVOLO", "I giochi stanno spesso sopra."],
    ["word-tiles-best-word", "friend", "Quale parola indica una persona con cui giocare volentieri?", ["AMICO", "COMAI", "CIAOM"], "AMICO", "Un buon compagno di tavolo."],
    ["word-tiles-best-word", "health", "Quale parola parla dello stare bene?", ["SALUTE", "TESULA", "SULATE"], "SALUTE", "Riguarda il benessere."],
    ["word-tiles-best-word", "memory", "Quale parola va con i ricordi?", ["MEMORIA", "AMOREMI", "MIREOMA"], "MEMORIA", "Conserva momenti importanti."],
    ["word-tiles-add-letter", "heart", "Aggiungi E a CUOR. Quale parola ottieni?", ["CUORE", "CUREO", "ROUCE"], "CUORE", "Evoca affetto."],
    ["word-tiles-add-letter", "plant", "Aggiungi A a PIANT. Quale parola di giardino ottieni?", ["PIANTA", "PATINA", "PINTAA"], "PIANTA", "Cresce in un vaso."],
    ["word-tiles-add-letter", "shore", "Aggiungi A a RIV. Quale parola d'acqua ottieni?", ["RIVA", "VARI", "VIRA"], "RIVA", "E il bordo dell'acqua."],
    ["word-tiles-add-letter", "chair", "Aggiungi A a SEDI. Quale parola per sedersi ottieni?", ["SEDIA", "IDEAS", "SAIDE"], "SEDIA", "Ci si siede per giocare."],
    ["word-tiles-front-hook", "stone", "Aggiungi S davanti a ERA. Quale parola nuova ottieni?", ["SERA", "ERAS", "ARES"], "SERA", "E una parte tranquilla del giorno."],
    ["word-tiles-front-hook", "train", "Aggiungi S davanti a OLE. Quale parola luminosa ottieni?", ["SOLE", "OLES", "LOSE"], "SOLE", "Porta luce."],
    ["word-tiles-front-hook", "light", "Aggiungi S davanti a TATO. Quale parola nuova ottieni?", ["STATO", "TASTO", "TOSTA"], "STATO", "E una parola comune."],
    ["word-tiles-front-hook", "bread", "Aggiungi S davanti a PINA. Quale parola nuova ottieni?", ["SPINA", "PANIS", "PIANS"], "SPINA", "Si trova su una rosa."],
    ["word-tiles-back-hook", "player", "Quale plurale di GIOCO e corretto?", ["GIOCHI", "GIOCOI", "GICHIO"], "GIOCHI", "La stanza ne offre diversi."],
    ["word-tiles-back-hook", "cards", "Quale plurale di CARTA e corretto?", ["CARTE", "CARET", "CRETA"], "CARTE", "Un mazzo ne ha molte."],
    ["word-tiles-back-hook", "turns", "Quale plurale di TURNO e corretto?", ["TURNI", "TURNOI", "RUNIT"], "TURNI", "Ognuno aspetta il suo."],
    ["word-tiles-back-hook", "scores", "Quale plurale di PUNTO e corretto?", ["PUNTI", "PUNTOI", "TUPIN"], "PUNTI", "Si contano nel gioco."],
    ["word-tiles-blank", "brave", "Quale lettera completa VAL_RE?", ["O", "A", "I"], "O", "La parola diventa VALORE."],
    ["word-tiles-blank", "share", "Quale lettera completa CONDIV_DERE?", ["I", "A", "O"], "I", "Condividere e un gesto amico."],
    ["word-tiles-blank", "clear", "Quale lettera completa CHI_RO?", ["A", "E", "I"], "A", "La parola diventa CHIARO."],
    ["word-tiles-blank", "round", "Quale lettera completa G_RO?", ["I", "A", "U"], "I", "Un giro e una piccola ronda."],
    ["word-tiles-prefix", "replay", "Quale parola significa fare di nuovo?", ["RIFARE", "FAREI", "FERIRA"], "RIFARE", "RI indica spesso di nuovo."],
    ["word-tiles-prefix", "undo", "Quale parola indica che l'ordine manca?", ["DISORDINE", "ORDINE", "RIDOS"], "DISORDINE", "DIS cambia il senso."],
    ["word-tiles-prefix", "preview", "Quale parola indica vedere prima?", ["ANTEPRIMA", "PRIMAANTE", "PIRMAANTE"], "ANTEPRIMA", "ANTE indica prima."],
    ["word-tiles-prefix", "return", "Quale parola significa tornare?", ["RITORNO", "TORNORI", "TRONIRO"], "RITORNO", "Si va indietro al punto di partenza."],
    ["word-tiles-suffix", "kindness", "Quale parola nomina la qualita di essere buoni?", ["BONTA", "BANTO", "TONBA"], "BONTA", "E una qualita gentile."],
    ["word-tiles-suffix", "helpful", "Quale parola significa dare aiuto?", ["AIUTARE", "TIRAEAU", "AURETAI"], "AIUTARE", "Si fa per un amico."],
    ["word-tiles-suffix", "joyful", "Quale parola significa pieno di gioia?", ["GIOIOSO", "SOIOGIO", "GIOSOIO"], "GIOIOSO", "Suona allegro."],
    ["word-tiles-suffix", "rested", "Quale parola significa che ha riposato?", ["RIPOSATO", "POSATORI", "RIPOSTOA"], "RIPOSATO", "Dopo una pausa ci si sente cosi."],
    ["word-tiles-two-letter", "to", "Quale parola piccola collega due idee?", ["DI", "ID", "DA"], "DI", "E molto comune nelle frasi."],
    ["word-tiles-two-letter", "in", "Quale parola breve vuol dire dentro?", ["IN", "NI", "SI"], "IN", "Mette qualcosa all'interno."],
    ["word-tiles-two-letter", "we", "Quale parola breve vuol dire tu e io insieme?", ["NOI", "ION", "NIO"], "NOI", "E la parola del gruppo."],
    ["word-tiles-two-letter", "am", "Quale parola breve parla di me?", ["IO", "OI", "IL"], "IO", "E chi sta parlando."],
    ["word-tiles-score", "jazz", "Quale parola usa lettere forti nei giochi di parole?", ["JAZZ", "ZAZJ", "JAS"], "JAZZ", "Le lettere rare attirano attenzione."],
    ["word-tiles-score", "quiz", "Quale parola indica domande veloci?", ["QUIZ", "ZQUI", "QUAI"], "QUIZ", "E una serie di domande."],
    ["word-tiles-score", "box", "Quale parola breve usa X?", ["BOXE", "BOEX", "EXBO"], "BOXE", "La X e una lettera forte."],
    ["word-tiles-score", "joy", "Quale parola nomina felicita?", ["GIOIA", "AGIOI", "IOIAG"], "GIOIA", "Va con un sorriso."],
    ["word-tiles-food", "apple", "Quale parola nomina un frutto rotondo?", ["MELA", "LAME", "MALE"], "MELA", "Si puo tagliare a fette."],
    ["word-tiles-food", "bread", "Quale parola viene dal forno?", ["PANE", "PENA", "NEPA"], "PANE", "Si condivide a tavola."],
    ["word-tiles-food", "lemon", "Quale parola nomina un frutto giallo?", ["LIMONE", "MELONI", "NOLIME"], "LIMONE", "Ha sapore fresco e aspro."],
    ["word-tiles-food", "soup", "Quale parola nomina un piatto caldo in una ciotola?", ["ZUPPA", "PUZZA", "PAPUZ"], "ZUPPA", "Riscalda piano."],
    ["word-tiles-home", "chair", "Quale parola nomina un sedile?", ["SEDIA", "IDEAS", "SAIDE"], "SEDIA", "Ci si siede sopra."],
    ["word-tiles-home", "lamp", "Quale parola porta luce?", ["LAMPADA", "PALMADA", "DAMAPAL"], "LAMPADA", "Illumina il tavolo."],
    ["word-tiles-home", "clock", "Quale parola aiuta a leggere l'ora?", ["OROLOGIO", "LOGORIO", "GIROLOO"], "OROLOGIO", "Segna il tempo."],
    ["word-tiles-home", "window", "Quale parola lascia entrare la luce?", ["FINESTRA", "FRENTASI", "SINFERAT"], "FINESTRA", "Da li si guarda fuori."],
    ["word-tiles-greeting", "hello", "Quale parola inizia una chiacchiera amichevole?", ["CIAO", "CIOA", "AICO"], "CIAO", "Spesso e la prima parola."],
    ["word-tiles-greeting", "thanks", "Quale parola mostra gratitudine?", ["GRAZIE", "GARZIE", "ZIGARE"], "GRAZIE", "Si dice dopo un aiuto."],
    ["word-tiles-greeting", "welcome", "Quale parola fa sentire invitati?", ["BENVENUTO", "VENUTOBEN", "NEBENVUTO"], "BENVENUTO", "Sta bene all'ingresso."],
    ["word-tiles-greeting", "friend", "Quale parola nomina una buona persona al tavolo?", ["AMICO", "COMAI", "CIAOM"], "AMICO", "E piacevole giocare insieme."],
    ["word-tiles-board", "tile", "Quale parola nomina una piccola tessera?", ["TESSERA", "SERETAS", "RASENTE"], "TESSERA", "Si posa o si sposta."],
    ["word-tiles-board", "board", "Quale parola nomina la superficie di gioco?", ["TAVOLA", "VOLATA", "LAVATO"], "TAVOLA", "I pezzi stanno sopra."],
    ["word-tiles-board", "score", "Quale parola conta i punti?", ["PUNTO", "PUTON", "TUNPO"], "PUNTO", "Dice come va la partita."],
    ["word-tiles-board", "turn", "Quale parola indica il momento di giocare?", ["TURNO", "TRUNO", "NUTRO"], "TURNO", "Ognuno ne ha uno."],
    ["word-tiles-word-ladder", "cat-car", "Cambia una lettera in GATTO. Quale parola nuova appare?", ["MATTO", "GATTA", "GATTI"], "MATTO", "Cambia solo l'inizio."],
    ["word-tiles-word-ladder", "sand-send", "Cambia una lettera in CASA. Quale parola nuova e corretta?", ["COSA", "CASO", "CASA"], "COSA", "Una vocale cambia il senso."],
    ["word-tiles-word-ladder", "lamp-limp", "Cambia una lettera in MANO. Quale parola nuova e corretta?", ["MENO", "MANI", "MONA"], "MENO", "Una vocale cambia."],
    ["word-tiles-word-ladder", "boat-coat", "Cambia una lettera in MARE. Quale parola nuova e corretta?", ["PARE", "MAREI", "REMA"], "PARE", "Il primo suono cambia."],
    ["word-tiles-compound", "sunday", "Quale parola nomina il giorno tranquillo della settimana?", ["DOMENICA", "CANDOMIE", "MENODICA"], "DOMENICA", "Per molti e un giorno di riposo."],
    ["word-tiles-compound", "teacup", "Quale parola tiene una bevanda calda?", ["TAZZINA", "ZINATZA", "TAZANZI"], "TAZZINA", "Sta bene con il te."],
    ["word-tiles-compound", "bookmark", "Quale parola tiene il segno in un libro?", ["SEGNALIBRO", "LIBROSEGNA", "NEGASLIBRO"], "SEGNALIBRO", "Resta tra le pagine."],
    ["word-tiles-compound", "fireplace", "Quale parola nomina il fuoco caldo in casa?", ["CAMINO", "NOMICA", "MACINO"], "CAMINO", "Rende calda la stanza."],
    ["word-tiles-vowel", "plant", "Quale vocale completa PI_NTA?", ["A", "E", "O"], "A", "La parola diventa PIANTA."],
    ["word-tiles-vowel", "river", "Quale vocale completa F_UME?", ["I", "A", "O"], "I", "La parola diventa FIUME."],
    ["word-tiles-vowel", "music", "Quale vocale completa M_SICA?", ["U", "A", "E"], "U", "La parola diventa MUSICA."],
    ["word-tiles-vowel", "table", "Quale vocale completa T_VOLO?", ["A", "E", "I"], "A", "La parola diventa TAVOLO."],
    ["word-tiles-plural", "cards", "Quale parola e il plurale di CARTA?", ["CARTE", "CARET", "CRETA"], "CARTE", "Il finale cambia al plurale."],
    ["word-tiles-plural", "tiles", "Quale parola e il plurale di TESSERA?", ["TESSERE", "SERETES", "RETESSA"], "TESSERE", "Un gioco ne usa molte."],
    ["word-tiles-plural", "words", "Quale parola e il plurale di PAROLA?", ["PAROLE", "PEARLO", "LOPARE"], "PAROLE", "Sono piu parole."],
    ["word-tiles-plural", "games", "Quale parola e il plurale di GIOCO?", ["GIOCHI", "GIOCOI", "CHIGIO"], "GIOCHI", "La stanza ne offre diversi."],
    ["word-tiles-gentle-clue", "calm", "Quale parola significa tranquillo?", ["CALMO", "COLMA", "MALCO"], "CALMO", "E l'atmosfera giusta."],
    ["word-tiles-gentle-clue", "brave", "Quale parola significa valore?", ["CORAGGIO", "GIOCAROG", "RAGGIOCO"], "CORAGGIO", "Aiuta a provare un gioco nuovo."],
    ["word-tiles-gentle-clue", "clear", "Quale parola significa facile da capire?", ["CHIARO", "CARHIO", "ROCHIA"], "CHIARO", "Una buona pista deve esserlo."],
    ["word-tiles-gentle-clue", "warm", "Quale parola significa amichevole e non freddo?", ["CALDO", "COLDA", "DALCO"], "CALDO", "Puo descrivere un benvenuto."],
    ["word-tiles-rhyme", "light-night", "Quale parola rima con SOLE?", ["VOLE", "MARE", "CASA"], "VOLE", "Il suono finale e uguale."],
    ["word-tiles-rhyme", "day-play", "Quale parola rima con AMORE?", ["CUORE", "TAVOLO", "SEDIA"], "CUORE", "Ascolta la fine."],
    ["word-tiles-rhyme", "chair-share", "Quale parola rima con MARE?", ["DARE", "GIOCO", "LUCE"], "DARE", "Il finale suona uguale."],
    ["word-tiles-rhyme", "smile-mile", "Quale parola rima con VITA?", ["DITA", "PANE", "LIBRO"], "DITA", "Il suono finale si ripete."],
  ],
  pt: [
    ["word-tiles-anagram", "smile", "Com as letras S, O, R, R, I, S, O, que palavra voce pode formar?", ["SORRISO", "RISOSOR", "ROSSI"], "SORRISO", "E um gesto amigavel."],
    ["word-tiles-anagram", "peace", "Com as letras P, A, Z, que palavra calma voce pode formar?", ["PAZ", "ZAP", "APZ"], "PAZ", "Significa calma entre pessoas."],
    ["word-tiles-anagram", "garden", "Com as letras J, A, R, D, I, M, que lugar com flores voce pode formar?", ["JARDIM", "DIMJAR", "RIMJAD"], "JARDIM", "Pense em flores e caminhos."],
    ["word-tiles-anagram", "music", "Com as letras M, U, S, I, C, A, que palavra para cancoes voce pode formar?", ["MUSICA", "CASIUM", "SUMICA"], "MUSICA", "Pense em melodias."],
    ["word-tiles-best-word", "table", "Qual palavra e mais clara para apoiar um jogo?", ["MESA", "SEMA", "AMES"], "MESA", "Os jogos costumam ficar sobre ela."],
    ["word-tiles-best-word", "friend", "Qual palavra nomeia alguem bom para jogar junto?", ["AMIGO", "MAGIO", "GOIMA"], "AMIGO", "Um bom parceiro de mesa."],
    ["word-tiles-best-word", "health", "Qual palavra fala de estar bem?", ["SAUDE", "DUEAS", "SEUDA"], "SAUDE", "Tem a ver com bem-estar."],
    ["word-tiles-best-word", "memory", "Qual palavra combina com lembrancas?", ["MEMORIA", "AMOREMI", "MIREOMA"], "MEMORIA", "Guarda momentos importantes."],
    ["word-tiles-add-letter", "heart", "Adicione O a CORACA. Que palavra carinhosa aparece?", ["CORACAO", "ARCOCAO", "CORAACO"], "CORACAO", "Lembra afeto."],
    ["word-tiles-add-letter", "plant", "Adicione A a PLANT. Que palavra de jardim aparece?", ["PLANTA", "PATLAN", "TANPLA"], "PLANTA", "Cresce em vaso ou jardim."],
    ["word-tiles-add-letter", "shore", "Adicione O a RI. Que palavra de agua aparece?", ["RIO", "ORI", "ROI"], "RIO", "A agua corre ali."],
    ["word-tiles-add-letter", "chair", "Adicione A a CADEIR. Que palavra para sentar aparece?", ["CADEIRA", "CADERIA", "CERDIAA"], "CADEIRA", "A gente senta para jogar."],
    ["word-tiles-front-hook", "stone", "Adicione G antes de ATO. Que palavra nova voce faz?", ["GATO", "TOGA", "AGTO"], "GATO", "Muda com uma letra na frente."],
    ["word-tiles-front-hook", "train", "Adicione C antes de ASA. Que palavra de casa aparece?", ["CASA", "SACA", "ASCA"], "CASA", "E um lugar familiar."],
    ["word-tiles-front-hook", "light", "Adicione C antes de LARO. Que palavra clara aparece?", ["CLARO", "CALOR", "CARLO"], "CLARO", "Significa facil de entender."],
    ["word-tiles-front-hook", "bread", "Adicione P antes de AO. Que palavra de comida aparece?", ["PAO", "OPA", "APO"], "PAO", "Vem da padaria."],
    ["word-tiles-back-hook", "player", "Qual e o plural correto de JOGO?", ["JOGOS", "JOGOR", "GOJOS"], "JOGOS", "A sala tem varios."],
    ["word-tiles-back-hook", "cards", "Qual e o plural correto de CARTA?", ["CARTAS", "CASTAR", "TRACAS"], "CARTAS", "Um baralho tem muitas."],
    ["word-tiles-back-hook", "turns", "Qual e o plural correto de TURNO?", ["TURNOS", "SOTURN", "NUTROS"], "TURNOS", "Cada pessoa espera o seu."],
    ["word-tiles-back-hook", "scores", "Qual e o plural correto de PONTO?", ["PONTOS", "POTONS", "TOPNOS"], "PONTOS", "Eles sao contados no jogo."],
    ["word-tiles-blank", "brave", "Que letra completa VAL_R?", ["O", "A", "I"], "O", "A palavra vira VALOR."],
    ["word-tiles-blank", "share", "Que letra completa COMPART_LHAR?", ["I", "A", "O"], "I", "Compartilhar e um gesto amigo."],
    ["word-tiles-blank", "clear", "Que letra completa CL_RO?", ["A", "E", "I"], "A", "A palavra vira CLARO."],
    ["word-tiles-blank", "round", "Que letra completa R_DADA?", ["O", "A", "U"], "O", "Rodada e uma pequena parte do jogo."],
    ["word-tiles-prefix", "replay", "Qual palavra significa fazer de novo?", ["REFAZER", "FAZERRE", "ZERFARE"], "REFAZER", "RE indica novamente."],
    ["word-tiles-prefix", "undo", "Qual palavra indica falta de ordem?", ["DESORDEM", "ORDEM", "REDOS"], "DESORDEM", "DES muda o sentido."],
    ["word-tiles-prefix", "preview", "Qual palavra indica algo visto antes?", ["PREVIA", "VIAREP", "PERVIA"], "PREVIA", "PRE indica antes."],
    ["word-tiles-prefix", "return", "Qual palavra significa voltar?", ["RETORNO", "TORNORE", "RETROON"], "RETORNO", "Volta ao ponto inicial."],
    ["word-tiles-suffix", "kindness", "Qual palavra nomeia a qualidade de ser bondoso?", ["BONDADE", "DABONDE", "BENDADO"], "BONDADE", "E uma qualidade gentil."],
    ["word-tiles-suffix", "helpful", "Qual palavra significa dar ajuda?", ["AJUDAR", "JARDUA", "RAJUDA"], "AJUDAR", "Fazemos isso por alguem."],
    ["word-tiles-suffix", "joyful", "Qual palavra significa feliz?", ["ALEGRE", "REGELA", "LEGARE"], "ALEGRE", "Combina com sorriso."],
    ["word-tiles-suffix", "rested", "Qual palavra significa que descansou?", ["DESCANSADO", "CANSADODES", "DESACONDA"], "DESCANSADO", "Depois de pausa a gente fica assim."],
    ["word-tiles-two-letter", "to", "Qual palavra curta liga uma ideia a outra?", ["DE", "ED", "DA"], "DE", "Aparece em muitas frases."],
    ["word-tiles-two-letter", "in", "Qual palavra curta quer dizer dentro?", ["EM", "ME", "SE"], "EM", "Coloca algo no interior."],
    ["word-tiles-two-letter", "we", "Qual palavra curta quer dizer voce e eu juntos?", ["NOS", "SON", "ONS"], "NOS", "E a palavra do grupo."],
    ["word-tiles-two-letter", "am", "Qual palavra curta fala de mim?", ["EU", "UE", "EL"], "EU", "E quem esta falando."],
    ["word-tiles-score", "jazz", "Qual palavra usa letras fortes em jogos de palavras?", ["JAZZ", "ZAZJ", "JAS"], "JAZZ", "Letras raras chamam atencao."],
    ["word-tiles-score", "quiz", "Qual palavra indica perguntas rapidas?", ["QUIZ", "ZQUI", "QUAI"], "QUIZ", "E uma sequencia de perguntas."],
    ["word-tiles-score", "box", "Qual palavra curta usa X?", ["BOX", "XOB", "BOS"], "BOX", "O X e uma letra forte."],
    ["word-tiles-score", "joy", "Qual palavra nomeia felicidade?", ["ALEGRIA", "GALERIA", "LIGEARA"], "ALEGRIA", "Combina com um sorriso."],
    ["word-tiles-food", "apple", "Qual palavra nomeia uma fruta redonda?", ["MACA", "CAMA", "AMAC"], "MACA", "Pode ser cortada em pedacos."],
    ["word-tiles-food", "bread", "Qual palavra vem da padaria?", ["PAO", "OPA", "APO"], "PAO", "Costuma acompanhar a refeicao."],
    ["word-tiles-food", "lemon", "Qual palavra nomeia uma fruta amarela?", ["LIMAO", "MOLAI", "ALIMO"], "LIMAO", "Tem gosto fresco e azedo."],
    ["word-tiles-food", "soup", "Qual palavra nomeia um prato quente numa tigela?", ["SOPA", "SAPO", "APOS"], "SOPA", "Aquece devagar."],
    ["word-tiles-home", "chair", "Qual palavra nomeia um assento?", ["CADEIRA", "CERDIAA", "DARCEIA"], "CADEIRA", "Sentamos nela."],
    ["word-tiles-home", "lamp", "Qual palavra traz luz?", ["LAMPADA", "PALMADA", "DAMAPAL"], "LAMPADA", "Ilumina a mesa."],
    ["word-tiles-home", "clock", "Qual palavra ajuda a ver a hora?", ["RELOGIO", "GIREOLO", "LOGEIRO"], "RELOGIO", "Marca o tempo."],
    ["word-tiles-home", "window", "Qual palavra deixa a luz entrar?", ["JANELA", "ANELAJ", "LANEJA"], "JANELA", "Por ela olhamos para fora."],
    ["word-tiles-greeting", "hello", "Qual palavra inicia uma conversa amigavel?", ["OLA", "ALO", "LAO"], "OLA", "Costuma ser a primeira palavra."],
    ["word-tiles-greeting", "thanks", "Qual palavra mostra gratidao?", ["OBRIGADO", "BRIGADO", "GOBRIADO"], "OBRIGADO", "Dizemos depois de uma ajuda."],
    ["word-tiles-greeting", "welcome", "Qual palavra faz alguem se sentir convidado?", ["BEMVINDO", "VINDOBEM", "BENVIMDO"], "BEMVINDO", "Combina com a porta de entrada."],
    ["word-tiles-greeting", "friend", "Qual palavra nomeia uma boa pessoa na mesa?", ["AMIGO", "MAGIO", "GOIMA"], "AMIGO", "E bom jogar junto."],
    ["word-tiles-board", "tile", "Qual palavra nomeia uma pequena peca de jogo?", ["PECA", "CAPE", "CEPA"], "PECA", "Colocamos ou movemos no tabuleiro."],
    ["word-tiles-board", "board", "Qual palavra nomeia a superficie de jogo?", ["TABULEIRO", "ROBUETA", "TABULEROI"], "TABULEIRO", "As pecas ficam sobre ele."],
    ["word-tiles-board", "score", "Qual palavra conta os pontos?", ["PONTO", "POTON", "TONPO"], "PONTO", "Mostra como vai a partida."],
    ["word-tiles-board", "turn", "Qual palavra indica seu momento de jogar?", ["TURNO", "TRUNO", "NUTRO"], "TURNO", "Cada pessoa tem um."],
    ["word-tiles-word-ladder", "cat-car", "Troque uma letra em GATO. Que nova palavra aparece?", ["PATO", "GATA", "GATOS"], "PATO", "Muda apenas o inicio."],
    ["word-tiles-word-ladder", "sand-send", "Troque uma letra em CASA. Que nova palavra e correta?", ["CAMA", "CASAS", "COSA"], "CAMA", "Uma letra muda o sentido."],
    ["word-tiles-word-ladder", "lamp-limp", "Troque uma letra em MALA. Que nova palavra e correta?", ["MOLA", "MALAS", "ALMA"], "MOLA", "Uma vogal muda."],
    ["word-tiles-word-ladder", "boat-coat", "Troque uma letra em BARCO. Que nova palavra e correta?", ["MARCO", "BARCOS", "COBRA"], "MARCO", "Muda a primeira letra."],
    ["word-tiles-compound", "sunday", "Qual palavra nomeia o dia tranquilo da semana?", ["DOMINGO", "MINGODO", "GODOMIN"], "DOMINGO", "Para muitos e dia de descanso."],
    ["word-tiles-compound", "teacup", "Qual palavra segura uma bebida quente?", ["XICARA", "CARAXI", "RAXICA"], "XICARA", "Combina com cha ou cafe."],
    ["word-tiles-compound", "bookmark", "Qual palavra guarda seu lugar no livro?", ["MARCADOR", "DORMARCA", "CAROMARD"], "MARCADOR", "Fica entre paginas."],
    ["word-tiles-compound", "fireplace", "Qual palavra nomeia o fogo acolhedor em casa?", ["LAREIRA", "REALIRA", "RELARIA"], "LAREIRA", "Aquece a sala."],
    ["word-tiles-vowel", "plant", "Qual vogal completa PL_NTA?", ["A", "E", "O"], "A", "A palavra vira PLANTA."],
    ["word-tiles-vowel", "river", "Qual vogal completa R_O?", ["I", "A", "E"], "I", "A palavra vira RIO."],
    ["word-tiles-vowel", "music", "Qual vogal completa M_SICA?", ["U", "A", "E"], "U", "A palavra vira MUSICA."],
    ["word-tiles-vowel", "table", "Qual vogal completa M_SA?", ["E", "A", "I"], "E", "A palavra vira MESA."],
    ["word-tiles-plural", "cards", "Qual palavra e o plural de CARTA?", ["CARTAS", "CASTAR", "TRACAS"], "CARTAS", "O S mostra que ha varias."],
    ["word-tiles-plural", "tiles", "Qual palavra e o plural de PECA?", ["PECAS", "CAPES", "CEPAS"], "PECAS", "Um jogo usa varias."],
    ["word-tiles-plural", "words", "Qual palavra e o plural de PALAVRA?", ["PALAVRAS", "LAVRAPAS", "PRALAVAS"], "PALAVRAS", "Sao varias palavras."],
    ["word-tiles-plural", "games", "Qual palavra e o plural de JOGO?", ["JOGOS", "JOGOR", "GOJOS"], "JOGOS", "A sala oferece varios."],
    ["word-tiles-gentle-clue", "calm", "Qual palavra significa tranquilo?", ["CALMO", "COLMA", "MALCO"], "CALMO", "E a sensacao certa da mesa."],
    ["word-tiles-gentle-clue", "brave", "Qual palavra significa com coragem?", ["CORAJOSO", "JOGARCOS", "ROJACOSO"], "CORAJOSO", "Ajuda a tentar um jogo novo."],
    ["word-tiles-gentle-clue", "clear", "Qual palavra significa facil de entender?", ["CLARO", "CALOR", "CARLO"], "CLARO", "Uma boa pista deve ser assim."],
    ["word-tiles-gentle-clue", "warm", "Qual palavra significa amigavel e nao frio?", ["QUENTE", "TENQUE", "NETQUE"], "QUENTE", "Pode descrever uma recepcao."],
    ["word-tiles-rhyme", "light-night", "Qual palavra rima com LUZ?", ["CRUZ", "MESA", "JOGO"], "CRUZ", "O som final combina."],
    ["word-tiles-rhyme", "day-play", "Qual palavra rima com DIA?", ["TIA", "PAO", "FLOR"], "TIA", "O final soa igual."],
    ["word-tiles-rhyme", "chair-share", "Qual palavra rima com AMOR?", ["FLOR", "MESA", "LUZ"], "FLOR", "Escute o final."],
    ["word-tiles-rhyme", "smile-mile", "Qual palavra rima com SORRISO?", ["PARAISO", "MESA", "TURNO"], "PARAISO", "O som final se repete."],
  ],
};

function buildExtraWordPuzzleBank(language: ExtraGameLanguage): SocialGameRound[] {
  const copy = extraWordCopy[language];

  return extraWordPuzzleData[language].map(([themeId, suffix, prompt, choices, answer, hint]) => ({
    id: `${themeId}-${suffix}`,
    kind: "word" as const,
    title: copy.title,
    body: copy.body,
    prompt,
    choices: [...choices],
    answer,
    hint,
    tags: ["games", "scrabble", "words", "game:word", `word:${wordThemeTags[themeId] ?? "word"}`],
    estimatedDurationSeconds: 80,
    successMessage: copy.successMessage,
  }));
}

const wordPuzzleBank: Record<SocialGameLanguage, SocialGameRound[]> = {
  en: buildWordPuzzleBank("en"),
  es: buildWordPuzzleBank("es"),
  de: buildWordPuzzleBank("de"),
  fr: buildExtraWordPuzzleBank("fr"),
  it: buildExtraWordPuzzleBank("it"),
  pt: buildExtraWordPuzzleBank("pt"),
};

type DominoValue = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type DominoTile = readonly [DominoValue, DominoValue];

type DominoesPuzzleVariant = {
  suffix: string;
  openEnds?: readonly [DominoValue, DominoValue];
  target?: DominoValue;
  desired?: DominoValue;
  avoid?: DominoValue;
  playOn?: DominoValue;
  otherEnd?: DominoValue;
  tile?: DominoTile;
  lastTile?: DominoTile;
  playedTile?: DominoTile;
  hand?: DominoTile[];
  tileChoices?: DominoTile[];
  answerTile?: DominoTile;
  textChoices?: Partial<Record<SocialGameLanguage, string[]>>;
  answerText?: Partial<Record<SocialGameLanguage, string>>;
  question?: LocalizedText;
  estimatedDurationSeconds?: number;
};

type DominoesPuzzleTheme = {
  id: string;
  tag: string;
  body: LocalizedText;
  successMessage: LocalizedText;
  prompt: (variant: DominoesPuzzleVariant, language: SocialLanguage) => string;
  hint: (variant: DominoesPuzzleVariant, language: SocialLanguage) => string;
  variants: DominoesPuzzleVariant[];
};

const dominoesRoundTitles: Record<SocialGameLanguage, string> = {
  en: "Dominoes",
  es: "Domino",
  fr: "Dominos",
  de: "Domino",
  it: "Domino",
  pt: "Domino",
};

const dominoValueLabels: Record<SocialGameLanguage, Record<DominoValue, string>> = {
  en: { 0: "blank", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six" },
  es: { 0: "blanca", 1: "uno", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis" },
  fr: { 0: "blanc", 1: "un", 2: "deux", 3: "trois", 4: "quatre", 5: "cinq", 6: "six" },
  de: { 0: "leer", 1: "eins", 2: "zwei", 3: "drei", 4: "vier", 5: "fuenf", 6: "sechs" },
  it: { 0: "vuoto", 1: "uno", 2: "due", 3: "tre", 4: "quattro", 5: "cinque", 6: "sei" },
  pt: { 0: "branco", 1: "um", 2: "dois", 3: "tres", 4: "quatro", 5: "cinco", 6: "seis" },
};

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function dominoValueLabel(value: DominoValue, language: SocialGameLanguage) {
  return dominoValueLabels[language][value];
}

function dominoTileLabel(tile: DominoTile, language: SocialGameLanguage) {
  const [left, right] = tile;
  if (left === right) {
    const value = dominoValueLabel(left, language);
    if (language === "de") return `Doppel-${value}`;
    if (language === "es") return `Doble ${value}`;
    if (language === "it") return `Doppio ${value}`;
    if (language === "pt") return `Duplo ${value}`;
    return `Double ${value}`;
  }

  return `${capitalise(dominoValueLabel(left, language))}-${dominoValueLabel(right, language)}`;
}

function dominoTileList(tiles: DominoTile[] | undefined, language: SocialGameLanguage) {
  return (tiles ?? []).map((tile) => dominoTileLabel(tile, language)).join(", ");
}

function dominoEndsLabel(ends: readonly [DominoValue, DominoValue] | undefined, language: SocialGameLanguage) {
  if (!ends) return "";
  const [left, right] = ends;
  const joiner = language === "en" ? " and " : language === "de" ? " und " : language === "es" ? " y " : language === "fr" ? " et " : " e ";
  return `${dominoValueLabel(left, language)}${joiner}${dominoValueLabel(right, language)}`;
}

function dominoTextChoice(value: string, language: SocialGameLanguage) {
  const labels: Record<string, Record<SocialGameLanguage, string>> = {
    drawOrPass: {
      en: "Draw a tile or pass",
      es: "Robar una ficha o pasar",
      fr: "Piocher une tuile ou passer",
      de: "Einen Stein ziehen oder passen",
      it: "Pescare una tessera o passare",
      pt: "Comprar uma peca ou passar",
    },
    playAny: {
      en: "Play any tile",
      es: "Jugar cualquier ficha",
      fr: "Jouer n'importe quelle tuile",
      de: "Einen beliebigen Stein spielen",
      it: "Giocare qualsiasi tessera",
      pt: "Jogar qualquer peca",
    },
    turnBoard: {
      en: "Turn the board around",
      es: "Girar la mesa",
      fr: "Tourner la table",
      de: "Den Tisch drehen",
      it: "Girare il tavolo",
      pt: "Virar a mesa",
    },
    askHint: {
      en: "Would you like a hint?",
      es: "Quieres una pista?",
      fr: "Veux-tu un indice?",
      de: "Moechtest du einen Hinweis?",
      it: "Vuoi un aiuto?",
      pt: "Voce quer uma dica?",
    },
    hurryUp: {
      en: "Hurry up",
      es: "Date prisa",
      fr: "Depeche-toi",
      de: "Beeil dich",
      it: "Sbrigati",
      pt: "Depressa",
    },
    takeTile: {
      en: "Take my tile",
      es: "Toma mi ficha",
      fr: "Prends ma tuile",
      de: "Nimm meinen Stein",
      it: "Prendi la mia tessera",
      pt: "Pegue minha peca",
    },
    sameBothSides: {
      en: "The same number on both sides",
      es: "El mismo numero en los dos lados",
      fr: "Le meme nombre des deux cotes",
      de: "Die gleiche Zahl auf beiden Seiten",
      it: "Lo stesso numero sui due lati",
      pt: "O mesmo numero dos dois lados",
    },
    emptySide: {
      en: "A tile with one empty side",
      es: "Una ficha con un lado vacio",
      fr: "Une tuile avec un cote vide",
      de: "Ein Stein mit einer leeren Seite",
      it: "Una tessera con un lato vuoto",
      pt: "Uma peca com um lado vazio",
    },
    lastTile: {
      en: "The last tile in your hand",
      es: "La ultima ficha de tu mano",
      fr: "La derniere tuile dans ta main",
      de: "Der letzte Stein in deiner Hand",
      it: "L'ultima tessera in mano",
      pt: "A ultima peca na sua mao",
    },
    noDots: {
      en: "No dots on one side",
      es: "Sin puntos en un lado",
      fr: "Aucun point sur un cote",
      de: "Keine Punkte auf einer Seite",
      it: "Nessun punto su un lato",
      pt: "Sem pontos em um lado",
    },
    openEnd: {
      en: "A number still open on the table",
      es: "Un numero abierto en la mesa",
      fr: "Un nombre encore ouvert sur la table",
      de: "Eine offene Zahl auf dem Tisch",
      it: "Un numero ancora aperto sul tavolo",
      pt: "Um numero ainda aberto na mesa",
    },
    pip: {
      en: "One dot on a tile",
      es: "Un punto de una ficha",
      fr: "Un point sur une tuile",
      de: "Ein Punkt auf einem Stein",
      it: "Un punto su una tessera",
      pt: "Um ponto em uma peca",
    },
    nicePlay: {
      en: "Nice play",
      es: "Buena jugada",
      fr: "Joli coup",
      de: "Guter Zug",
      it: "Bella giocata",
      pt: "Boa jogada",
    },
    yourTurn: {
      en: "It is your turn",
      es: "Es tu turno",
      fr: "C'est ton tour",
      de: "Du bist dran",
      it: "Tocca a te",
      pt: "E a sua vez",
    },
    takeTime: {
      en: "Take your time",
      es: "Tomate tu tiempo",
      fr: "Prends ton temps",
      de: "Lass dir Zeit",
      it: "Prenditi il tempo",
      pt: "Leve o tempo que precisar",
    },
  };

  return labels[value][language];
}

function buildDominoesPuzzleBank(language: SocialLanguage): SocialGameRound[] {
  return dominoesPuzzleThemes.flatMap((theme) =>
    theme.variants.map((variant) => ({
      id: `${theme.id}-${variant.suffix}`,
      kind: "dominoes" as const,
      title: dominoesRoundTitles[language],
      body: theme.body[language],
      prompt: theme.prompt(variant, language),
      choices: variant.tileChoices
        ? variant.tileChoices.map((tile) => dominoTileLabel(tile, language))
        : variant.textChoices?.[language] ?? [],
      answer: variant.answerTile
        ? dominoTileLabel(variant.answerTile, language)
        : variant.answerText?.[language] ?? "",
      hint: theme.hint(variant, language),
      tags: ["games", "dominoes", "game:dominoes", `dominoes:${theme.tag}`],
      estimatedDurationSeconds: variant.estimatedDurationSeconds ?? 75,
      successMessage: theme.successMessage[language],
    })),
  );
}

const extraDominoesCopy: Record<ExtraGameLanguage, { body: string; successMessage: string; choosePrompt: string; hint: string; openEnds: string; tile: string; lastTile: string; playedTile: string; hand: string; target: string; desired: string; avoid: string; playOn: string; otherEnd: string }> = {
  fr: {
    body: "Lis la table et choisis le bon coup.",
    successMessage: "Bien joue. Les petits choix de dominos donnent vite quelque chose a partager.",
    choosePrompt: "Choisis la meilleure reponse.",
    hint: "Regarde les nombres ouverts et la tuile qui garde le jeu simple.",
    openEnds: "extremites ouvertes",
    tile: "tuile",
    lastTile: "derniere tuile",
    playedTile: "tuile jouee",
    hand: "main",
    target: "cible",
    desired: "nombre a garder",
    avoid: "nombre a eviter",
    playOn: "jouer sur",
    otherEnd: "autre extremite",
  },
  it: {
    body: "Leggi il tavolo e scegli la mossa giusta.",
    successMessage: "Ben giocato. Piccole scelte di domino danno subito qualcosa da condividere.",
    choosePrompt: "Scegli la risposta migliore.",
    hint: "Guarda i numeri aperti e la tessera che mantiene semplice il gioco.",
    openEnds: "estremi aperti",
    tile: "tessera",
    lastTile: "ultima tessera",
    playedTile: "tessera giocata",
    hand: "mano",
    target: "bersaglio",
    desired: "numero da lasciare",
    avoid: "numero da evitare",
    playOn: "giocare su",
    otherEnd: "altro estremo",
  },
  pt: {
    body: "Leia a mesa e escolha a boa jogada.",
    successMessage: "Boa jogada. Pequenas escolhas de domino criam algo facil para compartilhar.",
    choosePrompt: "Escolha a melhor resposta.",
    hint: "Olhe os numeros abertos e a peca que mantem o jogo simples.",
    openEnds: "pontas abertas",
    tile: "peca",
    lastTile: "ultima peca",
    playedTile: "peca jogada",
    hand: "mao",
    target: "alvo",
    desired: "numero para manter",
    avoid: "numero para evitar",
    playOn: "jogar em",
    otherEnd: "outra ponta",
  },
};

const englishDominoValueNames: Record<string, DominoValue> = {
  blank: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

function translateDominoChoice(choice: string, language: ExtraGameLanguage) {
  const fixedChoices = [
    "drawOrPass",
    "playAny",
    "turnBoard",
    "askHint",
    "hurryUp",
    "takeTile",
    "sameBothSides",
    "emptySide",
    "lastTile",
    "noDots",
    "openEnd",
    "pip",
    "nicePlay",
    "yourTurn",
    "takeTime",
  ];
  const fixedChoice = fixedChoices.find((key) => dominoTextChoice(key, "en") === choice);
  if (fixedChoice) return dominoTextChoice(fixedChoice, language);

  if (/^\d+$/.test(choice)) return choice;

  const translateValue = (value: string) => {
    const dominoValue = englishDominoValueNames[value];
    return dominoValue === undefined ? value : dominoValueLabel(dominoValue, language);
  };

  const onlyMatch = choice.match(/^(blank|one|two|three|four|five|six) only$/);
  if (onlyMatch) {
    const value = translateValue(onlyMatch[1]);
    if (language === "fr") return `${value} seulement`;
    if (language === "it") return `solo ${value}`;
    return `somente ${value}`;
  }

  return choice.replace(/\b(blank|one|two|three|four|five|six)\b/g, translateValue)
    .replace(/\sor\s/g, language === "it" ? " o " : " ou ")
    .replace(/\sand\s/g, language === "fr" ? " et " : " e ");
}

function buildExtraDominoPrompt(variant: DominoesPuzzleVariant, language: ExtraGameLanguage) {
  const copy = extraDominoesCopy[language];
  const parts: string[] = [];

  if (variant.openEnds) parts.push(`${copy.openEnds}: ${dominoEndsLabel(variant.openEnds, language)}`);
  if (variant.tile) parts.push(`${copy.tile}: ${dominoTileLabel(variant.tile, language)}`);
  if (variant.lastTile) parts.push(`${copy.lastTile}: ${dominoTileLabel(variant.lastTile, language)}`);
  if (variant.playedTile) parts.push(`${copy.playedTile}: ${dominoTileLabel(variant.playedTile, language)}`);
  if (variant.hand?.length) parts.push(`${copy.hand}: ${dominoTileList(variant.hand, language)}`);
  if (variant.tileChoices?.length) parts.push(`${copy.hand}: ${dominoTileList(variant.tileChoices, language)}`);
  if (variant.target !== undefined) parts.push(`${copy.target}: ${dominoValueLabel(variant.target, language)}`);
  if (variant.desired !== undefined) parts.push(`${copy.desired}: ${dominoValueLabel(variant.desired, language)}`);
  if (variant.avoid !== undefined) parts.push(`${copy.avoid}: ${dominoValueLabel(variant.avoid, language)}`);
  if (variant.playOn !== undefined) parts.push(`${copy.playOn}: ${dominoValueLabel(variant.playOn, language)}`);
  if (variant.otherEnd !== undefined) parts.push(`${copy.otherEnd}: ${dominoValueLabel(variant.otherEnd, language)}`);

  return parts.length ? `${parts.join(". ")}. ${copy.choosePrompt}` : copy.choosePrompt;
}

function buildExtraDominoesPuzzleBank(language: ExtraGameLanguage): SocialGameRound[] {
  const copy = extraDominoesCopy[language];

  return dominoesPuzzleThemes.flatMap((theme) =>
    theme.variants.map((variant) => {
      const choices = variant.tileChoices
        ? variant.tileChoices.map((tile) => dominoTileLabel(tile, language))
        : (variant.textChoices?.en ?? []).map((choice) => translateDominoChoice(choice, language));
      const answer = variant.answerTile
        ? dominoTileLabel(variant.answerTile, language)
        : translateDominoChoice(variant.answerText?.en ?? choices[0] ?? "", language);

      return {
        id: `${theme.id}-${variant.suffix}`,
        kind: "dominoes" as const,
        title: dominoesRoundTitles[language],
        body: copy.body,
        prompt: buildExtraDominoPrompt(variant, language),
        choices,
        answer,
        hint: copy.hint,
        tags: ["games", "dominoes", "game:dominoes", `dominoes:${theme.tag}`],
        estimatedDurationSeconds: variant.estimatedDurationSeconds ?? 75,
        successMessage: copy.successMessage,
      };
    }),
  );
}

const dominoesPuzzleThemes: DominoesPuzzleTheme[] = [
  {
    id: "dominoes-open",
    tag: "opening-double",
    body: {
      en: "Choose the strongest opening tile.",
      es: "Elige la ficha de salida mas fuerte.",
      de: "Waehle den staerksten Startstein.",
    },
    successMessage: {
      en: "Nice table sense. A strong double gives everyone an easy start.",
      es: "Buena lectura de mesa. Un doble fuerte da un inicio claro.",
      de: "Gutes Tischgefuehl. Ein starkes Doppel macht den Start leicht.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Du beginnst und hast diese Doppel: ${dominoTileList(variant.tileChoices, language)}. Welcher Stein ist der staerkste Start?`
        : language === "en"
          ? `You are starting and have these doubles: ${dominoTileList(variant.tileChoices, language)}. Which tile is the strongest opener?`
          : `Empiezas y tienes estos dobles: ${dominoTileList(variant.tileChoices, language)}. Que ficha es la salida mas fuerte?`,
    hint: (_variant, language) =>
      language === "de"
        ? "Das hoechste Doppel gibt dem Tisch einen klaren Mittelpunkt."
        : language === "en"
          ? "The highest double gives the table a clear anchor."
          : "El doble mas alto da un centro claro a la mesa.",
    variants: [
      { suffix: "double-six", tileChoices: [[6, 6], [5, 5], [3, 3]], answerTile: [6, 6] },
      { suffix: "double-five", tileChoices: [[5, 5], [4, 4], [2, 2]], answerTile: [5, 5] },
      { suffix: "double-four", tileChoices: [[4, 4], [2, 2], [1, 1]], answerTile: [4, 4] },
      { suffix: "double-three", tileChoices: [[3, 3], [1, 1], [0, 0]], answerTile: [3, 3] },
    ],
  },
  {
    id: "dominoes-match-end",
    tag: "match-end",
    body: {
      en: "Match one open end.",
      es: "Empareja un extremo abierto.",
      de: "Passe an ein offenes Ende an.",
    },
    successMessage: {
      en: "Exactly. Dominoes starts with seeing the open number.",
      es: "Exacto. El domino empieza viendo el numero abierto.",
      de: "Genau. Domino beginnt mit der offenen Zahl.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Die offenen Enden sind ${dominoEndsLabel(variant.openEnds, language)}. Welcher Stein passt an die ${dominoValueLabel(variant.target!, language)}?`
        : language === "en"
          ? `The open ends are ${dominoEndsLabel(variant.openEnds, language)}. Which tile can play on the ${dominoValueLabel(variant.target!, language)} end?`
          : `Los extremos abiertos son ${dominoEndsLabel(variant.openEnds, language)}. Que ficha encaja con el ${dominoValueLabel(variant.target!, language)}?`,
    hint: (variant, language) =>
      language === "de"
        ? `Eine Seite des Steins muss ${dominoValueLabel(variant.target!, language)} zeigen.`
        : language === "en"
          ? `One side of the tile must show ${dominoValueLabel(variant.target!, language)}.`
          : `Un lado de la ficha debe mostrar ${dominoValueLabel(variant.target!, language)}.`,
    variants: [
      { suffix: "six-four", openEnds: [6, 2], target: 6, tileChoices: [[6, 4], [5, 3], [1, 0]], answerTile: [6, 4] },
      { suffix: "one-three", openEnds: [5, 1], target: 1, tileChoices: [[1, 3], [2, 4], [0, 6]], answerTile: [1, 3] },
      { suffix: "blank-two", openEnds: [0, 4], target: 0, tileChoices: [[0, 2], [3, 6], [4, 5]], answerTile: [0, 2] },
      { suffix: "three-five", openEnds: [3, 6], target: 3, tileChoices: [[3, 5], [4, 4], [1, 2]], answerTile: [3, 5] },
    ],
  },
  {
    id: "dominoes-count-pips",
    tag: "pip-count",
    body: {
      en: "Count the pips.",
      es: "Cuenta los puntos.",
      de: "Zaehle die Punkte.",
    },
    successMessage: {
      en: "Good counting. Pip totals make the table easier to read.",
      es: "Buen conteo. Los puntos ayudan a leer la mesa.",
      de: "Gut gezaehlt. Punktzahlen machen den Tisch klarer.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Wie viele Punkte hat der Stein ${dominoTileLabel(variant.tile!, language)} insgesamt?`
        : language === "en"
          ? `How many pips are on ${dominoTileLabel(variant.tile!, language)} in total?`
          : `Cuantos puntos tiene ${dominoTileLabel(variant.tile!, language)} en total?`,
    hint: (_variant, language) =>
      language === "de"
        ? "Addiere beide Seiten des Steins."
        : language === "en"
          ? "Add both sides of the tile."
          : "Suma los dos lados de la ficha.",
    variants: [
      { suffix: "six-four", tile: [6, 4], textChoices: { en: ["10", "9", "8"], es: ["10", "9", "8"], de: ["10", "9", "8"] }, answerText: { en: "10", es: "10", de: "10" } },
      { suffix: "five-two", tile: [5, 2], textChoices: { en: ["7", "8", "6"], es: ["7", "8", "6"], de: ["7", "8", "6"] }, answerText: { en: "7", es: "7", de: "7" } },
      { suffix: "double-three", tile: [3, 3], textChoices: { en: ["6", "5", "7"], es: ["6", "5", "7"], de: ["6", "5", "7"] }, answerText: { en: "6", es: "6", de: "6" } },
      { suffix: "blank-six", tile: [0, 6], textChoices: { en: ["6", "0", "12"], es: ["6", "0", "12"], de: ["6", "0", "12"] }, answerText: { en: "6", es: "6", de: "6" } },
    ],
  },
  {
    id: "dominoes-high-pips",
    tag: "high-pips",
    body: {
      en: "Lower the pips in your hand.",
      es: "Baja los puntos de tu mano.",
      de: "Senke die Punkte in deiner Hand.",
    },
    successMessage: {
      en: "Smart. Playing heavy tiles can make the end of a hand lighter.",
      es: "Bien pensado. Jugar fichas pesadas puede aligerar el final.",
      de: "Klug. Hohe Steine machen das Ende leichter.",
    },
    prompt: (_variant, language) =>
      language === "de"
        ? "Du willst viele Punkte loswerden. Welcher Stein entfernt die meisten Punkte?"
        : language === "en"
          ? "You want to lower the pips in your hand. Which tile removes the most pips?"
          : "Quieres bajar los puntos de tu mano. Que ficha quita mas puntos?",
    hint: (_variant, language) =>
      language === "de"
        ? "Zaehle beide Seiten und waehle die groesste Summe."
        : language === "en"
          ? "Add both sides and choose the largest total."
          : "Suma los dos lados y elige el total mas alto.",
    variants: [
      { suffix: "six-five", tileChoices: [[6, 5], [4, 0], [2, 2]], answerTile: [6, 5] },
      { suffix: "five-four", tileChoices: [[5, 4], [3, 3], [6, 0]], answerTile: [5, 4] },
      { suffix: "double-six", tileChoices: [[6, 6], [5, 2], [4, 4]], answerTile: [6, 6] },
      { suffix: "six-three", tileChoices: [[6, 3], [2, 5], [1, 1]], answerTile: [6, 3] },
    ],
  },
  {
    id: "dominoes-play-double",
    tag: "play-double",
    body: {
      en: "Play the matching double.",
      es: "Juega el doble correcto.",
      de: "Spiele das passende Doppel.",
    },
    successMessage: {
      en: "Nice. Doubles make a dominoes table feel lively.",
      es: "Bien. Los dobles dan vida a la mesa.",
      de: "Schoen. Doppelsteine bringen Leben an den Tisch.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Die offenen Enden sind ${dominoEndsLabel(variant.openEnds, language)}. Welches Doppel passt an die ${dominoValueLabel(variant.target!, language)}?`
        : language === "en"
          ? `The open ends are ${dominoEndsLabel(variant.openEnds, language)}. Which double fits the ${dominoValueLabel(variant.target!, language)} end?`
          : `Los extremos abiertos son ${dominoEndsLabel(variant.openEnds, language)}. Que doble encaja con el ${dominoValueLabel(variant.target!, language)}?`,
    hint: (variant, language) =>
      language === "de"
        ? `Suche den Stein mit ${dominoValueLabel(variant.target!, language)} auf beiden Seiten.`
        : language === "en"
          ? `Look for the tile with ${dominoValueLabel(variant.target!, language)} on both sides.`
          : `Busca la ficha con ${dominoValueLabel(variant.target!, language)} en los dos lados.`,
    variants: [
      { suffix: "double-four", openEnds: [4, 1], target: 4, tileChoices: [[4, 4], [1, 1], [3, 3]], answerTile: [4, 4] },
      { suffix: "double-two", openEnds: [6, 2], target: 2, tileChoices: [[2, 2], [6, 6], [5, 5]], answerTile: [2, 2] },
      { suffix: "double-blank", openEnds: [0, 5], target: 0, tileChoices: [[0, 0], [5, 5], [1, 1]], answerTile: [0, 0] },
      { suffix: "double-six", openEnds: [6, 3], target: 6, tileChoices: [[6, 6], [3, 3], [4, 4]], answerTile: [6, 6] },
    ],
  },
  {
    id: "dominoes-open-number",
    tag: "open-number",
    body: {
      en: "Open a useful number.",
      es: "Abre un numero util.",
      de: "Oeffne eine nuetzliche Zahl.",
    },
    successMessage: {
      en: "Good setup. You are thinking one move ahead.",
      es: "Buena preparacion. Estas pensando una jugada adelante.",
      de: "Gute Vorbereitung. Du denkst einen Zug voraus.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Das offene Ende ist ${dominoValueLabel(variant.playOn!, language)}. Du willst danach ${dominoValueLabel(variant.desired!, language)} offen lassen. Welcher Stein macht das?`
        : language === "en"
          ? `The open end is ${dominoValueLabel(variant.playOn!, language)}. You want to leave ${dominoValueLabel(variant.desired!, language)} showing. Which tile does that?`
          : `El extremo abierto es ${dominoValueLabel(variant.playOn!, language)}. Quieres dejar abierto el ${dominoValueLabel(variant.desired!, language)}. Que ficha lo hace?`,
    hint: (variant, language) =>
      language === "de"
        ? `Der Stein muss ${dominoValueLabel(variant.playOn!, language)} und ${dominoValueLabel(variant.desired!, language)} zeigen.`
        : language === "en"
          ? `The tile needs ${dominoValueLabel(variant.playOn!, language)} and ${dominoValueLabel(variant.desired!, language)}.`
          : `La ficha necesita ${dominoValueLabel(variant.playOn!, language)} y ${dominoValueLabel(variant.desired!, language)}.`,
    variants: [
      { suffix: "five-to-one", playOn: 5, desired: 1, tileChoices: [[5, 1], [5, 3], [5, 4]], answerTile: [5, 1] },
      { suffix: "six-to-two", playOn: 6, desired: 2, tileChoices: [[6, 2], [6, 5], [6, 4]], answerTile: [6, 2] },
      { suffix: "three-to-blank", playOn: 3, desired: 0, tileChoices: [[3, 0], [3, 6], [3, 1]], answerTile: [3, 0] },
      { suffix: "four-to-five", playOn: 4, desired: 5, tileChoices: [[4, 5], [4, 2], [4, 1]], answerTile: [4, 5] },
    ],
  },
  {
    id: "dominoes-flexible-tile",
    tag: "flexible",
    body: {
      en: "Find the flexible tile.",
      es: "Encuentra la ficha flexible.",
      de: "Finde den flexiblen Stein.",
    },
    successMessage: {
      en: "Flexible tiles keep a friendly hand moving.",
      es: "Las fichas flexibles mantienen la mano en marcha.",
      de: "Flexible Steine halten die Runde in Bewegung.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Die offenen Enden sind ${dominoEndsLabel(variant.openEnds, language)}. Welcher Stein passt an beide Enden?`
        : language === "en"
          ? `The open ends are ${dominoEndsLabel(variant.openEnds, language)}. Which tile can play on either end?`
          : `Los extremos abiertos son ${dominoEndsLabel(variant.openEnds, language)}. Que ficha puede jugarse en cualquiera de los dos?`,
    hint: (_variant, language) =>
      language === "de"
        ? "Der flexible Stein zeigt beide offenen Zahlen."
        : language === "en"
          ? "The flexible tile shows both open numbers."
          : "La ficha flexible muestra los dos numeros abiertos.",
    variants: [
      { suffix: "two-five", openEnds: [2, 5], tileChoices: [[2, 5], [2, 3], [4, 5]], answerTile: [2, 5] },
      { suffix: "blank-six", openEnds: [0, 6], tileChoices: [[0, 6], [0, 3], [6, 2]], answerTile: [0, 6] },
      { suffix: "one-four", openEnds: [1, 4], tileChoices: [[1, 4], [1, 6], [3, 4]], answerTile: [1, 4] },
      { suffix: "three-five", openEnds: [3, 5], tileChoices: [[3, 5], [3, 0], [2, 5]], answerTile: [3, 5] },
    ],
  },
  {
    id: "dominoes-blank-end",
    tag: "blank",
    body: {
      en: "Use the blank end.",
      es: "Usa el extremo blanco.",
      de: "Nutze das leere Ende.",
    },
    successMessage: {
      en: "Good eye. Blanks are easy to miss at first.",
      es: "Buena vista. Las blancas se escapan facilmente al principio.",
      de: "Gut gesehen. Leere Seiten uebersieht man schnell.",
    },
    prompt: (_variant, language) =>
      language === "de"
        ? "Ein offenes Ende ist leer. Welcher Stein kann dort gespielt werden?"
        : language === "en"
          ? "One open end is blank. Which tile can play on that blank end?"
          : "Un extremo abierto esta en blanco. Que ficha puede jugarse ahi?",
    hint: (_variant, language) =>
      language === "de"
        ? "Suche einen Stein mit einer leeren Seite."
        : language === "en"
          ? "Look for a tile with a blank side."
          : "Busca una ficha con un lado blanco.",
    variants: [
      { suffix: "blank-four", tileChoices: [[0, 4], [1, 5], [2, 6]], answerTile: [0, 4] },
      { suffix: "blank-one", tileChoices: [[0, 1], [3, 5], [2, 2]], answerTile: [0, 1] },
      { suffix: "blank-six", tileChoices: [[0, 6], [4, 5], [3, 3]], answerTile: [0, 6] },
      { suffix: "blank-two", tileChoices: [[0, 2], [1, 6], [4, 4]], answerTile: [0, 2] },
    ],
  },
  {
    id: "dominoes-avoid-number",
    tag: "avoid-number",
    body: {
      en: "Avoid opening a helpful number.",
      es: "Evita abrir un numero util.",
      de: "Vermeide eine hilfreiche Zahl.",
    },
    successMessage: {
      en: "Careful play. Dominoes has a little table-reading in it.",
      es: "Jugada cuidadosa. El domino tambien es leer la mesa.",
      de: "Vorsichtig gespielt. Domino ist auch Tischlesen.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Du kannst auf ${dominoValueLabel(variant.playOn!, language)} spielen. Ein anderer Spieler wartet auf ${dominoValueLabel(variant.avoid!, language)}. Welcher Stein oeffnet diese Zahl nicht?`
        : language === "en"
          ? `You can play on ${dominoValueLabel(variant.playOn!, language)}. Another player seems to want ${dominoValueLabel(variant.avoid!, language)}s. Which tile avoids opening that number?`
          : `Puedes jugar en el ${dominoValueLabel(variant.playOn!, language)}. Otra persona parece esperar ${dominoValueLabel(variant.avoid!, language)}. Que ficha evita abrir ese numero?`,
    hint: (variant, language) =>
      language === "de"
        ? `Waehle einen Stein mit ${dominoValueLabel(variant.playOn!, language)}, aber ohne ${dominoValueLabel(variant.avoid!, language)} auf der neuen Seite.`
        : language === "en"
          ? `Choose a tile with ${dominoValueLabel(variant.playOn!, language)}, but not ${dominoValueLabel(variant.avoid!, language)} on the new side.`
          : `Elige una ficha con ${dominoValueLabel(variant.playOn!, language)}, pero sin ${dominoValueLabel(variant.avoid!, language)} en el lado nuevo.`,
    variants: [
      { suffix: "avoid-six", playOn: 4, avoid: 6, tileChoices: [[4, 6], [4, 2], [4, 5]], answerTile: [4, 2] },
      { suffix: "avoid-five", playOn: 2, avoid: 5, tileChoices: [[2, 5], [2, 1], [2, 4]], answerTile: [2, 1] },
      { suffix: "avoid-three", playOn: 6, avoid: 3, tileChoices: [[6, 3], [6, 0], [6, 2]], answerTile: [6, 0] },
      { suffix: "avoid-four", playOn: 1, avoid: 4, tileChoices: [[1, 4], [1, 6], [1, 5]], answerTile: [1, 6] },
    ],
  },
  {
    id: "dominoes-keep-number",
    tag: "keep-number",
    body: {
      en: "Keep your useful number open.",
      es: "Mantén abierto tu numero util.",
      de: "Halte deine nuetzliche Zahl offen.",
    },
    successMessage: {
      en: "Good planning. Keeping your number open can protect your next turn.",
      es: "Buena planificacion. Mantener tu numero abierto ayuda al siguiente turno.",
      de: "Gut geplant. Eine offene eigene Zahl hilft im naechsten Zug.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Du hast mehrere ${dominoValueLabel(variant.desired!, language)}er. Welcher Spielzug laesst ${dominoValueLabel(variant.desired!, language)} offen?`
        : language === "en"
          ? `You have several ${dominoValueLabel(variant.desired!, language)}s. Which play keeps ${dominoValueLabel(variant.desired!, language)} open?`
          : `Tienes varias fichas con ${dominoValueLabel(variant.desired!, language)}. Que jugada deja abierto el ${dominoValueLabel(variant.desired!, language)}?`,
    hint: (variant, language) =>
      language === "de"
        ? `Der neue offene Wert soll ${dominoValueLabel(variant.desired!, language)} sein.`
        : language === "en"
          ? `The new open value should be ${dominoValueLabel(variant.desired!, language)}.`
          : `El nuevo valor abierto debe ser ${dominoValueLabel(variant.desired!, language)}.`,
    variants: [
      { suffix: "keep-three", desired: 3, tileChoices: [[6, 3], [6, 1], [6, 5]], answerTile: [6, 3] },
      { suffix: "keep-five", desired: 5, tileChoices: [[2, 5], [2, 0], [2, 4]], answerTile: [2, 5] },
      { suffix: "keep-one", desired: 1, tileChoices: [[4, 1], [4, 6], [4, 2]], answerTile: [4, 1] },
      { suffix: "keep-blank", desired: 0, tileChoices: [[5, 0], [5, 2], [5, 6]], answerTile: [5, 0] },
    ],
  },
  {
    id: "dominoes-last-tile",
    tag: "endgame",
    body: {
      en: "Read your last tile.",
      es: "Lee tu ultima ficha.",
      de: "Lies deinen letzten Stein.",
    },
    successMessage: {
      en: "That is endgame thinking: know which numbers let you finish.",
      es: "Eso es pensar el final: saber que numeros te dejan cerrar.",
      de: "Das ist Endspiel-Denken: wissen, welche Zahlen dich fertig machen.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Dein letzter Stein ist ${dominoTileLabel(variant.lastTile!, language)}. Welches offene Ende laesst dich fertig werden?`
        : language === "en"
          ? `Your last tile is ${dominoTileLabel(variant.lastTile!, language)}. Which open end lets you go out?`
          : `Tu ultima ficha es ${dominoTileLabel(variant.lastTile!, language)}. Que extremo abierto te deja terminar?`,
    hint: (variant, language) =>
      language === "de"
        ? `Du brauchst ${dominoEndsLabel(variant.lastTile, language)}.`
        : language === "en"
          ? `You need ${dominoEndsLabel(variant.lastTile, language)}.`
          : `Necesitas ${dominoEndsLabel(variant.lastTile, language)}.`,
    variants: [
      {
        suffix: "four-one",
        lastTile: [4, 1],
        textChoices: { en: ["four or one", "six only", "blank only"], es: ["cuatro o uno", "solo seis", "solo blanca"], de: ["vier oder eins", "nur sechs", "nur leer"] },
        answerText: { en: "four or one", es: "cuatro o uno", de: "vier oder eins" },
      },
      {
        suffix: "blank-five",
        lastTile: [0, 5],
        textChoices: { en: ["blank or five", "two only", "three only"], es: ["blanca o cinco", "solo dos", "solo tres"], de: ["leer oder fuenf", "nur zwei", "nur drei"] },
        answerText: { en: "blank or five", es: "blanca o cinco", de: "leer oder fuenf" },
      },
      {
        suffix: "double-two",
        lastTile: [2, 2],
        textChoices: { en: ["two", "five", "blank"], es: ["dos", "cinco", "blanca"], de: ["zwei", "fuenf", "leer"] },
        answerText: { en: "two", es: "dos", de: "zwei" },
      },
      {
        suffix: "six-three",
        lastTile: [6, 3],
        textChoices: { en: ["six or three", "one only", "four only"], es: ["seis o tres", "solo uno", "solo cuatro"], de: ["sechs oder drei", "nur eins", "nur vier"] },
        answerText: { en: "six or three", es: "seis o tres", de: "sechs oder drei" },
      },
    ],
  },
  {
    id: "dominoes-draw-pass",
    tag: "draw-pass",
    body: {
      en: "Know when no tile fits.",
      es: "Reconoce cuando no encaja ninguna ficha.",
      de: "Erkenne, wann kein Stein passt.",
    },
    successMessage: {
      en: "Right. Passing or drawing keeps the round fair and friendly.",
      es: "Correcto. Robar o pasar mantiene la ronda justa y amable.",
      de: "Richtig. Ziehen oder passen haelt die Runde fair.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Die offenen Enden sind ${dominoEndsLabel(variant.openEnds, language)}. Deine Steine sind ${dominoTileList(variant.hand, language)}. Keiner passt. Was tust du?`
        : language === "en"
          ? `The open ends are ${dominoEndsLabel(variant.openEnds, language)}. Your tiles are ${dominoTileList(variant.hand, language)}. None match. What do you do?`
          : `Los extremos abiertos son ${dominoEndsLabel(variant.openEnds, language)}. Tus fichas son ${dominoTileList(variant.hand, language)}. Ninguna encaja. Que haces?`,
    hint: (_variant, language) =>
      language === "de"
        ? "Wenn kein Stein passt, ziehst du nach den Hausregeln oder passt."
        : language === "en"
          ? "If no tile fits, draw by house rules or pass."
          : "Si ninguna ficha encaja, robas segun la regla de la mesa o pasas.",
    variants: [
      { suffix: "ends-two-six", openEnds: [2, 6], hand: [[1, 3], [4, 5], [0, 0]], textChoices: { en: [dominoTextChoice("drawOrPass", "en"), dominoTextChoice("playAny", "en"), dominoTextChoice("turnBoard", "en")], es: [dominoTextChoice("drawOrPass", "es"), dominoTextChoice("playAny", "es"), dominoTextChoice("turnBoard", "es")], de: [dominoTextChoice("drawOrPass", "de"), dominoTextChoice("playAny", "de"), dominoTextChoice("turnBoard", "de")] }, answerText: { en: dominoTextChoice("drawOrPass", "en"), es: dominoTextChoice("drawOrPass", "es"), de: dominoTextChoice("drawOrPass", "de") } },
      { suffix: "ends-blank-five", openEnds: [0, 5], hand: [[1, 2], [3, 4], [6, 6]], textChoices: { en: [dominoTextChoice("drawOrPass", "en"), dominoTextChoice("playAny", "en"), dominoTextChoice("turnBoard", "en")], es: [dominoTextChoice("drawOrPass", "es"), dominoTextChoice("playAny", "es"), dominoTextChoice("turnBoard", "es")], de: [dominoTextChoice("drawOrPass", "de"), dominoTextChoice("playAny", "de"), dominoTextChoice("turnBoard", "de")] }, answerText: { en: dominoTextChoice("drawOrPass", "en"), es: dominoTextChoice("drawOrPass", "es"), de: dominoTextChoice("drawOrPass", "de") } },
      { suffix: "ends-one-four", openEnds: [1, 4], hand: [[2, 3], [5, 6], [0, 0]], textChoices: { en: [dominoTextChoice("drawOrPass", "en"), dominoTextChoice("playAny", "en"), dominoTextChoice("turnBoard", "en")], es: [dominoTextChoice("drawOrPass", "es"), dominoTextChoice("playAny", "es"), dominoTextChoice("turnBoard", "es")], de: [dominoTextChoice("drawOrPass", "de"), dominoTextChoice("playAny", "de"), dominoTextChoice("turnBoard", "de")] }, answerText: { en: dominoTextChoice("drawOrPass", "en"), es: dominoTextChoice("drawOrPass", "es"), de: dominoTextChoice("drawOrPass", "de") } },
      { suffix: "ends-three-six", openEnds: [3, 6], hand: [[0, 1], [2, 4], [5, 5]], textChoices: { en: [dominoTextChoice("drawOrPass", "en"), dominoTextChoice("playAny", "en"), dominoTextChoice("turnBoard", "en")], es: [dominoTextChoice("drawOrPass", "es"), dominoTextChoice("playAny", "es"), dominoTextChoice("turnBoard", "es")], de: [dominoTextChoice("drawOrPass", "de"), dominoTextChoice("playAny", "de"), dominoTextChoice("turnBoard", "de")] }, answerText: { en: dominoTextChoice("drawOrPass", "en"), es: dominoTextChoice("drawOrPass", "es"), de: dominoTextChoice("drawOrPass", "de") } },
    ],
  },
  {
    id: "dominoes-vocabulary",
    tag: "vocabulary",
    body: {
      en: "Name a dominoes idea.",
      es: "Nombra una idea de domino.",
      de: "Benenne eine Domino-Idee.",
    },
    successMessage: {
      en: "Good word. Shared language makes the table friendlier.",
      es: "Buena palabra. El lenguaje compartido hace la mesa mas amable.",
      de: "Gutes Wort. Gemeinsame Begriffe machen den Tisch freundlicher.",
    },
    prompt: (variant, language) => variant.question?.[language] ?? "",
    hint: (_variant, language) =>
      language === "de"
        ? "Waehle die einfache Domino-Bedeutung."
        : language === "en"
          ? "Choose the simple dominoes meaning."
          : "Elige el significado sencillo de domino.",
    variants: [
      {
        suffix: "double",
        question: { en: "What is a double?", es: "Que es un doble?", de: "Was ist ein Doppel?" },
        textChoices: { en: [dominoTextChoice("sameBothSides", "en"), dominoTextChoice("emptySide", "en"), dominoTextChoice("lastTile", "en")], es: [dominoTextChoice("sameBothSides", "es"), dominoTextChoice("emptySide", "es"), dominoTextChoice("lastTile", "es")], de: [dominoTextChoice("sameBothSides", "de"), dominoTextChoice("emptySide", "de"), dominoTextChoice("lastTile", "de")] },
        answerText: { en: dominoTextChoice("sameBothSides", "en"), es: dominoTextChoice("sameBothSides", "es"), de: dominoTextChoice("sameBothSides", "de") },
      },
      {
        suffix: "blank",
        question: { en: "What does blank mean on a domino tile?", es: "Que significa blanca en una ficha?", de: "Was bedeutet leer auf einem Dominostein?" },
        textChoices: { en: [dominoTextChoice("noDots", "en"), dominoTextChoice("openEnd", "en"), dominoTextChoice("pip", "en")], es: [dominoTextChoice("noDots", "es"), dominoTextChoice("openEnd", "es"), dominoTextChoice("pip", "es")], de: [dominoTextChoice("noDots", "de"), dominoTextChoice("openEnd", "de"), dominoTextChoice("pip", "de")] },
        answerText: { en: dominoTextChoice("noDots", "en"), es: dominoTextChoice("noDots", "es"), de: dominoTextChoice("noDots", "de") },
      },
      {
        suffix: "open-end",
        question: { en: "What is an open end?", es: "Que es un extremo abierto?", de: "Was ist ein offenes Ende?" },
        textChoices: { en: [dominoTextChoice("openEnd", "en"), dominoTextChoice("lastTile", "en"), dominoTextChoice("emptySide", "en")], es: [dominoTextChoice("openEnd", "es"), dominoTextChoice("lastTile", "es"), dominoTextChoice("emptySide", "es")], de: [dominoTextChoice("openEnd", "de"), dominoTextChoice("lastTile", "de"), dominoTextChoice("emptySide", "de")] },
        answerText: { en: dominoTextChoice("openEnd", "en"), es: dominoTextChoice("openEnd", "es"), de: dominoTextChoice("openEnd", "de") },
      },
      {
        suffix: "pip",
        question: { en: "What is a pip?", es: "Que es un punto?", de: "Was ist ein Punkt?" },
        textChoices: { en: [dominoTextChoice("pip", "en"), dominoTextChoice("sameBothSides", "en"), dominoTextChoice("turnBoard", "en")], es: [dominoTextChoice("pip", "es"), dominoTextChoice("sameBothSides", "es"), dominoTextChoice("turnBoard", "es")], de: [dominoTextChoice("pip", "de"), dominoTextChoice("sameBothSides", "de"), dominoTextChoice("turnBoard", "de")] },
        answerText: { en: dominoTextChoice("pip", "en"), es: dominoTextChoice("pip", "es"), de: dominoTextChoice("pip", "de") },
      },
    ],
  },
  {
    id: "dominoes-most-pips",
    tag: "compare-pips",
    body: {
      en: "Compare two or three tiles.",
      es: "Compara dos o tres fichas.",
      de: "Vergleiche zwei oder drei Steine.",
    },
    successMessage: {
      en: "Good comparison. Big tiles are easier to spot with practice.",
      es: "Buena comparacion. Las fichas grandes se ven mejor con practica.",
      de: "Gut verglichen. Hohe Steine erkennt man mit Uebung schneller.",
    },
    prompt: (_variant, language) =>
      language === "de"
        ? "Welcher Stein hat die meisten Punkte?"
        : language === "en"
          ? "Which tile has the most pips?"
          : "Que ficha tiene mas puntos?",
    hint: (_variant, language) =>
      language === "de"
        ? "Addiere beide Seiten jedes Steins."
        : language === "en"
          ? "Add both sides on each tile."
          : "Suma los dos lados de cada ficha.",
    variants: [
      { suffix: "six-four", tileChoices: [[6, 4], [5, 2], [3, 3]], answerTile: [6, 4] },
      { suffix: "five-five", tileChoices: [[5, 5], [6, 1], [4, 4]], answerTile: [5, 5] },
      { suffix: "six-six", tileChoices: [[6, 6], [5, 4], [3, 5]], answerTile: [6, 6] },
      { suffix: "four-five", tileChoices: [[4, 5], [2, 6], [3, 3]], answerTile: [4, 5] },
    ],
  },
  {
    id: "dominoes-balance-ends",
    tag: "balance-ends",
    body: {
      en: "Make both ends match.",
      es: "Haz que coincidan los dos extremos.",
      de: "Mache beide Enden gleich.",
    },
    successMessage: {
      en: "Nice pattern. Matching ends are easy for the table to read.",
      es: "Buen patron. Los extremos iguales son faciles de leer.",
      de: "Schoenes Muster. Gleiche Enden sind leicht zu lesen.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Das andere Ende ist ${dominoValueLabel(variant.otherEnd!, language)}. Du spielst auf ${dominoValueLabel(variant.playOn!, language)}. Welcher Stein macht beide offenen Enden zu ${dominoValueLabel(variant.desired!, language)}?`
        : language === "en"
          ? `The other open end is ${dominoValueLabel(variant.otherEnd!, language)}. You are playing on ${dominoValueLabel(variant.playOn!, language)}. Which tile makes both open ends ${dominoValueLabel(variant.desired!, language)}?`
          : `El otro extremo abierto es ${dominoValueLabel(variant.otherEnd!, language)}. Juegas en el ${dominoValueLabel(variant.playOn!, language)}. Que ficha deja los dos extremos en ${dominoValueLabel(variant.desired!, language)}?`,
    hint: (variant, language) =>
      language === "de"
        ? `Der Stein braucht ${dominoValueLabel(variant.playOn!, language)} und ${dominoValueLabel(variant.desired!, language)}.`
        : language === "en"
          ? `The tile needs ${dominoValueLabel(variant.playOn!, language)} and ${dominoValueLabel(variant.desired!, language)}.`
          : `La ficha necesita ${dominoValueLabel(variant.playOn!, language)} y ${dominoValueLabel(variant.desired!, language)}.`,
    variants: [
      { suffix: "six-to-two", otherEnd: 2, playOn: 6, desired: 2, tileChoices: [[6, 2], [6, 5], [6, 4]], answerTile: [6, 2] },
      { suffix: "five-to-one", otherEnd: 1, playOn: 5, desired: 1, tileChoices: [[5, 1], [5, 3], [5, 6]], answerTile: [5, 1] },
      { suffix: "three-to-blank", otherEnd: 0, playOn: 3, desired: 0, tileChoices: [[3, 0], [3, 2], [3, 6]], answerTile: [3, 0] },
      { suffix: "four-to-six", otherEnd: 6, playOn: 4, desired: 6, tileChoices: [[4, 6], [4, 1], [4, 5]], answerTile: [4, 6] },
    ],
  },
  {
    id: "dominoes-table-kindness",
    tag: "table-kindness",
    body: {
      en: "Keep the table friendly.",
      es: "Mantén la mesa amable.",
      de: "Halte den Tisch freundlich.",
    },
    successMessage: {
      en: "That is the VYVA table tone: helpful, never pushy.",
      es: "Ese es el tono de VYVA: ayudar sin presionar.",
      de: "Das ist der VYVA-Ton: hilfreich, nicht draengend.",
    },
    prompt: (variant, language) => variant.question?.[language] ?? "",
    hint: (_variant, language) =>
      language === "de"
        ? "Die beste Hilfe fragt zuerst."
        : language === "en"
          ? "The best help asks first."
          : "La mejor ayuda pregunta primero.",
    variants: [
      {
        suffix: "offer-hint",
        question: { en: "Someone pauses over a move. What is the kindest thing to say?", es: "Alguien se queda pensando. Que es lo mas amable?", de: "Jemand zoegert bei einem Zug. Was ist am freundlichsten?" },
        textChoices: { en: [dominoTextChoice("askHint", "en"), dominoTextChoice("hurryUp", "en"), dominoTextChoice("takeTile", "en")], es: [dominoTextChoice("askHint", "es"), dominoTextChoice("hurryUp", "es"), dominoTextChoice("takeTile", "es")], de: [dominoTextChoice("askHint", "de"), dominoTextChoice("hurryUp", "de"), dominoTextChoice("takeTile", "de")] },
        answerText: { en: dominoTextChoice("askHint", "en"), es: dominoTextChoice("askHint", "es"), de: dominoTextChoice("askHint", "de") },
      },
      {
        suffix: "praise-play",
        question: { en: "A partner finds a clever tile. What keeps the table warm?", es: "Una persona encuentra una buena ficha. Que mantiene la mesa calida?", de: "Jemand findet einen klugen Stein. Was haelt den Tisch warm?" },
        textChoices: { en: [dominoTextChoice("nicePlay", "en"), dominoTextChoice("hurryUp", "en"), dominoTextChoice("turnBoard", "en")], es: [dominoTextChoice("nicePlay", "es"), dominoTextChoice("hurryUp", "es"), dominoTextChoice("turnBoard", "es")], de: [dominoTextChoice("nicePlay", "de"), dominoTextChoice("hurryUp", "de"), dominoTextChoice("turnBoard", "de")] },
        answerText: { en: dominoTextChoice("nicePlay", "en"), es: dominoTextChoice("nicePlay", "es"), de: dominoTextChoice("nicePlay", "de") },
      },
      {
        suffix: "turn-reminder",
        question: { en: "Someone lost track of the order. What is a calm reminder?", es: "Alguien pierde el turno. Que recordatorio es tranquilo?", de: "Jemand verliert die Reihenfolge. Was ist eine ruhige Erinnerung?" },
        textChoices: { en: [dominoTextChoice("yourTurn", "en"), dominoTextChoice("hurryUp", "en"), dominoTextChoice("takeTile", "en")], es: [dominoTextChoice("yourTurn", "es"), dominoTextChoice("hurryUp", "es"), dominoTextChoice("takeTile", "es")], de: [dominoTextChoice("yourTurn", "de"), dominoTextChoice("hurryUp", "de"), dominoTextChoice("takeTile", "de")] },
        answerText: { en: dominoTextChoice("yourTurn", "en"), es: dominoTextChoice("yourTurn", "es"), de: dominoTextChoice("yourTurn", "de") },
      },
      {
        suffix: "slow-move",
        question: { en: "A player needs an extra moment. What helps?", es: "Una persona necesita un momento mas. Que ayuda?", de: "Jemand braucht einen Moment laenger. Was hilft?" },
        textChoices: { en: [dominoTextChoice("takeTime", "en"), dominoTextChoice("hurryUp", "en"), dominoTextChoice("playAny", "en")], es: [dominoTextChoice("takeTime", "es"), dominoTextChoice("hurryUp", "es"), dominoTextChoice("playAny", "es")], de: [dominoTextChoice("takeTime", "de"), dominoTextChoice("hurryUp", "de"), dominoTextChoice("playAny", "de")] },
        answerText: { en: dominoTextChoice("takeTime", "en"), es: dominoTextChoice("takeTime", "es"), de: dominoTextChoice("takeTime", "de") },
      },
    ],
  },
  {
    id: "dominoes-same-end",
    tag: "same-end",
    body: {
      en: "Match a table with twin ends.",
      es: "Empareja una mesa con extremos iguales.",
      de: "Passe an gleiche Tischenden an.",
    },
    successMessage: {
      en: "Good. Twin ends make the matching number very clear.",
      es: "Bien. Los extremos iguales aclaran mucho el numero.",
      de: "Gut. Gleiche Enden machen die Zahl sehr klar.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Beide offenen Enden zeigen ${dominoValueLabel(variant.target!, language)}. Welches Doppel passt am klarsten?`
        : language === "en"
          ? `Both open ends show ${dominoValueLabel(variant.target!, language)}. Which double is the clearest match?`
          : `Los dos extremos abiertos muestran ${dominoValueLabel(variant.target!, language)}. Que doble encaja mejor?`,
    hint: (variant, language) =>
      language === "de"
        ? `Das passende Doppel zeigt zweimal ${dominoValueLabel(variant.target!, language)}.`
        : language === "en"
          ? `The matching double shows ${dominoValueLabel(variant.target!, language)} twice.`
          : `El doble correcto muestra ${dominoValueLabel(variant.target!, language)} dos veces.`,
    variants: [
      { suffix: "fives", target: 5, tileChoices: [[5, 5], [5, 1], [2, 2]], answerTile: [5, 5] },
      { suffix: "twos", target: 2, tileChoices: [[2, 2], [2, 6], [4, 4]], answerTile: [2, 2] },
      { suffix: "blanks", target: 0, tileChoices: [[0, 0], [0, 4], [6, 6]], answerTile: [0, 0] },
      { suffix: "sixes", target: 6, tileChoices: [[6, 6], [6, 1], [3, 3]], answerTile: [6, 6] },
    ],
  },
  {
    id: "dominoes-low-open",
    tag: "low-open",
    body: {
      en: "Leave the lowest new number.",
      es: "Deja el numero nuevo mas bajo.",
      de: "Lass die niedrigste neue Zahl offen.",
    },
    successMessage: {
      en: "Soft landing. A low new number can slow a heavy table.",
      es: "Suave. Un numero bajo puede calmar una mesa pesada.",
      de: "Sanft gelandet. Eine niedrige Zahl kann den Tisch beruhigen.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Du spielst auf ${dominoValueLabel(variant.playOn!, language)}. Welcher Stein laesst die niedrigste neue Zahl offen?`
        : language === "en"
          ? `You are playing on ${dominoValueLabel(variant.playOn!, language)}. Which tile leaves the lowest new open number?`
          : `Juegas en el ${dominoValueLabel(variant.playOn!, language)}. Que ficha deja abierto el numero nuevo mas bajo?`,
    hint: (variant, language) =>
      language === "de"
        ? `Alle Steine passen auf ${dominoValueLabel(variant.playOn!, language)}. Vergleiche die andere Seite.`
        : language === "en"
          ? `All the tiles fit ${dominoValueLabel(variant.playOn!, language)}. Compare the other side.`
          : `Todas las fichas encajan con ${dominoValueLabel(variant.playOn!, language)}. Compara el otro lado.`,
    variants: [
      { suffix: "six-to-one", playOn: 6, tileChoices: [[6, 1], [6, 5], [6, 4]], answerTile: [6, 1] },
      { suffix: "five-to-blank", playOn: 5, tileChoices: [[5, 0], [5, 2], [5, 6]], answerTile: [5, 0] },
      { suffix: "four-to-one", playOn: 4, tileChoices: [[4, 1], [4, 3], [4, 6]], answerTile: [4, 1] },
      { suffix: "three-to-blank", playOn: 3, tileChoices: [[3, 0], [3, 2], [3, 5]], answerTile: [3, 0] },
    ],
  },
  {
    id: "dominoes-not-fit",
    tag: "not-fit",
    body: {
      en: "Spot the tile that does not fit.",
      es: "Encuentra la ficha que no encaja.",
      de: "Finde den Stein, der nicht passt.",
    },
    successMessage: {
      en: "Good filter. Knowing what cannot play is useful too.",
      es: "Buen filtro. Saber que no se puede jugar tambien ayuda.",
      de: "Gut gefiltert. Zu wissen, was nicht passt, hilft auch.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Die offenen Enden sind ${dominoEndsLabel(variant.openEnds, language)}. Welcher Stein passt an kein Ende?`
        : language === "en"
          ? `The open ends are ${dominoEndsLabel(variant.openEnds, language)}. Which tile does not fit either end?`
          : `Los extremos abiertos son ${dominoEndsLabel(variant.openEnds, language)}. Que ficha no encaja en ningun extremo?`,
    hint: (_variant, language) =>
      language === "de"
        ? "Der falsche Stein zeigt keine der offenen Zahlen."
        : language === "en"
          ? "The non-fitting tile has neither open number."
          : "La ficha que no encaja no tiene ningun numero abierto.",
    variants: [
      { suffix: "ends-three-five", openEnds: [3, 5], tileChoices: [[3, 1], [5, 6], [1, 2]], answerTile: [1, 2] },
      { suffix: "ends-blank-four", openEnds: [0, 4], tileChoices: [[0, 6], [4, 2], [1, 5]], answerTile: [1, 5] },
      { suffix: "ends-two-six", openEnds: [2, 6], tileChoices: [[2, 0], [6, 4], [3, 5]], answerTile: [3, 5] },
      { suffix: "ends-one-five", openEnds: [1, 5], tileChoices: [[1, 6], [5, 0], [2, 3]], answerTile: [2, 3] },
    ],
  },
  {
    id: "dominoes-new-ends",
    tag: "new-ends",
    body: {
      en: "Read the new open ends.",
      es: "Lee los nuevos extremos abiertos.",
      de: "Lies die neuen offenen Enden.",
    },
    successMessage: {
      en: "Good board reading. You can see how the table changes.",
      es: "Buena lectura. Ves como cambia la mesa.",
      de: "Gute Brettsicht. Du siehst, wie der Tisch sich aendert.",
    },
    prompt: (variant, language) =>
      language === "de"
        ? `Das andere Ende ist ${dominoValueLabel(variant.otherEnd!, language)}. Du spielst ${dominoTileLabel(variant.playedTile!, language)} auf die ${dominoValueLabel(variant.playOn!, language)}. Was sind die neuen offenen Enden?`
        : language === "en"
          ? `The other end is ${dominoValueLabel(variant.otherEnd!, language)}. You play ${dominoTileLabel(variant.playedTile!, language)} on the ${dominoValueLabel(variant.playOn!, language)} end. What are the new open ends?`
          : `El otro extremo es ${dominoValueLabel(variant.otherEnd!, language)}. Juegas ${dominoTileLabel(variant.playedTile!, language)} en el ${dominoValueLabel(variant.playOn!, language)}. Cuales son los nuevos extremos?`,
    hint: (_variant, language) =>
      language === "de"
        ? "Das alte andere Ende bleibt, und die freie Seite des neuen Steins wird offen."
        : language === "en"
          ? "The other old end stays, and the free side of the new tile becomes open."
          : "El otro extremo antiguo queda, y el lado libre de la ficha nueva queda abierto.",
    variants: [
      {
        suffix: "four-and-two",
        otherEnd: 4,
        playOn: 6,
        playedTile: [6, 2],
        textChoices: { en: ["four and two", "six and two", "four and six"], es: ["cuatro y dos", "seis y dos", "cuatro y seis"], de: ["vier und zwei", "sechs und zwei", "vier und sechs"] },
        answerText: { en: "four and two", es: "cuatro y dos", de: "vier und zwei" },
      },
      {
        suffix: "one-and-five",
        otherEnd: 1,
        playOn: 3,
        playedTile: [3, 5],
        textChoices: { en: ["one and five", "three and five", "one and three"], es: ["uno y cinco", "tres y cinco", "uno y tres"], de: ["eins und fuenf", "drei und fuenf", "eins und drei"] },
        answerText: { en: "one and five", es: "uno y cinco", de: "eins und fuenf" },
      },
      {
        suffix: "blank-and-six",
        otherEnd: 0,
        playOn: 2,
        playedTile: [2, 6],
        textChoices: { en: ["blank and six", "two and six", "blank and two"], es: ["blanca y seis", "dos y seis", "blanca y dos"], de: ["leer und sechs", "zwei und sechs", "leer und zwei"] },
        answerText: { en: "blank and six", es: "blanca y seis", de: "leer und sechs" },
      },
      {
        suffix: "five-and-one",
        otherEnd: 5,
        playOn: 4,
        playedTile: [4, 1],
        textChoices: { en: ["five and one", "four and one", "five and four"], es: ["cinco y uno", "cuatro y uno", "cinco y cuatro"], de: ["fuenf und eins", "vier und eins", "fuenf und vier"] },
        answerText: { en: "five and one", es: "cinco y uno", de: "fuenf und eins" },
      },
    ],
  },
];

const dominoesPuzzleBank: Record<SocialGameLanguage, SocialGameRound[]> = {
  en: buildDominoesPuzzleBank("en"),
  es: buildDominoesPuzzleBank("es"),
  de: buildDominoesPuzzleBank("de"),
  fr: buildExtraDominoesPuzzleBank("fr"),
  it: buildExtraDominoesPuzzleBank("it"),
  pt: buildExtraDominoesPuzzleBank("pt"),
};

const rounds: Record<SocialGameLanguage, SocialGameRound[]> = {
  en: [
    ...chessPuzzleBank.en,
    ...wordPuzzleBank.en,
    ...dominoesPuzzleBank.en,
    {
      id: "trivia-round",
      kind: "trivia",
      title: "Trivia",
      body: "Answer one cheerful question.",
      prompt: "Which classic board game uses rooks and bishops?",
      choices: ["Chess", "Dominoes", "Bingo"],
      answer: "Chess",
      hint: "It is played on black and white squares.",
      tags: ["games", "quiz", "trivia", "game:trivia"],
      estimatedDurationSeconds: 70,
      successMessage: "That was a clean answer. Trivia gives people an easy reason to talk.",
    },
  ],
  es: [
    ...chessPuzzleBank.es,
    ...wordPuzzleBank.es,
    ...dominoesPuzzleBank.es,
    {
      id: "trivia-round",
      kind: "trivia",
      title: "Trivia",
      body: "Responde una pregunta alegre.",
      prompt: "Que juego clasico usa torres y alfiles?",
      choices: ["Ajedrez", "Domino", "Bingo"],
      answer: "Ajedrez",
      hint: "Se juega en casillas claras y oscuras.",
      tags: ["games", "quiz", "trivia", "game:trivia"],
      estimatedDurationSeconds: 70,
      successMessage: "Respuesta clara. La trivia da una razon facil para hablar.",
    },
  ],
  de: [
    ...chessPuzzleBank.de,
    ...wordPuzzleBank.de,
    ...dominoesPuzzleBank.de,
    {
      id: "trivia-round",
      kind: "trivia",
      title: "Quiz",
      body: "Beantworte eine freundliche Frage.",
      prompt: "Welches klassische Spiel nutzt Tuerme und Laeufer?",
      choices: ["Schach", "Domino", "Bingo"],
      answer: "Schach",
      hint: "Es wird auf hellen und dunklen Feldern gespielt.",
      tags: ["games", "quiz", "trivia", "game:trivia"],
      estimatedDurationSeconds: 70,
      successMessage: "Klare Antwort. Quizfragen geben einen leichten Gespraechsanfang.",
    },
  ],
  fr: [
    ...chessPuzzleBank.fr,
    ...wordPuzzleBank.fr,
    ...dominoesPuzzleBank.fr,
    {
      id: "trivia-round",
      kind: "trivia",
      title: "Quiz",
      body: "Reponds a une question joyeuse.",
      prompt: "Quel jeu classique utilise des tours et des fous?",
      choices: ["Echecs", "Dominos", "Bingo"],
      answer: "Echecs",
      hint: "Il se joue sur des cases claires et foncees.",
      tags: ["games", "quiz", "trivia", "game:trivia"],
      estimatedDurationSeconds: 70,
      successMessage: "Reponse claire. Le quiz donne une raison simple de parler.",
    },
  ],
  it: [
    ...chessPuzzleBank.it,
    ...wordPuzzleBank.it,
    ...dominoesPuzzleBank.it,
    {
      id: "trivia-round",
      kind: "trivia",
      title: "Quiz",
      body: "Rispondi a una domanda allegra.",
      prompt: "Quale gioco classico usa torri e alfieri?",
      choices: ["Scacchi", "Domino", "Bingo"],
      answer: "Scacchi",
      hint: "Si gioca su case chiare e scure.",
      tags: ["games", "quiz", "trivia", "game:trivia"],
      estimatedDurationSeconds: 70,
      successMessage: "Risposta chiara. Il quiz offre un motivo facile per parlare.",
    },
  ],
  pt: [
    ...chessPuzzleBank.pt,
    ...wordPuzzleBank.pt,
    ...dominoesPuzzleBank.pt,
    {
      id: "trivia-round",
      kind: "trivia",
      title: "Perguntas",
      body: "Responda uma pergunta alegre.",
      prompt: "Que jogo classico usa torres e bispos?",
      choices: ["Xadrez", "Domino", "Bingo"],
      answer: "Xadrez",
      hint: "Ele e jogado em casas claras e escuras.",
      tags: ["games", "quiz", "trivia", "game:trivia"],
      estimatedDurationSeconds: 70,
      successMessage: "Resposta clara. Perguntas dao uma razao facil para conversar.",
    },
  ],
};

export const socialGameKinds: SocialGameKind[] = ["chess", "word", "dominoes", "trivia"];

export function isSocialGameKind(value: unknown): value is SocialGameKind {
  return typeof value === "string" && socialGameKinds.includes(value as SocialGameKind);
}

export function buildGamePreferenceTag(kind: SocialGameKind) {
  return `game:${kind}`;
}

export function labelForGameKind(kind: SocialGameKind, language: SocialLanguage) {
  return gameKindLabels[kind][language] ?? gameKindLabels[kind].en;
}

const gameTableCopy: Record<SocialGameLanguage, Omit<SocialGameTable, "readyLabel" | "rounds" | "defaultRoundId" | "readyMembers"> & { readyLabel: (count: number) => string }> = {
  es: {
    hostLine: "Viktor guia rondas clasicas y breves.",
    tableLabel: "Mesa de hoy",
    readyLabel: (count) => `${count} personas listas`,
    chooseRoundLabel: "Elige una ronda",
    connectionTitle: "Encuentra compania para jugar",
    connectionBody: "VYVA solo busca personas que aceptaron ser visibles. Los datos de contacto siguen privados.",
    startRoundLabel: "Empezar ronda",
    completeRoundLabel: "Terminar ronda",
    findPartnerLabel: "Buscar compania para jugar",
    sayHelloLabel: "Saludar",
    roundCompleteLabel: "Ronda completada",
  },
  en: {
    hostLine: "Viktor is hosting short classic rounds.",
    tableLabel: "Today's table",
    readyLabel: (count) => `${count} people ready`,
    chooseRoundLabel: "Choose a round",
    connectionTitle: "Find a playing partner",
    connectionBody: "VYVA only looks for people who opted in. Contact details stay private.",
    startRoundLabel: "Start round",
    completeRoundLabel: "Complete round",
    findPartnerLabel: "Find a playing partner",
    sayHelloLabel: "Say hello",
    roundCompleteLabel: "Round complete",
  },
  fr: {
    hostLine: "Viktor anime de courtes rondes classiques.",
    tableLabel: "Table du jour",
    readyLabel: (count) => `${count} personnes pretes`,
    chooseRoundLabel: "Choisir une ronde",
    connectionTitle: "Trouver un partenaire de jeu",
    connectionBody: "VYVA cherche seulement les personnes qui ont choisi d'etre visibles. Les coordonnees restent privees.",
    startRoundLabel: "Commencer la ronde",
    completeRoundLabel: "Terminer la ronde",
    findPartnerLabel: "Trouver un partenaire de jeu",
    sayHelloLabel: "Dire bonjour",
    roundCompleteLabel: "Ronde terminee",
  },
  de: {
    hostLine: "Viktor leitet kurze klassische Runden.",
    tableLabel: "Heutiger Tisch",
    readyLabel: (count) => `${count} Menschen bereit`,
    chooseRoundLabel: "Runde waehlen",
    connectionTitle: "Spielpartner finden",
    connectionBody: "VYVA sucht nur nach Menschen, die sichtbar sein moechten. Kontaktdaten bleiben privat.",
    startRoundLabel: "Runde starten",
    completeRoundLabel: "Runde abschliessen",
    findPartnerLabel: "Spielpartner suchen",
    sayHelloLabel: "Hallo sagen",
    roundCompleteLabel: "Runde geschafft",
  },
  it: {
    hostLine: "Viktor guida brevi turni classici.",
    tableLabel: "Tavolo di oggi",
    readyLabel: (count) => `${count} persone pronte`,
    chooseRoundLabel: "Scegli un turno",
    connectionTitle: "Trova un compagno di gioco",
    connectionBody: "VYVA cerca solo persone che hanno scelto di essere visibili. I contatti restano privati.",
    startRoundLabel: "Avvia turno",
    completeRoundLabel: "Completa turno",
    findPartnerLabel: "Trova un compagno di gioco",
    sayHelloLabel: "Saluta",
    roundCompleteLabel: "Turno completato",
  },
  pt: {
    hostLine: "Viktor conduz rodadas classicas e curtas.",
    tableLabel: "Mesa de hoje",
    readyLabel: (count) => `${count} pessoas prontas`,
    chooseRoundLabel: "Escolha uma rodada",
    connectionTitle: "Encontrar parceiro de jogo",
    connectionBody: "A VYVA procura apenas pessoas que optaram por aparecer. Os contatos continuam privados.",
    startRoundLabel: "Comecar rodada",
    completeRoundLabel: "Concluir rodada",
    findPartnerLabel: "Encontrar parceiro de jogo",
    sayHelloLabel: "Dizer ola",
    roundCompleteLabel: "Rodada concluida",
  },
};

export function buildGameTable(language: SocialGameLanguage, participantCount: number): SocialGameTable {
  const localizedRounds = rounds[language] ?? rounds.en;
  const localizedReadyMembers = readyMembers[language] ?? readyMembers.en;
  const readyCount = Math.max(3, Math.min(participantCount, 9));
  const copy = gameTableCopy[language] ?? gameTableCopy.en;

  return {
    hostLine: copy.hostLine,
    tableLabel: copy.tableLabel,
    readyLabel: copy.readyLabel(readyCount),
    chooseRoundLabel: copy.chooseRoundLabel,
    connectionTitle: copy.connectionTitle,
    connectionBody: copy.connectionBody,
    startRoundLabel: copy.startRoundLabel,
    completeRoundLabel: copy.completeRoundLabel,
    findPartnerLabel: copy.findPartnerLabel,
    sayHelloLabel: copy.sayHelloLabel,
    roundCompleteLabel: copy.roundCompleteLabel,
    rounds: localizedRounds,
    defaultRoundId: localizedRounds[0]?.id ?? "chess-clue-fork",
    readyMembers: localizedReadyMembers,
  };
}
