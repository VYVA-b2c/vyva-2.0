import type { LanguageCode } from "@/i18n/languages";

export const VISUAL_MEMORY_MAX_LEVEL = 40;

export type VisualMemoryBandId =
  | "foundation"
  | "explore"
  | "journeys"
  | "interests"
  | "shapes"
  | "patterns"
  | "precision"
  | "mastery";

export type VisualMemoryPatternShape = "circle" | "square" | "triangle" | "diamond" | "hexagon" | "star";
export type VisualMemoryPatternMotif = "solid" | "stripes" | "dots" | "grid" | "waves" | "split";

export type VisualMemoryVisual =
  | { kind: "emoji"; glyph: string }
  | {
      kind: "pattern";
      shape: VisualMemoryPatternShape;
      motif: VisualMemoryPatternMotif;
      foreground: string;
      secondary: string;
      background: string;
      rotation: number;
    };

export type VisualMemoryThemeItem = {
  id: string;
  labels: Record<LanguageCode, string>;
  visual: VisualMemoryVisual;
};

export type VisualMemoryTheme = {
  id: string;
  bandId: VisualMemoryBandId;
  titles: Record<LanguageCode, string>;
  prompts: Record<LanguageCode, string>;
  items: VisualMemoryThemeItem[];
};

type LocalizedTuple = [es: string, en: string, fr: string, de: string, it: string, pt: string];

const LANGUAGES: LanguageCode[] = ["es", "en", "fr", "de", "it", "pt"];

function localized(values: LocalizedTuple): Record<LanguageCode, string> {
  return LANGUAGES.reduce((result, language, index) => {
    result[language] = values[index];
    return result;
  }, {} as Record<LanguageCode, string>);
}

export const VISUAL_MEMORY_BANDS: Array<{
  id: VisualMemoryBandId;
  minLevel: number;
  maxLevel: number;
  labels: Record<LanguageCode, string>;
}> = [
  { id: "foundation", minLevel: 1, maxLevel: 5, labels: localized(["Base", "Foundation", "Base", "Grundlage", "Base", "Base"]) },
  { id: "explore", minLevel: 6, maxLevel: 10, labels: localized(["Explorar", "Explore", "Explorer", "Entdecken", "Esplora", "Explorar"]) },
  { id: "journeys", minLevel: 11, maxLevel: 15, labels: localized(["Viajes", "Journeys", "Voyages", "Reisen", "Viaggi", "Viagens"]) },
  { id: "interests", minLevel: 16, maxLevel: 20, labels: localized(["Aficiones", "Interests", "Loisirs", "Interessen", "Interessi", "Interesses"]) },
  { id: "shapes", minLevel: 21, maxLevel: 25, labels: localized(["Formas", "Shapes", "Formes", "Formen", "Forme", "Formas"]) },
  { id: "patterns", minLevel: 26, maxLevel: 30, labels: localized(["Patrones", "Patterns", "Motifs", "Muster", "Motivi", "Padrões"]) },
  { id: "precision", minLevel: 31, maxLevel: 35, labels: localized(["Precisión", "Precision", "Précision", "Präzision", "Precisione", "Precisão"]) },
  { id: "mastery", minLevel: 36, maxLevel: 40, labels: localized(["Maestría", "Mastery", "Maîtrise", "Meisterschaft", "Maestria", "Mestria"]) },
];

export function clampVisualMemoryLevel(level: number, fallback = 1) {
  const normalized = Number.isFinite(level) ? Math.round(level) : fallback;
  return Math.min(VISUAL_MEMORY_MAX_LEVEL, Math.max(1, normalized));
}

export function getVisualMemoryBand(level: number) {
  const safeLevel = clampVisualMemoryLevel(level);
  return VISUAL_MEMORY_BANDS.find((band) => safeLevel >= band.minLevel && safeLevel <= band.maxLevel) ?? VISUAL_MEMORY_BANDS[0];
}

export function getVisualMemoryProgressLabel(level: number, language: LanguageCode = "en") {
  const safeLevel = clampVisualMemoryLevel(level);
  const levelWords = localized(["Nivel", "Level", "Niveau", "Stufe", "Livello", "Nível"]);
  const ofWords = localized(["de", "of", "sur", "von", "di", "de"]);
  return `${levelWords[language]} ${safeLevel} ${ofWords[language]} ${VISUAL_MEMORY_MAX_LEVEL}`;
}

const PAIR_COUNTS = [3, 4, 4, 5, 5, 6, 6, 7, 7] as const;

function roundTo25(value: number) {
  return Math.round(value / 25) * 25;
}

export function getVisualMemoryDifficulty(level: number) {
  const safeLevel = clampVisualMemoryLevel(level);
  const progress = (safeLevel - 1) / (VISUAL_MEMORY_MAX_LEVEL - 1);
  return {
    pairCount: PAIR_COUNTS[safeLevel - 1] ?? 8,
    showLabels: safeLevel <= 10,
    mismatchRevealMs: roundTo25(1_100 - progress * 500),
    matchRevealMs: Math.max(300, roundTo25(500 - progress * 200)),
  };
}

function emojiTheme(
  id: string,
  bandId: VisualMemoryBandId,
  titles: LocalizedTuple,
  prompts: LocalizedTuple,
  glyphs: string[],
  itemLabels?: LocalizedTuple[],
): VisualMemoryTheme {
  const localizedTitles = localized(titles);
  return {
    id,
    bandId,
    titles: localizedTitles,
    prompts: localized(prompts),
    items: glyphs.map((glyph, index) => ({
      id: `${id}-${index + 1}`,
      labels: itemLabels?.[index]
        ? localized(itemLabels[index])
        : LANGUAGES.reduce((result, language) => {
            result[language] = `${localizedTitles[language]} ${index + 1}`;
            return result;
          }, {} as Record<LanguageCode, string>),
      visual: { kind: "emoji", glyph },
    })),
  };
}

const EMOJI_THEMES: VisualMemoryTheme[] = [
  emojiTheme("explore-garden", "explore", ["Jardín", "Garden", "Jardin", "Garten", "Giardino", "Jardim"], ["Encuentra las parejas del jardín.", "Match the garden pairs.", "Retrouvez les paires du jardin.", "Finde die Gartenpaare.", "Trova le coppie del giardino.", "Encontre os pares do jardim."], ["🌞", "🌷", "🌳", "🍃", "🐝", "🦋", "🐞", "🍄", "🌱", "🌹"], [
    ["sol", "sun", "soleil", "Sonne", "sole", "sol"], ["tulipán", "tulip", "tulipe", "Tulpe", "tulipano", "tulipa"], ["árbol", "tree", "arbre", "Baum", "albero", "árvore"], ["hoja", "leaf", "feuille", "Blatt", "foglia", "folha"], ["abeja", "bee", "abeille", "Biene", "ape", "abelha"], ["mariposa", "butterfly", "papillon", "Schmetterling", "farfalla", "borboleta"], ["mariquita", "ladybird", "coccinelle", "Marienkäfer", "coccinella", "joaninha"], ["seta", "mushroom", "champignon", "Pilz", "fungo", "cogumelo"], ["brote", "seedling", "pousse", "Keimling", "germoglio", "rebento"], ["rosa", "rose", "rose", "Rose", "rosa", "rosa"],
  ]),
  emojiTheme("explore-weather", "explore", ["Tiempo", "Weather", "Météo", "Wetter", "Meteo", "Tempo"], ["Encuentra las parejas del tiempo.", "Match the weather pairs.", "Retrouvez les paires météo.", "Finde die Wetterpaare.", "Trova le coppie del meteo.", "Encontre os pares do tempo."], ["☀️", "☁️", "🌧️", "❄️", "⚡", "🌈", "🌬️", "🌙", "☂️", "🌊"], [
    ["sol", "sun", "soleil", "Sonne", "sole", "sol"], ["nube", "cloud", "nuage", "Wolke", "nuvola", "nuvem"], ["lluvia", "rain", "pluie", "Regen", "pioggia", "chuva"], ["nieve", "snow", "neige", "Schnee", "neve", "neve"], ["rayo", "lightning", "éclair", "Blitz", "fulmine", "relâmpago"], ["arcoíris", "rainbow", "arc-en-ciel", "Regenbogen", "arcobaleno", "arco-íris"], ["viento", "wind", "vent", "Wind", "vento", "vento"], ["luna", "moon", "lune", "Mond", "luna", "lua"], ["paraguas", "umbrella", "parapluie", "Regenschirm", "ombrello", "guarda-chuva"], ["ola", "wave", "vague", "Welle", "onda", "onda"],
  ]),
  emojiTheme("explore-seaside", "explore", ["Costa", "Seaside", "Bord de mer", "Küste", "Mare", "Costa"], ["Encuentra las parejas de la costa.", "Match the seaside pairs.", "Retrouvez les paires du bord de mer.", "Finde die Küstenpaare.", "Trova le coppie del mare.", "Encontre os pares da costa."], ["🌊", "🐚", "🐟", "🦀", "⛵", "⚓", "🗼", "🏖️", "🐬", "☀️"], [
    ["ola", "wave", "vague", "Welle", "onda", "onda"], ["concha", "shell", "coquillage", "Muschel", "conchiglia", "concha"], ["pez", "fish", "poisson", "Fisch", "pesce", "peixe"], ["cangrejo", "crab", "crabe", "Krabbe", "granchio", "caranguejo"], ["velero", "sailboat", "voilier", "Segelboot", "barca a vela", "veleiro"], ["ancla", "anchor", "ancre", "Anker", "ancora", "âncora"], ["faro", "lighthouse", "phare", "Leuchtturm", "faro", "farol"], ["playa", "beach", "plage", "Strand", "spiaggia", "praia"], ["delfín", "dolphin", "dauphin", "Delfin", "delfino", "golfinho"], ["sol", "sun", "soleil", "Sonne", "sole", "sol"],
  ]),
  emojiTheme("explore-woodland", "explore", ["Bosque", "Woodland", "Forêt", "Wald", "Bosco", "Bosque"], ["Encuentra las parejas del bosque.", "Match the woodland pairs.", "Retrouvez les paires de la forêt.", "Finde die Waldpaare.", "Trova le coppie del bosco.", "Encontre os pares do bosque."], ["🌳", "🌲", "🍂", "🍄", "🦊", "🦉", "🦌", "🐇", "🌰", "🦔"], [
    ["árbol", "tree", "arbre", "Baum", "albero", "árvore"], ["pino", "pine tree", "pin", "Tanne", "pino", "pinheiro"], ["hojas", "leaves", "feuilles", "Blätter", "foglie", "folhas"], ["seta", "mushroom", "champignon", "Pilz", "fungo", "cogumelo"], ["zorro", "fox", "renard", "Fuchs", "volpe", "raposa"], ["búho", "owl", "hibou", "Eule", "gufo", "coruja"], ["ciervo", "deer", "cerf", "Hirsch", "cervo", "veado"], ["conejo", "rabbit", "lapin", "Kaninchen", "coniglio", "coelho"], ["castaña", "chestnut", "châtaigne", "Kastanie", "castagna", "castanha"], ["erizo", "hedgehog", "hérisson", "Igel", "riccio", "ouriço"],
  ]),
  emojiTheme("journeys-transport", "journeys", ["Transportes", "Transport", "Transports", "Verkehr", "Trasporti", "Transportes"], ["Empareja los medios de transporte.", "Match the transport symbols.", "Associez les transports.", "Ordne die Verkehrsmittel zu.", "Abbina i mezzi di trasporto.", "Combine os transportes."], ["🚗", "🚌", "🚲", "🚆", "✈️", "🚢", "🚕", "🚇", "🛵", "🚁"]),
  emojiTheme("journeys-places", "journeys", ["Lugares", "Places", "Lieux", "Orte", "Luoghi", "Lugares"], ["Empareja los lugares.", "Match the places.", "Associez les lieux.", "Ordne die Orte zu.", "Abbina i luoghi.", "Combine os lugares."], ["🏠", "🏥", "🏫", "🏛️", "🏨", "🏪", "🏰", "⛪", "🏟️", "🏭"]),
  emojiTheme("journeys-signs", "journeys", ["Señales", "Signs", "Panneaux", "Zeichen", "Segnali", "Sinais"], ["Empareja las señales.", "Match the signs.", "Associez les panneaux.", "Ordne die Zeichen zu.", "Abbina i segnali.", "Combine os sinais."], ["⬆️", "⬇️", "⬅️", "➡️", "↗️", "↘️", "⤴️", "⤵️", "⚠️", "🛑"]),
  emojiTheme("journeys-essentials", "journeys", ["Viaje", "Travel kit", "Voyage", "Reise", "Viaggio", "Viagem"], ["Empareja los objetos de viaje.", "Match the travel kit.", "Associez les objets de voyage.", "Ordne die Reisesachen zu.", "Abbina gli oggetti da viaggio.", "Combine os objetos de viagem."], ["🧳", "🗺️", "🧭", "🎫", "📷", "🔑", "👒", "🕶️", "☂️", "📱"]),
  emojiTheme("interests-music", "interests", ["Música", "Music", "Musique", "Musik", "Musica", "Música"], ["Empareja los símbolos musicales.", "Match the music symbols.", "Associez les symboles musicaux.", "Ordne die Musiksymbole zu.", "Abbina i simboli musicali.", "Combine os símbolos musicais."], ["🎵", "🎹", "🎸", "🎻", "🥁", "🎺", "🎷", "🪗", "🎤", "🎧"]),
  emojiTheme("interests-crafts", "interests", ["Manualidades", "Crafts", "Créations", "Handwerk", "Creatività", "Artesanato"], ["Empareja las manualidades.", "Match the craft symbols.", "Associez les créations.", "Ordne die Handwerkssymbole zu.", "Abbina i simboli creativi.", "Combine os símbolos de artesanato."], ["🧶", "🪡", "✂️", "🖌️", "🎨", "📏", "✏️", "🧵", "🪢", "🖼️"]),
  emojiTheme("interests-sport", "interests", ["Deportes", "Sports", "Sports", "Sport", "Sport", "Desportos"], ["Empareja los deportes.", "Match the sports symbols.", "Associez les sports.", "Ordne die Sportsymbole zu.", "Abbina i simboli sportivi.", "Combine os símbolos desportivos."], ["⚽", "🏀", "🎾", "🏓", "🏸", "⛳", "🎳", "🏊", "🚴", "🥾"]),
  emojiTheme("interests-celebration", "interests", ["Celebración", "Celebration", "Fête", "Feier", "Festa", "Celebração"], ["Empareja los símbolos de celebración.", "Match the celebration symbols.", "Associez les symboles de fête.", "Ordne die Festsymbole zu.", "Abbina i simboli della festa.", "Combine os símbolos de celebração."], ["🎂", "🎁", "🎈", "🎉", "🌟", "🕯️", "💐", "🎀", "🥳", "❤️"]),
];

const PATTERN_PALETTES = [
  ["#5B21B6", "#C4B5FD", "#F5F3FF"],
  ["#0F766E", "#5EEAD4", "#F0FDFA"],
  ["#B45309", "#FCD34D", "#FFFBEB"],
  ["#BE185D", "#F9A8D4", "#FDF2F8"],
  ["#1D4ED8", "#93C5FD", "#EFF6FF"],
  ["#166534", "#86EFAC", "#F0FDF4"],
] as const;
const PATTERN_SHAPES: VisualMemoryPatternShape[] = ["circle", "square", "triangle", "diamond", "hexagon", "star"];
const PATTERN_MOTIFS: VisualMemoryPatternMotif[] = ["solid", "stripes", "dots", "grid", "waves", "split"];

function patternTheme(
  id: string,
  bandId: VisualMemoryBandId,
  titles: LocalizedTuple,
  prompts: LocalizedTuple,
  seed: number,
): VisualMemoryTheme {
  const localizedTitles = localized(titles);
  return {
    id,
    bandId,
    titles: localizedTitles,
    prompts: localized(prompts),
    items: Array.from({ length: 12 }, (_, index) => {
      const palette = PATTERN_PALETTES[(index + seed) % PATTERN_PALETTES.length];
      const visual: VisualMemoryVisual = {
        kind: "pattern",
        shape: PATTERN_SHAPES[(index * 2 + seed) % PATTERN_SHAPES.length],
        motif: PATTERN_MOTIFS[(index + seed * 2) % PATTERN_MOTIFS.length],
        foreground: palette[0],
        secondary: palette[1],
        background: palette[2],
        rotation: ((index + seed) % 4) * 45,
      };
      return {
        id: `${id}-${index + 1}`,
        labels: LANGUAGES.reduce((result, language) => {
          result[language] = `${localizedTitles[language]} ${index + 1}`;
          return result;
        }, {} as Record<LanguageCode, string>),
        visual,
      };
    }),
  };
}

const PATTERN_THEMES: VisualMemoryTheme[] = [
  patternTheme("shapes-colour", "shapes", ["Color y forma", "Colour and shape", "Couleur et forme", "Farbe und Form", "Colore e forma", "Cor e forma"], ["Empareja colores y formas.", "Match colours and shapes.", "Associez couleurs et formes.", "Ordne Farben und Formen zu.", "Abbina colori e forme.", "Combine cores e formas."], 0),
  patternTheme("shapes-direction", "shapes", ["Direcciones", "Directions", "Directions", "Richtungen", "Direzioni", "Direções"], ["Empareja las direcciones.", "Match the directions.", "Associez les directions.", "Ordne die Richtungen zu.", "Abbina le direzioni.", "Combine as direções."], 1),
  patternTheme("shapes-symbol", "shapes", ["Símbolos", "Symbols", "Symboles", "Symbole", "Simboli", "Símbolos"], ["Empareja los símbolos.", "Match the symbols.", "Associez les symboles.", "Ordne die Symbole zu.", "Abbina i simboli.", "Combine os símbolos."], 2),
  patternTheme("shapes-silhouette", "shapes", ["Siluetas", "Silhouettes", "Silhouettes", "Silhouetten", "Sagome", "Silhuetas"], ["Empareja las siluetas.", "Match the silhouettes.", "Associez les silhouettes.", "Ordne die Silhouetten zu.", "Abbina le sagome.", "Combine as silhuetas."], 3),
  patternTheme("patterns-stripes", "patterns", ["Rayas", "Stripes", "Rayures", "Streifen", "Righe", "Riscas"], ["Empareja los patrones de rayas.", "Match the stripe patterns.", "Associez les rayures.", "Ordne die Streifenmuster zu.", "Abbina i motivi a righe.", "Combine os padrões de riscas."], 4),
  patternTheme("patterns-dots", "patterns", ["Puntos", "Dots", "Points", "Punkte", "Punti", "Pontos"], ["Empareja los patrones de puntos.", "Match the dot patterns.", "Associez les motifs à points.", "Ordne die Punktmuster zu.", "Abbina i motivi a punti.", "Combine os padrões de pontos."], 5),
  patternTheme("patterns-grid", "patterns", ["Cuadrículas", "Grids", "Grilles", "Gitter", "Griglie", "Grelhas"], ["Empareja las cuadrículas.", "Match the grids.", "Associez les grilles.", "Ordne die Gitter zu.", "Abbina le griglie.", "Combine as grelhas."], 6),
  patternTheme("patterns-waves", "patterns", ["Ondas", "Waves", "Vagues", "Wellen", "Onde", "Ondas"], ["Empareja los patrones de ondas.", "Match the wave patterns.", "Associez les vagues.", "Ordne die Wellenmuster zu.", "Abbina i motivi a onde.", "Combine os padrões de ondas."], 7),
  patternTheme("precision-tone", "precision", ["Tonos cercanos", "Close tones", "Tons proches", "Ähnliche Töne", "Toni simili", "Tons próximos"], ["Empareja los tonos con precisión.", "Match the close tones carefully.", "Associez précisément les tons proches.", "Ordne ähnliche Töne genau zu.", "Abbina con cura i toni simili.", "Combine cuidadosamente os tons próximos."], 8),
  patternTheme("precision-rotation", "precision", ["Giros", "Rotations", "Rotations", "Drehungen", "Rotazioni", "Rotações"], ["Empareja las formas giradas.", "Match the rotated forms.", "Associez les formes tournées.", "Ordne die gedrehten Formen zu.", "Abbina le forme ruotate.", "Combine as formas rodadas."], 9),
  patternTheme("precision-detail", "precision", ["Detalles", "Fine details", "Détails fins", "Feine Details", "Dettagli", "Detalhes"], ["Empareja los pequeños detalles.", "Match the fine details.", "Associez les petits détails.", "Ordne die feinen Details zu.", "Abbina i piccoli dettagli.", "Combine os pequenos detalhes."], 10),
  patternTheme("precision-compound", "precision", ["Combinaciones", "Combinations", "Combinaisons", "Kombinationen", "Combinazioni", "Combinações"], ["Empareja las combinaciones.", "Match the combinations.", "Associez les combinaisons.", "Ordne die Kombinationen zu.", "Abbina le combinazioni.", "Combine as combinações."], 11),
  patternTheme("mastery-mixed", "mastery", ["Mezcla visual", "Visual mix", "Mélange visuel", "Visueller Mix", "Mix visivo", "Mistura visual"], ["Empareja la mezcla de formas y patrones.", "Match the mixed shapes and patterns.", "Associez les formes et motifs mélangés.", "Ordne die gemischten Formen und Muster zu.", "Abbina forme e motivi misti.", "Combine formas e padrões mistos."], 12),
  patternTheme("mastery-contrast", "mastery", ["Contrastes", "Contrasts", "Contrastes", "Kontraste", "Contrasti", "Contrastes"], ["Empareja los contrastes.", "Match the contrasts.", "Associez les contrastes.", "Ordne die Kontraste zu.", "Abbina i contrasti.", "Combine os contrastes."], 13),
  patternTheme("mastery-layered", "mastery", ["Capas", "Layered forms", "Formes superposées", "Überlagerte Formen", "Forme sovrapposte", "Formas em camadas"], ["Empareja las formas por capas.", "Match the layered forms.", "Associez les formes superposées.", "Ordne die überlagerten Formen zu.", "Abbina le forme sovrapposte.", "Combine as formas em camadas."], 14),
  patternTheme("mastery-final", "mastery", ["Reto final", "Final challenge", "Défi final", "Finale Herausforderung", "Sfida finale", "Desafio final"], ["Completa el reto visual final.", "Complete the final visual challenge.", "Terminez le défi visuel final.", "Schließe die finale visuelle Herausforderung ab.", "Completa la sfida visiva finale.", "Complete o desafio visual final."], 15),
];

export const VISUAL_MEMORY_NEW_THEMES = [...EMOJI_THEMES, ...PATTERN_THEMES];
