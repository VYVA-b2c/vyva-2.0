import type {
  SocialGameLanguage,
  SocialGameRound,
  SocialGameRoundInteraction,
  SocialGameRoundVisual,
} from "../../src/social/types";

type DominoValue = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type DominoTile = readonly [DominoValue, DominoValue];
type DominoEnd = "left" | "right";
type DominoActionKey = "drawOrPass" | "playAny" | "turnBoard";
type DominoCopy = Record<SocialGameLanguage, string>;

type DominoTableVariant = {
  suffix: string;
  openEnds: readonly [DominoValue, DominoValue];
  hand: DominoTile[];
  answerTile?: DominoTile;
  answerEnd?: DominoEnd;
  actionAnswer?: DominoActionKey;
  actionChoices?: DominoActionKey[];
  recentPass?: DominoValue;
  remainingTiles?: number;
  estimatedDurationSeconds?: number;
};

type DominoTableTheme = {
  id: string;
  tag: string;
  body: DominoCopy;
  prompt: DominoCopy;
  hint: DominoCopy;
  successMessage: DominoCopy;
  variants: DominoTableVariant[];
};

function copy(en: string, es: string, de: string, fr: string, it: string, pt: string): DominoCopy {
  return { en, es, de, fr, it, pt };
}

const dominoesRoundTitles: DominoCopy = {
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

const dominoEndLabels: Record<DominoEnd, DominoCopy> = {
  left: copy("left end", "extremo izquierdo", "linkes Ende", "bout gauche", "estremita sinistra", "ponta esquerda"),
  right: copy("right end", "extremo derecho", "rechtes Ende", "bout droit", "estremita destra", "ponta direita"),
};

const dominoHandLabels: DominoCopy = copy("Your hand", "Tu mano", "Deine Hand", "Ta main", "La tua mano", "Sua mao");

const dominoActionLabels: Record<DominoActionKey, DominoCopy> = {
  drawOrPass: copy(
    "Draw a tile or pass",
    "Robar una ficha o pasar",
    "Einen Stein ziehen oder passen",
    "Piocher une tuile ou passer",
    "Pescare una tessera o passare",
    "Comprar uma peca ou passar",
  ),
  playAny: copy(
    "Play any tile",
    "Jugar cualquier ficha",
    "Einen beliebigen Stein spielen",
    "Jouer n'importe quelle tuile",
    "Giocare qualsiasi tessera",
    "Jogar qualquer peca",
  ),
  turnBoard: copy(
    "Turn the board around",
    "Girar la mesa",
    "Den Tisch drehen",
    "Tourner la table",
    "Girare il tavolo",
    "Virar a mesa",
  ),
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

function dominoEndLabel(end: DominoEnd, language: SocialGameLanguage) {
  return dominoEndLabels[end][language];
}

function dominoActionLabel(action: DominoActionKey, language: SocialGameLanguage) {
  return dominoActionLabels[action][language];
}

function dominoOpenEndsPrompt(variant: DominoTableVariant, language: SocialGameLanguage) {
  const [leftEnd, rightEnd] = variant.openEnds;
  const left = dominoValueLabel(leftEnd, language);
  const right = dominoValueLabel(rightEnd, language);

  return copy(
    `Open ends: ${left} and ${right}.`,
    `Extremos abiertos: ${left} y ${right}.`,
    `Offene Enden: ${left} und ${right}.`,
    `Bouts ouverts: ${left} et ${right}.`,
    `Estremita aperte: ${left} e ${right}.`,
    `Pontas abertas: ${left} e ${right}.`,
  )[language];
}

function dominoPrompt(theme: DominoTableTheme, variant: DominoTableVariant, language: SocialGameLanguage) {
  return `${theme.prompt[language]} ${dominoOpenEndsPrompt(variant, language)}`;
}

function dominoPlayChoiceLabel(tile: DominoTile, language: SocialGameLanguage, end?: DominoEnd) {
  const tileLabel = dominoTileLabel(tile, language);
  if (!end) return tileLabel;

  if (language === "de") return `${tileLabel} auf ${dominoEndLabel(end, language)}`;
  if (language === "es") return `${tileLabel} en el ${dominoEndLabel(end, language)}`;
  if (language === "fr") return `${tileLabel} sur le ${dominoEndLabel(end, language)}`;
  if (language === "it") return `${tileLabel} sulla ${dominoEndLabel(end, language)}`;
  if (language === "pt") return `${tileLabel} na ${dominoEndLabel(end, language)}`;
  return `${tileLabel} on the ${dominoEndLabel(end, language)}`;
}

function textActionId(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function sameDominoTile(left: DominoTile | undefined, right: DominoTile | undefined) {
  if (!left || !right) return false;
  return (left[0] === right[0] && left[1] === right[1]) || (left[0] === right[1] && left[1] === right[0]);
}

function dominoVisualTile(tile: DominoTile): [number, number] {
  return [tile[0], tile[1]];
}

function dominoVisualTiles(tiles: DominoTile[]): Array<[number, number]> {
  return tiles.map(dominoVisualTile);
}

function nextDominoValue(value: DominoValue, offset: 1 | 2): DominoValue {
  return ((value + offset) % 7) as DominoValue;
}

function defaultLayoutTiles(openEnds: readonly [DominoValue, DominoValue]): DominoTile[] {
  const [leftEnd, rightEnd] = openEnds;
  return [
    [nextDominoValue(leftEnd, 1), leftEnd],
    [rightEnd, nextDominoValue(rightEnd, 2)],
  ];
}

function tactileInstruction(language: SocialGameLanguage) {
  return copy(
    "Tap a tile from your hand.",
    "Toca una ficha de tu mano.",
    "Tippe auf einen Stein aus deiner Hand.",
    "Touche une tuile de ta main.",
    "Tocca una tessera dalla tua mano.",
    "Toque numa peca da sua mao.",
  )[language];
}

function roundExplanation(hint: string, language: SocialGameLanguage) {
  if (language === "fr") return `Pourquoi cela marche: ${hint}`;
  if (language === "it") return `Perche funziona: ${hint}`;
  if (language === "pt") return `Por que funciona: ${hint}`;
  if (language === "de") return `Warum es passt: ${hint}`;
  if (language === "es") return `Por que funciona: ${hint}`;
  return `Why this works: ${hint}`;
}

function tableTalkPrompt(language: SocialGameLanguage) {
  return copy(
    "Ask who learned dominoes at home or with friends.",
    "Pregunta quien aprendio domino en casa o con amigos.",
    "Frag, wer Domino zu Hause oder mit Freunden gelernt hat.",
    "Demande qui a appris les dominos a la maison ou avec des amis.",
    "Chiedi chi ha imparato il domino in casa o con amici.",
    "Pergunte quem aprendeu domino em casa ou com amigos.",
  )[language];
}

function buildChoices(variant: DominoTableVariant, language: SocialGameLanguage) {
  if (!variant.answerTile) {
    return (variant.actionChoices ?? ["drawOrPass", "playAny", "turnBoard"]).map((action) => dominoActionLabel(action, language));
  }

  if (!variant.answerEnd) return variant.hand.map((tile) => dominoTileLabel(tile, language));

  const otherEnd: DominoEnd = variant.answerEnd === "left" ? "right" : "left";
  return [
    dominoPlayChoiceLabel(variant.answerTile, language, variant.answerEnd),
    dominoPlayChoiceLabel(variant.answerTile, language, otherEnd),
    ...variant.hand
      .filter((tile) => !sameDominoTile(tile, variant.answerTile))
      .map((tile) => dominoPlayChoiceLabel(tile, language)),
  ].slice(0, 3);
}

function buildAnswer(variant: DominoTableVariant, language: SocialGameLanguage) {
  if (variant.answerTile) return dominoPlayChoiceLabel(variant.answerTile, language, variant.answerEnd);
  return dominoActionLabel(variant.actionAnswer ?? "drawOrPass", language);
}

function buildVisual(variant: DominoTableVariant, caption: string, language: SocialGameLanguage): SocialGameRoundVisual {
  const [leftEnd, rightEnd] = variant.openEnds;

  return {
    kind: "dominoes",
    caption,
    openEnds: [leftEnd, rightEnd],
    leftEnd,
    rightEnd,
    hand: dominoVisualTiles(variant.hand),
    handLabel: dominoHandLabels[language],
    layoutTiles: dominoVisualTiles(defaultLayoutTiles(variant.openEnds)),
    focusTile: variant.answerTile ? dominoVisualTile(variant.answerTile) : undefined,
    recentPass: variant.recentPass,
    remainingTiles: variant.remainingTiles,
    endChoices: variant.answerEnd ? ["left", "right"] : undefined,
  };
}

function buildInteraction(
  variant: DominoTableVariant,
  choices: string[],
  answer: string,
  language: SocialGameLanguage,
): SocialGameRoundInteraction {
  if (!variant.answerTile) {
    return {
      kind: "dominoPlay",
      instruction: tactileInstruction(language),
      actions: choices.map((choice) => ({ id: textActionId(choice), label: choice })),
      answerActionId: textActionId(answer),
    };
  }

  return {
    kind: "dominoPlay",
    instruction: tactileInstruction(language),
    answerTile: dominoVisualTile(variant.answerTile),
    candidateTiles: dominoVisualTiles(variant.hand),
    answerEnd: variant.answerEnd ? variant.openEnds[variant.answerEnd === "left" ? 0 : 1] : undefined,
    answerEndSide: variant.answerEnd,
    candidateEnds: variant.answerEnd ? ["left", "right"] : undefined,
  };
}

function play(
  suffix: string,
  openEnds: readonly [DominoValue, DominoValue],
  hand: DominoTile[],
  answerTile: DominoTile,
  options: Partial<Omit<DominoTableVariant, "suffix" | "openEnds" | "hand" | "answerTile">> = {},
): DominoTableVariant {
  return { suffix, openEnds, hand, answerTile, ...options };
}

function act(
  suffix: string,
  openEnds: readonly [DominoValue, DominoValue],
  hand: DominoTile[],
  actionAnswer: DominoActionKey,
  options: Partial<Omit<DominoTableVariant, "suffix" | "openEnds" | "hand" | "actionAnswer">> = {},
): DominoTableVariant {
  return {
    suffix,
    openEnds,
    hand,
    actionAnswer,
    actionChoices: ["drawOrPass", "playAny", "turnBoard"],
    ...options,
  };
}

const dominoTableThemes: DominoTableTheme[] = [
  {
    id: "domino-table-next-move",
    tag: "next-move",
    body: copy("Plan the next turn.", "Planea el siguiente turno.", "Plane den naechsten Zug.", "Prepare le prochain tour.", "Prepara il prossimo turno.", "Planeje a proxima rodada."),
    prompt: copy("Find the play that leaves another move ready.", "Encuentra la jugada que deja otra ficha preparada.", "Finde den Zug, der noch einen Zug vorbereitet.", "Trouve le coup qui prepare une autre tuile.", "Trova la giocata che prepara un'altra tessera.", "Encontre a jogada que prepara outra peca."),
    hint: copy("After the tile lands, look for the new open number in your hand.", "Despues de jugar, busca el nuevo numero abierto en tu mano.", "Nach dem Legen suchst du die neue offene Zahl in deiner Hand.", "Apres la pose, cherche le nouveau nombre ouvert dans ta main.", "Dopo la posa, cerca il nuovo numero aperto nella tua mano.", "Depois da jogada, procure o novo numero aberto na sua mao."),
    successMessage: copy("Good table sense. You left yourself a useful number.", "Buena lectura de mesa. Te dejaste un numero util.", "Gutes Tischgefuehl. Du hast dir eine nuetzliche Zahl gelassen.", "Bonne lecture de table. Tu gardes une suite possible.", "Buona lettura del tavolo. Hai preparato una prossima mossa.", "Boa leitura da mesa. Voce deixou uma proxima jogada viva."),
    variants: [
      play("six-four", [6, 2], [[6, 4], [2, 3], [5, 1], [4, 0]], [6, 4], { recentPass: 5, remainingTiles: 4 }),
      play("two-five", [2, 6], [[2, 5], [6, 1], [3, 4], [5, 0]], [2, 5], { remainingTiles: 4 }),
      play("blank-three", [0, 5], [[0, 3], [5, 6], [1, 2], [3, 4]], [0, 3], { recentPass: 6 }),
      play("four-one", [4, 2], [[4, 1], [2, 6], [3, 0], [1, 5]], [4, 1], { remainingTiles: 3 }),
    ],
  },
  {
    id: "domino-table-read-pass",
    tag: "read-pass",
    body: copy("Read a recent pass.", "Lee un pase reciente.", "Lies ein aktuelles Passen.", "Lis une passe recente.", "Leggi un passo recente.", "Leia uma passada recente."),
    prompt: copy("Someone just passed. Choose the quiet play.", "Alguien acaba de pasar. Elige la jugada tranquila.", "Jemand hat gerade gepasst. Waehle den ruhigen Zug.", "Quelqu'un vient de passer. Choisis le coup calme.", "Qualcuno ha appena passato. Scegli la giocata calma.", "Alguem acabou de passar. Escolha a jogada calma."),
    hint: copy("A recent pass is a clue about a number the next player may not hold.", "Un pase reciente da una pista sobre un numero que quizas no tengan.", "Ein aktuelles Passen verraet, welche Zahl vielleicht fehlt.", "Une passe recente indique un nombre qui manque peut-etre.", "Un passo recente mostra un numero che forse manca.", "Uma passada recente mostra um numero que talvez falte."),
    successMessage: copy("Thoughtful play. You noticed what the table just told you.", "Jugada atenta. Has visto lo que la mesa acaba de decir.", "Aufmerksam gespielt. Du hast gehoert, was der Tisch gerade sagt.", "Jeu attentif. Tu as lu ce que la table venait de dire.", "Giocata attenta. Hai letto quello che il tavolo diceva.", "Jogada atenta. Voce leu o que a mesa acabou de dizer."),
    variants: [
      play("pass-five", [5, 3], [[5, 6], [3, 2], [3, 5], [6, 4]], [3, 2], { recentPass: 5 }),
      play("pass-blank", [0, 4], [[0, 6], [4, 2], [4, 0], [2, 5]], [4, 2], { recentPass: 0 }),
      play("pass-six", [6, 1], [[6, 5], [1, 3], [1, 6], [3, 4]], [1, 3], { recentPass: 6 }),
      play("pass-two", [2, 5], [[2, 4], [5, 1], [5, 2], [4, 6]], [5, 1], { recentPass: 2 }),
    ],
  },
  {
    id: "domino-table-choose-end",
    tag: "choose-end",
    body: copy("Choose the better end.", "Elige el mejor extremo.", "Waehle das bessere Ende.", "Choisis le meilleur bout.", "Scegli l'estremita migliore.", "Escolha a melhor ponta."),
    prompt: copy("The tile fits both sides. Pick the wiser side.", "La ficha encaja en ambos lados. Escoge el lado mas sabio.", "Der Stein passt links und rechts. Waehle die kluegere Seite.", "La tuile va des deux cotes. Choisis le cote le plus sage.", "La tessera entra da entrambi i lati. Scegli il lato piu saggio.", "A peca cabe dos dois lados. Escolha o lado mais esperto."),
    hint: copy("Try the end that leaves a number you can use again.", "Prueba el extremo que deja un numero que puedas volver a usar.", "Nimm das Ende, das dir wieder eine passende Zahl laesst.", "Essaie le bout qui laisse un nombre encore utile.", "Prova il lato che lascia un numero ancora utile.", "Use a ponta que deixa um numero ainda util."),
    successMessage: copy("Nice. The same tile can tell two different stories.", "Bien. La misma ficha puede contar dos historias.", "Schoen. Derselbe Stein kann zwei Geschichten erzaehlen.", "Bien. La meme tuile peut raconter deux histoires.", "Bene. La stessa tessera puo raccontare due storie.", "Boa. A mesma peca pode contar duas historias."),
    variants: [
      play("six-two", [6, 2], [[6, 2], [6, 4], [5, 1], [3, 0]], [6, 2], { answerEnd: "right" }),
      play("five-one", [5, 1], [[5, 1], [1, 4], [6, 3], [4, 0]], [5, 1], { answerEnd: "left" }),
      play("blank-four", [0, 4], [[0, 4], [4, 6], [2, 5], [1, 1]], [0, 4], { answerEnd: "left" }),
      play("three-six", [3, 6], [[3, 6], [6, 1], [5, 2], [0, 4]], [3, 6], { answerEnd: "left" }),
    ],
  },
  {
    id: "domino-table-set-double",
    tag: "set-double",
    body: copy("Set up a double.", "Prepara un doble.", "Bereite ein Doppel vor.", "Prepare un double.", "Prepara un doppio.", "Prepare um duplo."),
    prompt: copy("Find the play that prepares your double.", "Encuentra la jugada que prepara tu doble.", "Finde den Zug, der dein Doppel vorbereitet.", "Trouve le coup qui prepare ton double.", "Trova la giocata che prepara il tuo doppio.", "Encontre a jogada que prepara seu duplo."),
    hint: copy("Leave the number that matches the double in your hand.", "Deja el numero que coincide con el doble de tu mano.", "Lass die Zahl offen, die zu deinem Doppel passt.", "Laisse le nombre qui correspond au double dans ta main.", "Lascia il numero che corrisponde al doppio in mano.", "Deixe o numero que combina com o duplo na sua mao."),
    successMessage: copy("Good patience. The double becomes stronger on the next turn.", "Buena paciencia. El doble gana fuerza en el siguiente turno.", "Gute Geduld. Das Doppel wird im naechsten Zug staerker.", "Bonne patience. Le double devient plus fort au tour suivant.", "Buona pazienza. Il doppio diventa piu forte al prossimo turno.", "Boa paciencia. O duplo fica mais forte na proxima rodada."),
    variants: [
      play("six-double", [4, 1], [[4, 6], [6, 6], [1, 3], [2, 5]], [4, 6]),
      play("three-double", [5, 2], [[2, 3], [3, 3], [5, 6], [1, 4]], [2, 3]),
      play("blank-double", [6, 1], [[1, 0], [0, 0], [6, 2], [4, 5]], [1, 0]),
      play("five-double", [3, 4], [[4, 5], [5, 5], [3, 1], [2, 6]], [4, 5]),
    ],
  },
  {
    id: "domino-table-heavy-safe",
    tag: "heavy-safe",
    body: copy("Lighten the hand safely.", "Aligera la mano con calma.", "Erleichtere deine Hand sicher.", "Allege ta main sans risque.", "Alleggerisci la mano con calma.", "Alivie a mao com calma."),
    prompt: copy("One heavy tile is useful and still calm.", "Una ficha pesada ayuda y sigue siendo tranquila.", "Ein hoher Stein hilft und bleibt ruhig.", "Une grosse tuile aide et reste calme.", "Una tessera pesante aiuta senza agitare.", "Uma peca pesada ajuda sem agitar."),
    hint: copy("Compare the large tiles, then notice what number they leave.", "Compara las fichas grandes y mira que numero dejan.", "Vergleiche die hohen Steine und beachte die neue Zahl.", "Compare les grosses tuiles puis regarde le nombre laisse.", "Confronta le tessere alte e guarda il numero lasciato.", "Compare as pecas altas e veja que numero deixam."),
    successMessage: copy("Smart. You lowered the hand without opening trouble.", "Bien pensado. Bajaste puntos sin abrir problemas.", "Klug. Du hast Punkte abgegeben, ohne Aerger zu oeffnen.", "Bien vu. Tu allege la main sans ouvrir de souci.", "Ben visto. Hai alleggerito senza aprire guai.", "Esperto. Voce aliviou a mao sem abrir problema."),
    variants: [
      play("six-five", [5, 2], [[5, 6], [2, 4], [5, 1], [3, 0]], [5, 6], { recentPass: 4 }),
      play("six-four", [6, 1], [[6, 4], [1, 2], [6, 0], [3, 3]], [6, 4], { recentPass: 2 }),
      play("five-four", [4, 0], [[4, 5], [0, 2], [4, 1], [6, 6]], [4, 5], { recentPass: 1 }),
      play("six-three", [3, 5], [[3, 6], [5, 2], [3, 0], [4, 4]], [3, 6], { recentPass: 2 }),
    ],
  },
  {
    id: "domino-table-endgame-route",
    tag: "endgame-route",
    body: copy("See the way out.", "Ve la salida.", "Sieh den Ausweg.", "Vois la sortie.", "Vedi l'uscita.", "Veja a saida."),
    prompt: copy("Two tiles remain. Find the route home.", "Quedan dos fichas. Encuentra la ruta final.", "Zwei Steine bleiben. Finde den Weg nach Hause.", "Deux tuiles restent. Trouve la route finale.", "Restano due tessere. Trova la strada finale.", "Restam duas pecas. Encontre o caminho final."),
    hint: copy("Play the first tile so the last tile has a matching end.", "Juega primero la ficha que da entrada a la ultima.", "Lege zuerst den Stein, der dem letzten Stein ein Ende gibt.", "Joue d'abord la tuile qui ouvre la derniere.", "Gioca prima la tessera che apre l'ultima.", "Jogue primeiro a peca que abre caminho para a ultima."),
    successMessage: copy("That is endgame thinking: one play prepares the finish.", "Eso es pensar el final: una jugada prepara el cierre.", "Das ist Endspiel-Denken: Ein Zug bereitet das Ende vor.", "C'est penser la fin: un coup prepare la sortie.", "Questo e pensiero finale: una giocata prepara l'uscita.", "Isso e pensar no fim: uma jogada prepara a saida."),
    variants: [
      play("three-one", [3, 6], [[3, 1], [1, 6], [4, 5], [2, 2]], [3, 1], { answerEnd: "left", remainingTiles: 2 }),
      play("blank-five", [0, 2], [[0, 5], [5, 2], [3, 4], [6, 6]], [0, 5], { answerEnd: "left", remainingTiles: 2 }),
      play("four-six", [4, 1], [[4, 6], [6, 1], [2, 3], [5, 5]], [4, 6], { answerEnd: "left", remainingTiles: 2 }),
      play("two-blank", [2, 5], [[2, 0], [0, 5], [1, 3], [6, 6]], [2, 0], { answerEnd: "left", remainingTiles: 2 }),
    ],
  },
  {
    id: "domino-table-low-risk",
    tag: "low-risk",
    body: copy("Calm a heavy table.", "Calma una mesa pesada.", "Beruhige einen schweren Tisch.", "Calme une table lourde.", "Calma un tavolo pesante.", "Acalme uma mesa pesada."),
    prompt: copy("Find the softer landing.", "Encuentra la jugada mas suave.", "Finde die sanftere Landung.", "Trouve l'atterrissage plus doux.", "Trova l'atterraggio piu morbido.", "Encontre a jogada mais suave."),
    hint: copy("A small new number can make the next turn less sharp.", "Un numero nuevo pequeno puede suavizar el siguiente turno.", "Eine kleine neue Zahl kann den naechsten Zug beruhigen.", "Un petit nouveau nombre peut calmer le tour suivant.", "Un numero nuovo piccolo puo calmare il turno seguente.", "Um numero novo baixo pode suavizar a proxima rodada."),
    successMessage: copy("Soft landing. You changed the pace of the table.", "Suave. Cambiaste el ritmo de la mesa.", "Sanft gelandet. Du hast das Tempo veraendert.", "Atterrissage doux. Tu as change le rythme.", "Atterraggio morbido. Hai cambiato il ritmo.", "Pouso suave. Voce mudou o ritmo da mesa."),
    variants: [
      play("six-one", [6, 4], [[6, 1], [4, 5], [6, 3], [2, 2]], [6, 1]),
      play("five-blank", [5, 3], [[5, 0], [3, 4], [5, 6], [1, 1]], [5, 0]),
      play("four-one", [4, 6], [[4, 1], [6, 5], [4, 3], [0, 0]], [4, 1]),
      play("three-blank", [3, 5], [[3, 0], [5, 6], [3, 2], [1, 1]], [3, 0]),
    ],
  },
  {
    id: "domino-table-no-fit",
    tag: "no-fit",
    body: copy("When nothing fits.", "Cuando nada encaja.", "Wenn nichts passt.", "Quand rien ne va.", "Quando niente entra.", "Quando nada encaixa."),
    prompt: copy("Read the hand before touching a tile.", "Lee la mano antes de tocar una ficha.", "Lies die Hand, bevor du einen Stein beruehrst.", "Lis la main avant de toucher une tuile.", "Leggi la mano prima di toccare una tessera.", "Leia a mao antes de tocar numa peca."),
    hint: copy("If no tile matches either open end, use the table rule for drawing or passing.", "Si ninguna ficha coincide con un extremo, usa la regla de robar o pasar.", "Wenn kein Stein an ein Ende passt, gilt Ziehen oder Passen.", "Si aucune tuile ne correspond, on pioche ou on passe selon la table.", "Se nessuna tessera combacia, si pesca o si passa.", "Se nenhuma peca combina, compre ou passe pela regra da mesa."),
    successMessage: copy("Right. Not playing is sometimes the honest table move.", "Correcto. A veces no jugar es la jugada honesta.", "Richtig. Nicht zu legen ist manchmal der ehrliche Zug.", "Exact. Ne pas jouer est parfois le bon geste.", "Giusto. A volte non giocare e la mossa onesta.", "Certo. As vezes nao jogar e a jogada honesta."),
    variants: [
      act("ends-two-six", [2, 6], [[1, 3], [4, 5], [0, 0], [1, 4]], "drawOrPass"),
      act("ends-blank-five", [0, 5], [[1, 2], [3, 4], [6, 6], [2, 3]], "drawOrPass"),
      act("ends-one-four", [1, 4], [[2, 3], [5, 6], [0, 0], [2, 5]], "drawOrPass"),
      act("ends-three-six", [3, 6], [[0, 1], [2, 4], [5, 5], [0, 2]], "drawOrPass"),
    ],
  },
  {
    id: "domino-table-twin-ends",
    tag: "twin-ends",
    body: copy("Shape the table.", "Da forma a la mesa.", "Forme den Tisch.", "Donne forme a la table.", "Dai forma al tavolo.", "De forma a mesa."),
    prompt: copy("A single play can make both ends match.", "Una jugada puede igualar los dos extremos.", "Ein Zug kann beide Enden gleich machen.", "Un coup peut rendre les deux bouts pareils.", "Una giocata puo rendere uguali le estremita.", "Uma jogada pode igualar as duas pontas."),
    hint: copy("Use the tile on the side that turns the new open number into the other open number.", "Usa la ficha por el lado que iguala el nuevo numero con el otro extremo.", "Lege den Stein so, dass die neue offene Zahl zur anderen passt.", "Pose la tuile du cote qui rejoint l'autre nombre ouvert.", "Gioca la tessera dal lato che raggiunge l'altro numero aperto.", "Jogue a peca na ponta que iguala o outro numero aberto."),
    successMessage: copy("Nice pattern. Matching ends are easy for everyone to read.", "Buen patron. Los extremos iguales son faciles para todos.", "Schoenes Muster. Gleiche Enden liest jeder leicht.", "Joli motif. Des bouts egaux sont faciles a lire.", "Bel motivo. Estremita uguali sono facili da leggere.", "Bom padrao. Pontas iguais sao faceis de ler."),
    variants: [
      play("six-three", [3, 6], [[6, 3], [3, 1], [6, 2], [4, 5]], [6, 3], { answerEnd: "right" }),
      play("five-one", [1, 5], [[5, 1], [1, 4], [5, 6], [0, 2]], [5, 1], { answerEnd: "right" }),
      play("four-blank", [0, 4], [[4, 0], [0, 2], [4, 6], [1, 3]], [4, 0], { answerEnd: "right" }),
      play("two-six", [6, 2], [[2, 6], [6, 1], [2, 3], [5, 5]], [2, 6], { answerEnd: "right" }),
    ],
  },
  {
    id: "domino-table-rescue-hand",
    tag: "rescue-hand",
    body: copy("Do not strand the hand.", "No dejes la mano aislada.", "Lass deine Hand nicht stranden.", "Ne bloque pas ta main.", "Non isolare la mano.", "Nao deixe a mao presa."),
    prompt: copy("One play leaves the rest connected.", "Una jugada deja el resto conectado.", "Ein Zug haelt den Rest verbunden.", "Un coup garde le reste relie.", "Una giocata tiene collegato il resto.", "Uma jogada deixa o resto conectado."),
    hint: copy("Look for the new number that appears on another tile you hold.", "Busca el nuevo numero que aparece en otra ficha tuya.", "Suche die neue Zahl auf einem weiteren Stein.", "Cherche le nouveau nombre sur une autre tuile.", "Cerca il nuovo numero su un'altra tessera.", "Procure o novo numero em outra peca sua."),
    successMessage: copy("Good rescue. Your hand still has a path.", "Buen rescate. Tu mano aun tiene camino.", "Gut gerettet. Deine Hand hat noch einen Weg.", "Bon sauvetage. Ta main a encore une route.", "Bel salvataggio. La tua mano ha ancora strada.", "Bom resgate. Sua mao ainda tem caminho."),
    variants: [
      play("five-four", [5, 1], [[5, 4], [4, 6], [1, 2], [3, 3]], [5, 4]),
      play("two-six", [2, 4], [[2, 6], [6, 1], [4, 5], [0, 0]], [2, 6]),
      play("blank-five", [0, 3], [[0, 5], [5, 2], [3, 6], [1, 1]], [0, 5]),
      play("one-four", [1, 6], [[1, 4], [4, 2], [6, 5], [0, 0]], [1, 4]),
    ],
  },
  {
    id: "domino-table-blank-control",
    tag: "blank-control",
    body: copy("Use blanks with care.", "Usa las blancas con cuidado.", "Nutze Leerfelder mit Sorgfalt.", "Utilise les blancs avec soin.", "Usa i vuoti con cura.", "Use brancos com cuidado."),
    prompt: copy("The blank side matters here.", "La blanca importa aqui.", "Die leere Seite zaehlt hier.", "Le blanc compte ici.", "Il vuoto conta qui.", "O branco importa aqui."),
    hint: copy("A blank can be powerful when it connects to another tile in your hand.", "Una blanca vale mas si conecta con otra ficha tuya.", "Leer ist stark, wenn es zu einem weiteren Stein fuehrt.", "Un blanc est fort s'il mene a une autre tuile.", "Un vuoto e forte se porta a un'altra tessera.", "Um branco e forte quando liga outra peca sua."),
    successMessage: copy("Good eye. Blanks can quietly steer the table.", "Buena vista. Las blancas pueden guiar la mesa.", "Gut gesehen. Leere Seiten lenken den Tisch leise.", "Bien vu. Les blancs guident la table doucement.", "Buon occhio. I vuoti guidano il tavolo piano.", "Boa vista. Brancos guiam a mesa em silencio."),
    variants: [
      play("four-two", [0, 4], [[4, 2], [2, 5], [0, 6], [1, 1]], [4, 2]),
      play("blank-three", [3, 5], [[3, 0], [0, 2], [5, 6], [1, 4]], [3, 0]),
      play("six-blank", [6, 1], [[6, 0], [0, 4], [1, 5], [2, 2]], [6, 0]),
      play("blank-one", [0, 2], [[0, 1], [1, 6], [2, 4], [3, 3]], [0, 1]),
    ],
  },
  {
    id: "domino-table-double-purpose",
    tag: "double-purpose",
    body: copy("Play a double with purpose.", "Juega un doble con sentido.", "Spiele ein Doppel mit Sinn.", "Joue un double utile.", "Gioca un doppio con senso.", "Jogue um duplo com sentido."),
    prompt: copy("A double helps only if the table is ready.", "Un doble ayuda solo si la mesa esta lista.", "Ein Doppel hilft nur, wenn der Tisch bereit ist.", "Un double aide si la table est prete.", "Un doppio aiuta se il tavolo e pronto.", "Um duplo ajuda se a mesa esta pronta."),
    hint: copy("The useful double leaves a number you still control.", "El doble util deja un numero que aun controlas.", "Das nuetzliche Doppel laesst dir eine passende Zahl.", "Le double utile laisse un nombre que tu controles.", "Il doppio utile lascia un numero che controlli.", "O duplo util deixa um numero que voce controla."),
    successMessage: copy("Nicely timed. Doubles feel best when they serve the hand.", "Buen momento. Los dobles van mejor cuando sirven a la mano.", "Gut getimt. Doppel passen am besten mit Plan.", "Bon moment. Les doubles servent mieux la main.", "Bel tempo. I doppi funzionano quando servono la mano.", "Bom momento. Duplos funcionam quando servem a mao."),
    variants: [
      play("double-two", [2, 5], [[2, 2], [2, 6], [5, 1], [3, 4]], [2, 2]),
      play("double-five", [5, 1], [[5, 5], [5, 3], [1, 6], [0, 2]], [5, 5]),
      play("double-blank", [0, 4], [[0, 0], [0, 6], [4, 2], [1, 3]], [0, 0]),
      play("double-three", [3, 6], [[3, 3], [3, 1], [6, 4], [2, 5]], [3, 3]),
    ],
  },
  {
    id: "domino-table-neighbor-short",
    tag: "neighbor-short",
    body: copy("A neighbor is nearly out.", "Alguien casi termina.", "Ein Nachbar ist fast fertig.", "Un voisin sort bientot.", "Qualcuno sta per chiudere.", "Alguem esta quase saindo."),
    prompt: copy("One tile makes the finish less easy.", "Una ficha dificulta un poco el cierre.", "Ein Stein macht das Ende weniger leicht.", "Une tuile rend la sortie moins facile.", "Una tessera rende la chiusura meno facile.", "Uma peca torna a saida menos facil."),
    hint: copy("When someone has one tile left, notice the number they seemed to want.", "Si alguien tiene una ficha, mira que numero parecia buscar.", "Bei einem letzten Stein zaehlt, welche Zahl gesucht wurde.", "Avec une tuile restante, lis le nombre attendu.", "Con una tessera rimasta, leggi il numero cercato.", "Com uma peca restante, veja o numero que parecia querer."),
    successMessage: copy("Careful defense. You made the table work a little harder.", "Defensa cuidadosa. Hiciste trabajar un poco mas a la mesa.", "Sorgfaeltige Abwehr. Du machst es dem Tisch schwerer.", "Defense douce. Tu rends la sortie moins simple.", "Difesa attenta. Hai reso il finale meno semplice.", "Defesa cuidadosa. Voce deixou a saida menos simples."),
    variants: [
      play("block-four", [4, 6], [[4, 2], [6, 4], [6, 1], [2, 5]], [6, 1], { recentPass: 4, remainingTiles: 1 }),
      play("block-six", [6, 2], [[6, 3], [2, 6], [2, 1], [3, 5]], [2, 1], { recentPass: 6, remainingTiles: 1 }),
      play("block-blank", [0, 5], [[0, 2], [5, 0], [5, 3], [1, 4]], [5, 3], { recentPass: 0, remainingTiles: 1 }),
      play("block-three", [3, 1], [[3, 5], [1, 3], [1, 6], [5, 0]], [1, 6], { recentPass: 3, remainingTiles: 1 }),
    ],
  },
  {
    id: "domino-table-chain",
    tag: "two-move-chain",
    body: copy("Build a two-move chain.", "Construye una cadena de dos jugadas.", "Baue eine Zwei-Zug-Kette.", "Construis une chaine de deux coups.", "Costruisci una catena di due mosse.", "Monte uma cadeia de duas jogadas."),
    prompt: copy("Find the first tile in the little chain.", "Encuentra la primera ficha de la cadena.", "Finde den ersten Stein der kleinen Kette.", "Trouve la premiere tuile de la petite chaine.", "Trova la prima tessera della piccola catena.", "Encontre a primeira peca da pequena cadeia."),
    hint: copy("The first tile should open the number on the second tile.", "La primera ficha debe abrir el numero de la segunda.", "Der erste Stein soll die Zahl des zweiten oeffnen.", "La premiere tuile doit ouvrir le nombre de la seconde.", "La prima tessera deve aprire il numero della seconda.", "A primeira peca deve abrir o numero da segunda."),
    successMessage: copy("Nice sequence. Dominoes has small plans inside it.", "Buena secuencia. El domino tiene pequenos planes.", "Schoene Folge. Domino hat kleine Plaene.", "Belle sequence. Les dominos cachent de petits plans.", "Bella sequenza. Il domino ha piccoli piani.", "Boa sequencia. Domino tem pequenos planos."),
    variants: [
      play("five-two", [5, 6], [[5, 2], [2, 4], [6, 1], [3, 3]], [5, 2]),
      play("one-four", [1, 3], [[1, 4], [4, 6], [3, 0], [5, 5]], [1, 4]),
      play("six-blank", [6, 2], [[6, 0], [0, 5], [2, 3], [1, 1]], [6, 0]),
      play("three-five", [3, 4], [[3, 5], [5, 1], [4, 6], [2, 2]], [3, 5]),
    ],
  },
  {
    id: "domino-table-balance",
    tag: "balance",
    body: copy("Balance the table.", "Equilibra la mesa.", "Halte den Tisch im Gleichgewicht.", "Equilibre la table.", "Equilibra il tavolo.", "Equilibre a mesa."),
    prompt: copy("Choose the play that gives the table a steady shape.", "Elige la jugada que deja una forma estable.", "Waehle den Zug, der den Tisch ruhig formt.", "Choisis le coup qui donne une forme stable.", "Scegli la giocata che da una forma stabile.", "Escolha a jogada que da forma estavel."),
    hint: copy("A steady table leaves two open numbers that are easy to read.", "Una mesa estable deja dos numeros faciles de leer.", "Ein ruhiger Tisch laesst zwei klare offene Zahlen.", "Une table stable laisse deux nombres faciles a lire.", "Un tavolo stabile lascia due numeri facili da leggere.", "Uma mesa estavel deixa dois numeros faceis de ler."),
    successMessage: copy("Good balance. The table stays clear.", "Buen equilibrio. La mesa queda clara.", "Gutes Gleichgewicht. Der Tisch bleibt klar.", "Bon equilibre. La table reste claire.", "Buon equilibrio. Il tavolo resta chiaro.", "Bom equilibrio. A mesa fica clara."),
    variants: [
      play("two-five", [2, 6], [[2, 5], [6, 4], [2, 1], [3, 3]], [2, 5]),
      play("four-one", [4, 5], [[4, 1], [5, 6], [4, 3], [0, 0]], [4, 1]),
      play("blank-six", [0, 3], [[0, 6], [3, 5], [0, 2], [1, 1]], [0, 6]),
      play("three-two", [3, 4], [[3, 2], [4, 6], [3, 1], [5, 5]], [3, 2]),
    ],
  },
  {
    id: "domino-table-pass-back",
    tag: "pass-back",
    body: copy("Turn a pass into pressure.", "Convierte un pase en presion.", "Mach aus Passen Druck.", "Transforme une passe en pression.", "Trasforma un passo in pressione.", "Transforme uma passada em pressao."),
    prompt: copy("The pass gives you a quiet chance.", "El pase te da una oportunidad tranquila.", "Das Passen gibt dir eine stille Chance.", "La passe donne une chance calme.", "Il passo offre una possibilita calma.", "A passada da uma chance calma."),
    hint: copy("Use the open end that sends the table away from the passed number.", "Usa el extremo que aleja la mesa del numero del pase.", "Nutze das Ende, das vom gepassten Wert wegfuehrt.", "Utilise le bout qui eloigne du nombre passe.", "Usa il lato che allontana dal numero passato.", "Use a ponta que afasta do numero passado."),
    successMessage: copy("Quiet pressure. You used information, not speed.", "Presion tranquila. Usaste informacion, no prisa.", "Leiser Druck. Du nutzt Information, nicht Tempo.", "Pression douce. Tu utilises l'information.", "Pressione calma. Hai usato informazione.", "Pressao calma. Voce usou informacao."),
    variants: [
      play("six-two", [6, 2], [[6, 2], [2, 4], [6, 5], [1, 1]], [6, 2], { answerEnd: "left", recentPass: 2 }),
      play("five-blank", [5, 0], [[5, 0], [0, 3], [5, 4], [2, 2]], [5, 0], { answerEnd: "left", recentPass: 0 }),
      play("one-three", [1, 3], [[1, 3], [3, 6], [1, 4], [0, 0]], [1, 3], { answerEnd: "left", recentPass: 3 }),
      play("four-six", [4, 6], [[4, 6], [6, 2], [4, 5], [1, 1]], [4, 6], { answerEnd: "left", recentPass: 6 }),
    ],
  },
  {
    id: "domino-table-number-control",
    tag: "number-control",
    body: copy("Use your strong number.", "Usa tu numero fuerte.", "Nutze deine starke Zahl.", "Utilise ton nombre fort.", "Usa il tuo numero forte.", "Use seu numero forte."),
    prompt: copy("Your hand has a favorite number.", "Tu mano tiene un numero favorito.", "Deine Hand hat eine Lieblingszahl.", "Ta main a un nombre prefere.", "La tua mano ha un numero preferito.", "Sua mao tem um numero favorito."),
    hint: copy("Choose a play that leaves the number appearing again in your hand.", "Elige una jugada que deja un numero repetido en tu mano.", "Waehle einen Zug, dessen neue Zahl wieder in deiner Hand steht.", "Choisis un coup dont le nouveau nombre revient dans ta main.", "Scegli una giocata con un numero che ritorna in mano.", "Escolha uma jogada cujo numero aparece de novo na mao."),
    successMessage: copy("Good control. You played toward the shape of your hand.", "Buen control. Jugaste hacia la forma de tu mano.", "Gute Kontrolle. Du spielst zur Form deiner Hand.", "Bon controle. Tu joues vers la forme de ta main.", "Buon controllo. Hai giocato verso la forma della mano.", "Bom controle. Voce jogou pela forma da mao."),
    variants: [
      play("many-fives", [2, 6], [[2, 5], [5, 3], [5, 1], [6, 4]], [2, 5]),
      play("many-threes", [4, 1], [[4, 3], [3, 6], [3, 0], [1, 5]], [4, 3]),
      play("many-sixes", [0, 2], [[2, 6], [6, 1], [6, 5], [0, 4]], [2, 6]),
      play("many-ones", [5, 3], [[3, 1], [1, 4], [1, 6], [5, 2]], [3, 1]),
    ],
  },
  {
    id: "domino-table-close-round",
    tag: "close-round",
    body: copy("Near the end of the hand.", "Cerca del final de la mano.", "Nahe am Ende der Hand.", "Pres de la fin de la main.", "Vicino alla fine della mano.", "Perto do fim da mao."),
    prompt: copy("Find the play that leaves fewer loose points.", "Encuentra la jugada que deja menos puntos sueltos.", "Finde den Zug mit weniger losen Punkten.", "Trouve le coup qui laisse moins de points libres.", "Trova la giocata con meno punti sciolti.", "Encontre a jogada que deixa menos pontos soltos."),
    hint: copy("Late in a hand, a useful heavy tile can reduce what remains.", "Al final, una ficha pesada util reduce lo que queda.", "Spaet in der Hand hilft ein hoher passender Stein.", "En fin de main, une grosse tuile utile allege le reste.", "A fine mano, una tessera alta utile alleggerisce.", "No fim, uma peca alta util reduz o que sobra."),
    successMessage: copy("Good finish sense. You made the ending lighter.", "Buena lectura final. Hiciste el cierre mas ligero.", "Gutes Endgefuehl. Du machst das Ende leichter.", "Bon sens de fin. Tu allege la sortie.", "Buon senso finale. Hai alleggerito la chiusura.", "Boa leitura final. Voce deixou o fim mais leve."),
    variants: [
      play("four-six", [4, 2], [[4, 6], [2, 0], [6, 6], [1, 3]], [4, 6], { remainingTiles: 3 }),
      play("five-six", [5, 1], [[5, 6], [1, 0], [6, 4], [2, 2]], [5, 6], { remainingTiles: 3 }),
      play("three-five", [3, 0], [[3, 5], [0, 2], [5, 6], [1, 1]], [3, 5], { remainingTiles: 3 }),
      play("two-six", [2, 4], [[2, 6], [4, 0], [6, 5], [1, 1]], [2, 6], { remainingTiles: 3 }),
    ],
  },
  {
    id: "domino-table-flexible-tile",
    tag: "flexible",
    body: copy("Find the flexible tile.", "Encuentra la ficha flexible.", "Finde den flexiblen Stein.", "Trouve la tuile flexible.", "Trova la tessera flessibile.", "Encontre a peca flexivel."),
    prompt: copy("One tile gives the table more room.", "Una ficha da mas espacio a la mesa.", "Ein Stein gibt dem Tisch mehr Raum.", "Une tuile donne plus d'espace.", "Una tessera da piu spazio al tavolo.", "Uma peca da mais espaco a mesa."),
    hint: copy("The flexible tile touches both open numbers.", "La ficha flexible toca los dos numeros abiertos.", "Der flexible Stein beruehrt beide offenen Zahlen.", "La tuile flexible touche les deux nombres ouverts.", "La tessera flessibile tocca entrambi i numeri aperti.", "A peca flexivel toca os dois numeros abertos."),
    successMessage: copy("Flexible play. The table has options.", "Jugada flexible. La mesa tiene opciones.", "Flexibel gespielt. Der Tisch hat Optionen.", "Jeu flexible. La table respire.", "Giocata flessibile. Il tavolo ha opzioni.", "Jogada flexivel. A mesa tem opcoes."),
    variants: [
      play("two-five", [2, 5], [[2, 5], [2, 3], [4, 5], [1, 1]], [2, 5]),
      play("blank-six", [0, 6], [[0, 6], [0, 3], [6, 2], [5, 5]], [0, 6]),
      play("one-four", [1, 4], [[1, 4], [1, 6], [3, 4], [2, 2]], [1, 4]),
      play("three-five", [3, 5], [[3, 5], [3, 0], [2, 5], [6, 6]], [3, 5]),
    ],
  },
  {
    id: "domino-table-corner-choice",
    tag: "corner-choice",
    body: copy("Choose the corner.", "Elige la esquina.", "Waehle die Ecke.", "Choisis le coin.", "Scegli l'angolo.", "Escolha o canto."),
    prompt: copy("The same tile changes the table depending on the end.", "La misma ficha cambia la mesa segun el extremo.", "Derselbe Stein aendert den Tisch je nach Ende.", "La meme tuile change la table selon le cote.", "La stessa tessera cambia il tavolo secondo il lato.", "A mesma peca muda a mesa conforme a ponta."),
    hint: copy("After choosing the tile, choose the side that feeds your hand.", "Despues de elegir ficha, escoge el lado que alimenta tu mano.", "Nach dem Stein waehlst du die Seite, die deine Hand fuettert.", "Apres la tuile, choisis le cote qui nourrit ta main.", "Dopo la tessera, scegli il lato che nutre la mano.", "Depois da peca, escolha a ponta que alimenta sua mao."),
    successMessage: copy("Good corner choice. You saw the table after the play.", "Buena esquina. Viste la mesa despues de jugar.", "Gute Ecke. Du siehst den Tisch nach dem Zug.", "Bon coin. Tu vois la table apres le coup.", "Buon angolo. Hai visto il tavolo dopo la giocata.", "Bom canto. Voce viu a mesa depois da jogada."),
    variants: [
      play("four-one", [4, 1], [[4, 1], [4, 6], [2, 5], [0, 0]], [4, 1], { answerEnd: "right" }),
      play("two-five", [2, 5], [[2, 5], [5, 6], [1, 3], [0, 0]], [2, 5], { answerEnd: "left" }),
      play("blank-six", [0, 6], [[0, 6], [6, 3], [1, 4], [2, 2]], [0, 6], { answerEnd: "left" }),
      play("three-one", [3, 1], [[3, 1], [1, 5], [6, 2], [4, 4]], [3, 1], { answerEnd: "left" }),
    ],
  },
  {
    id: "domino-table-open-space",
    tag: "open-space",
    body: copy("Open space for the table.", "Abre espacio para la mesa.", "Oeffne Raum fuer den Tisch.", "Ouvre de l'espace.", "Apri spazio al tavolo.", "Abra espaco para a mesa."),
    prompt: copy("Find the play that helps the round breathe.", "Encuentra la jugada que deja respirar la ronda.", "Finde den Zug, der die Runde atmen laesst.", "Trouve le coup qui laisse respirer la ronde.", "Trova la giocata che lascia respirare il giro.", "Encontre a jogada que deixa a rodada respirar."),
    hint: copy("A round breathes when the new number appears in more than one hand tile.", "La ronda respira si el nuevo numero aparece en mas de una ficha.", "Die Runde atmet, wenn die neue Zahl mehrfach in deiner Hand steht.", "La ronde respire si le nouveau nombre revient dans ta main.", "Il giro respira se il nuovo numero ritorna nella mano.", "A rodada respira quando o novo numero volta na mao."),
    successMessage: copy("Open table. You made the next choices easier to see.", "Mesa abierta. Hiciste mas claras las siguientes opciones.", "Offener Tisch. Die naechsten Optionen sind klarer.", "Table ouverte. Les choix suivants sont plus clairs.", "Tavolo aperto. Le prossime scelte sono piu chiare.", "Mesa aberta. As proximas escolhas ficam claras."),
    variants: [
      play("one-six", [1, 4], [[1, 6], [6, 2], [6, 5], [4, 0]], [1, 6]),
      play("three-blank", [3, 5], [[3, 0], [0, 2], [0, 6], [5, 1]], [3, 0]),
      play("two-four", [2, 6], [[2, 4], [4, 1], [4, 5], [6, 0]], [2, 4]),
      play("five-three", [5, 1], [[5, 3], [3, 2], [3, 6], [1, 0]], [5, 3]),
    ],
  },
  {
    id: "domino-table-table-read",
    tag: "table-read",
    body: copy("Read the whole table.", "Lee toda la mesa.", "Lies den ganzen Tisch.", "Lis toute la table.", "Leggi tutto il tavolo.", "Leia a mesa inteira."),
    prompt: copy("The best play uses more than one clue.", "La mejor jugada usa mas de una pista.", "Der beste Zug nutzt mehr als einen Hinweis.", "Le meilleur coup utilise plusieurs indices.", "La giocata migliore usa piu indizi.", "A melhor jogada usa mais de uma pista."),
    hint: copy("Use the open ends, the pass clue, and the shape of your hand together.", "Usa juntos los extremos, el pase y la forma de tu mano.", "Nutze offene Enden, Passen und Handform zusammen.", "Utilise les bouts, la passe et la forme de ta main.", "Usa insieme estremita, passo e forma della mano.", "Use pontas, passada e forma da mao juntos."),
    successMessage: copy("Sharp table reading. You combined the clues.", "Buena lectura. Combinaste las pistas.", "Starke Tischsicht. Du verbindest die Hinweise.", "Belle lecture. Tu combines les indices.", "Bella lettura. Hai combinato gli indizi.", "Boa leitura. Voce juntou as pistas."),
    variants: [
      play("six-one", [6, 3], [[6, 1], [1, 4], [3, 5], [6, 3]], [6, 1], { recentPass: 5 }),
      play("five-two", [5, 0], [[5, 2], [2, 6], [0, 4], [5, 0]], [5, 2], { recentPass: 4 }),
      play("four-blank", [4, 2], [[4, 0], [0, 3], [2, 6], [4, 2]], [4, 0], { recentPass: 6 }),
      play("three-six", [3, 1], [[3, 6], [6, 5], [1, 4], [3, 1]], [3, 6], { recentPass: 4 }),
    ],
  },
  {
    id: "domino-table-soft-block",
    tag: "soft-block",
    body: copy("Block without drama.", "Bloquea sin drama.", "Blocke ohne Drama.", "Bloque sans drame.", "Blocca senza dramma.", "Bloqueie sem drama."),
    prompt: copy("Find the calm block.", "Encuentra el bloqueo tranquilo.", "Finde die ruhige Blockade.", "Trouve le blocage calme.", "Trova il blocco tranquillo.", "Encontre o bloqueio calmo."),
    hint: copy("A calm block changes the new number without breaking your own hand.", "Un bloqueo tranquilo cambia el numero sin romper tu mano.", "Eine ruhige Blockade aendert die Zahl und haelt deine Hand lebendig.", "Un blocage calme change le nombre sans casser ta main.", "Un blocco calmo cambia numero senza rompere la mano.", "Um bloqueio calmo muda o numero sem quebrar sua mao."),
    successMessage: copy("Gentle defense. Still friendly, still smart.", "Defensa suave. Amable y lista.", "Sanfte Abwehr. Freundlich und klug.", "Defense douce. Amicale et maligne.", "Difesa gentile. Cordiale e intelligente.", "Defesa suave. Amigavel e esperta."),
    variants: [
      play("one-six", [1, 3], [[1, 6], [6, 4], [3, 6], [5, 5]], [1, 6], { recentPass: 3 }),
      play("two-five", [2, 4], [[2, 5], [5, 1], [4, 5], [6, 6]], [2, 5], { recentPass: 4 }),
      play("blank-three", [0, 6], [[0, 3], [3, 2], [6, 3], [1, 1]], [0, 3], { recentPass: 6 }),
      play("four-one", [4, 5], [[4, 1], [1, 6], [5, 1], [2, 2]], [4, 1], { recentPass: 5 }),
    ],
  },
  {
    id: "domino-table-last-two",
    tag: "last-two",
    body: copy("Last two tiles.", "Ultimas dos fichas.", "Letzte zwei Steine.", "Deux dernieres tuiles.", "Ultime due tessere.", "Ultimas duas pecas."),
    prompt: copy("Order matters now.", "Ahora importa el orden.", "Jetzt zaehlt die Reihenfolge.", "L'ordre compte maintenant.", "Ora conta l'ordine.", "Agora a ordem importa."),
    hint: copy("The first tile should open the number on the second tile.", "La primera debe abrir el numero de la segunda.", "Der erste Stein soll die Zahl des zweiten oeffnen.", "La premiere doit ouvrir le nombre de la seconde.", "La prima deve aprire il numero della seconda.", "A primeira deve abrir o numero da segunda."),
    successMessage: copy("Good order. You can picture the finish.", "Buen orden. Puedes imaginar el final.", "Gute Reihenfolge. Du siehst das Ende.", "Bon ordre. Tu imagines la sortie.", "Buon ordine. Vedi la chiusura.", "Boa ordem. Voce imagina a saida."),
    variants: [
      play("six-four", [6, 2], [[6, 4], [4, 2], [1, 3], [5, 5]], [6, 4], { remainingTiles: 2 }),
      play("five-one", [5, 3], [[5, 1], [1, 3], [2, 4], [6, 6]], [5, 1], { remainingTiles: 2 }),
      play("blank-six", [0, 4], [[0, 6], [6, 4], [1, 2], [3, 3]], [0, 6], { remainingTiles: 2 }),
      play("three-two", [3, 5], [[3, 2], [2, 5], [1, 4], [6, 6]], [3, 2], { remainingTiles: 2 }),
    ],
  },
  {
    id: "domino-table-choice-pressure",
    tag: "choice-pressure",
    body: copy("A choice under pressure.", "Una decision con presion.", "Eine Wahl unter Druck.", "Un choix sous pression.", "Una scelta sotto pressione.", "Uma escolha sob pressao."),
    prompt: copy("Take the steady play.", "Toma la jugada firme.", "Nimm den stabilen Zug.", "Prends le coup stable.", "Prendi la giocata stabile.", "Escolha a jogada firme."),
    hint: copy("The steady play helps your hand and does not feed the pass clue.", "La jugada firme ayuda a tu mano y no alimenta el pase.", "Der stabile Zug hilft deiner Hand und nicht dem Pass-Hinweis.", "Le coup stable aide ta main et pas l'indice de passe.", "La giocata stabile aiuta la mano e non il passo.", "A jogada firme ajuda sua mao e nao a pista da passada."),
    successMessage: copy("Steady choice. No rush, just a better table.", "Decision firme. Sin prisa, solo mejor mesa.", "Stabile Wahl. Keine Eile, nur besserer Tisch.", "Choix stable. Pas de hate, meilleure table.", "Scelta stabile. Nessuna fretta, tavolo migliore.", "Escolha firme. Sem pressa, mesa melhor."),
    variants: [
      play("two-six", [2, 5], [[2, 6], [6, 4], [5, 6], [1, 1]], [2, 6], { recentPass: 5 }),
      play("four-blank", [4, 1], [[4, 0], [0, 2], [1, 0], [6, 6]], [4, 0], { recentPass: 1 }),
      play("three-five", [3, 6], [[3, 5], [5, 1], [6, 5], [2, 2]], [3, 5], { recentPass: 6 }),
      play("five-one", [5, 2], [[5, 1], [1, 4], [2, 1], [0, 0]], [5, 1], { recentPass: 2 }),
    ],
  },
  {
    id: "domino-table-table-memory",
    tag: "table-memory",
    body: copy("Remember the table.", "Recuerda la mesa.", "Merke dir den Tisch.", "Souviens-toi de la table.", "Ricorda il tavolo.", "Lembre da mesa."),
    prompt: copy("A small memory clue changes the play.", "Una pequena pista de memoria cambia la jugada.", "Ein kleiner Merkhilfe-Hinweis aendert den Zug.", "Un petit souvenir change le coup.", "Un piccolo ricordo cambia la giocata.", "Uma pequena memoria muda a jogada."),
    hint: copy("The recent pass and your matching follow-up point to the calm tile.", "El pase reciente y tu continuacion senalan la ficha tranquila.", "Passen und Anschlussstein zeigen den ruhigen Zug.", "La passe et ta suite indiquent la tuile calme.", "Il passo e la continuazione indicano la tessera calma.", "A passada e sua continuacao apontam a peca calma."),
    successMessage: copy("Good memory. Dominoes rewards noticing small things.", "Buena memoria. El domino premia notar detalles.", "Gutes Gedaechtnis. Domino belohnt kleine Beobachtungen.", "Bonne memoire. Les dominos recompensent les details.", "Buona memoria. Il domino premia i dettagli.", "Boa memoria. Domino recompensa pequenos detalhes."),
    variants: [
      play("six-three", [6, 0], [[6, 3], [3, 4], [0, 5], [2, 2]], [6, 3], { recentPass: 5 }),
      play("one-five", [1, 4], [[1, 5], [5, 2], [4, 6], [0, 0]], [1, 5], { recentPass: 6 }),
      play("two-blank", [2, 5], [[2, 0], [0, 1], [5, 6], [3, 3]], [2, 0], { recentPass: 6 }),
      play("four-six", [4, 3], [[4, 6], [6, 1], [3, 5], [2, 2]], [4, 6], { recentPass: 5 }),
    ],
  },
  {
    id: "domino-table-friendly-pace",
    tag: "friendly-pace",
    body: copy("Set a friendly pace.", "Marca un ritmo amable.", "Setze ein freundliches Tempo.", "Donne un rythme amical.", "Dai un ritmo amichevole.", "Dite um ritmo amigavel."),
    prompt: copy("Choose the play that keeps the round flowing.", "Elige la jugada que mantiene la ronda en marcha.", "Waehle den Zug, der die Runde in Bewegung haelt.", "Choisis le coup qui garde la ronde fluide.", "Scegli la giocata che tiene il giro fluido.", "Escolha a jogada que mantem a rodada fluindo."),
    hint: copy("A flowing play is legal now and useful for your next turn.", "Una jugada fluida es legal ahora y util despues.", "Ein fluessiger Zug passt jetzt und spaeter.", "Un coup fluide marche maintenant et aide ensuite.", "Una giocata fluida vale ora e dopo.", "Uma jogada fluida serve agora e depois."),
    successMessage: copy("Friendly pace. The table can keep moving.", "Ritmo amable. La mesa puede seguir.", "Freundliches Tempo. Der Tisch bleibt in Bewegung.", "Rythme amical. La table continue.", "Ritmo amichevole. Il tavolo continua.", "Ritmo amigavel. A mesa continua."),
    variants: [
      play("blank-two", [0, 6], [[0, 2], [2, 5], [6, 4], [1, 1]], [0, 2]),
      play("three-one", [3, 5], [[3, 1], [1, 6], [5, 2], [4, 4]], [3, 1]),
      play("four-five", [4, 2], [[4, 5], [5, 0], [2, 6], [3, 3]], [4, 5]),
      play("six-one", [6, 0], [[6, 1], [1, 3], [0, 5], [2, 2]], [6, 1]),
    ],
  },
];

export function buildDominoTablePuzzleBank(language: SocialGameLanguage): SocialGameRound[] {
  return dominoTableThemes.slice(0, 20).flatMap((theme) =>
    theme.variants.map((variant) => {
      const choices = buildChoices(variant, language);
      const answer = buildAnswer(variant, language);
      const hint = theme.hint[language];

      return {
        id: `${theme.id}-${variant.suffix}`,
        kind: "dominoes" as const,
        title: dominoesRoundTitles[language],
        body: theme.body[language],
        prompt: dominoPrompt(theme, variant, language),
        choices,
        answer,
        hint,
        tags: ["games", "dominoes", "game:dominoes", `dominoes:${theme.tag}`],
        estimatedDurationSeconds: variant.estimatedDurationSeconds ?? 85,
        successMessage: theme.successMessage[language],
        visual: buildVisual(variant, theme.body[language], language),
        interaction: buildInteraction(variant, choices, answer, language),
        explanation: roundExplanation(hint, language),
        tableTalkPrompt: tableTalkPrompt(language),
      };
    }),
  );
}
