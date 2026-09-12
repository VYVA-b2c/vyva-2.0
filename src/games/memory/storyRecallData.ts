import type { LanguageCode } from "@/i18n/languages";
import { BRAIN_COACH_MAX_LEVEL, getBrainCoachLevelBand } from "../shared/brainCoachProgression";
import type {
  MemoryGameLevel,
  MemoryGameVariantContent,
  StoryQuestionKind,
  StoryThemeId,
} from "./types";

export type StoryThemeDefinition = {
  id: StoryThemeId;
  label: Record<LanguageCode, string>;
  emoji: string;
  accent: string;
  surface: string;
  border: string;
  motif: string;
};

export type StoryRecallQuestion = {
  prompt: string;
  options: string[];
  answerIndex: number;
  kind: StoryQuestionKind;
};

export type StoryRecallPayload = {
  storyId: string;
  themeId: StoryThemeId;
  story: string;
  keyFacts: string[];
  choiceQuestions: StoryRecallQuestion[];
  levelBand: string;
  bandStep: number;
  retellMode: "guided" | "light" | "open";
  retellPrompts: string[];
  theme: Pick<StoryThemeDefinition, "emoji" | "accent" | "surface" | "border" | "motif">;
};

type Localized = Record<LanguageCode, string>;
type StoryScene = {
  id: string;
  themeId: StoryThemeId;
  person: string;
  location: Localized;
  activity: Localized;
  object: Localized;
  companion: string;
  time: Localized;
  detailA: Localized;
  detailB: Localized;
  ending: Localized;
};

const localized = (es: string, en: string, fr: string, de: string, it: string, pt: string): Localized => ({ es, en, fr, de, it, pt });

export const STORY_THEMES: StoryThemeDefinition[] = [
  { id: "home", label: localized("Hogar", "Home", "Maison", "Zuhause", "Casa", "Casa"), emoji: "🏡", accent: "#7A3E12", surface: "#FFF7ED", border: "#FED7AA", motif: "window" },
  { id: "nature", label: localized("Naturaleza", "Nature", "Nature", "Natur", "Natura", "Natureza"), emoji: "🌿", accent: "#166534", surface: "#F0FDF4", border: "#BBF7D0", motif: "leaves" },
  { id: "travel", label: localized("Viajes", "Travel", "Voyages", "Reisen", "Viaggi", "Viagens"), emoji: "🧳", accent: "#1D4ED8", surface: "#EFF6FF", border: "#BFDBFE", motif: "route" },
  { id: "food", label: localized("Comida", "Food", "Cuisine", "Essen", "Cucina", "Comida"), emoji: "🍲", accent: "#B45309", surface: "#FFFBEB", border: "#FDE68A", motif: "table" },
  { id: "hobbies", label: localized("Aficiones", "Hobbies", "Loisirs", "Hobbys", "Passatempi", "Passatempos"), emoji: "🎨", accent: "#7E22CE", surface: "#FAF5FF", border: "#E9D5FF", motif: "spark" },
  { id: "community", label: localized("Comunidad", "Community", "Communauté", "Gemeinschaft", "Comunità", "Comunidade"), emoji: "🤝", accent: "#0F766E", surface: "#F0FDFA", border: "#99F6E4", motif: "circle" },
  { id: "celebrations", label: localized("Celebraciones", "Celebrations", "Fêtes", "Feste", "Feste", "Celebrações"), emoji: "🎉", accent: "#BE185D", surface: "#FDF2F8", border: "#FBCFE8", motif: "confetti" },
  { id: "mystery", label: localized("Misterio amable", "Gentle mystery", "Mystère doux", "Sanftes Rätsel", "Mistero gentile", "Mistério leve"), emoji: "🔎", accent: "#4338CA", surface: "#EEF2FF", border: "#C7D2FE", motif: "clue" },
];

const scenes: StoryScene[] = [
  { id: "shelf", themeId: "home", person: "Mara", location: localized("el salón", "the sitting room", "le salon", "dem Wohnzimmer", "il soggiorno", "a sala"), activity: localized("ordenar una estantería", "organise a bookshelf", "ranger une bibliothèque", "ein Bücherregal ordnen", "riordinare una libreria", "organizar uma estante"), object: localized("una caja amarilla", "a yellow box", "une boîte jaune", "eine gelbe Schachtel", "una scatola gialla", "uma caixa amarela"), companion: "Leo", time: localized("después del desayuno", "after breakfast", "après le petit-déjeuner", "nach dem Frühstück", "dopo colazione", "depois do pequeno-almoço"), detailA: localized("las fotografías", "the photographs", "les photographies", "die Fotografien", "le fotografie", "as fotografias"), detailB: localized("los libros de viajes", "the travel books", "les livres de voyage", "die Reisebücher", "i libri di viaggio", "os livros de viagens"), ending: localized("tomar té junto a la ventana", "have tea by the window", "prendre le thé près de la fenêtre", "am Fenster Tee trinken", "bere il tè vicino alla finestra", "beber chá junto à janela") },
  { id: "balcony", themeId: "home", person: "Nora", location: localized("el balcón", "the balcony", "le balcon", "dem Balkon", "il balcone", "a varanda"), activity: localized("preparar un rincón de lectura", "prepare a reading corner", "préparer un coin lecture", "eine Leseecke vorbereiten", "preparare un angolo di lettura", "preparar um canto de leitura"), object: localized("una manta verde", "a green blanket", "une couverture verte", "eine grüne Decke", "una coperta verde", "uma manta verde"), companion: "Pablo", time: localized("al final de la tarde", "late in the afternoon", "en fin d'après-midi", "am späten Nachmittag", "nel tardo pomeriggio", "ao fim da tarde"), detailA: localized("dos cojines", "two cushions", "deux coussins", "zwei Kissen", "due cuscini", "duas almofadas"), detailB: localized("una lámpara pequeña", "a small lamp", "une petite lampe", "eine kleine Lampe", "una piccola lampada", "um pequeno candeeiro"), ending: localized("leer el primer capítulo", "read the first chapter", "lire le premier chapitre", "das erste Kapitel lesen", "leggere il primo capitolo", "ler o primeiro capítulo") },
  { id: "garden", themeId: "nature", person: "Sonia", location: localized("el jardín comunitario", "the community garden", "le jardin partagé", "dem Gemeinschaftsgarten", "l'orto comunitario", "a horta comunitária"), activity: localized("plantar hierbas aromáticas", "plant fragrant herbs", "planter des herbes aromatiques", "duftende Kräuter pflanzen", "piantare erbe aromatiche", "plantar ervas aromáticas"), object: localized("una regadera azul", "a blue watering can", "un arrosoir bleu", "eine blaue Gießkanne", "un annaffiatoio blu", "um regador azul"), companion: "Inés", time: localized("una mañana soleada", "on a sunny morning", "un matin ensoleillé", "an einem sonnigen Morgen", "in una mattina di sole", "numa manhã de sol"), detailA: localized("el romero", "the rosemary", "le romarin", "den Rosmarin", "il rosmarino", "o alecrim"), detailB: localized("la menta", "the mint", "la menthe", "die Minze", "la menta", "a hortelã"), ending: localized("descansar bajo el limonero", "rest beneath the lemon tree", "se reposer sous le citronnier", "unter dem Zitronenbaum ausruhen", "riposare sotto il limone", "descansar debaixo do limoeiro") },
  { id: "birdwalk", themeId: "nature", person: "Tomás", location: localized("el sendero del río", "the riverside path", "le chemin de la rivière", "dem Weg am Fluss", "il sentiero lungo il fiume", "o caminho junto ao rio"), activity: localized("observar aves", "watch birds", "observer les oiseaux", "Vögel beobachten", "osservare gli uccelli", "observar aves"), object: localized("unos prismáticos negros", "black binoculars", "des jumelles noires", "ein schwarzes Fernglas", "un binocolo nero", "uns binóculos pretos"), companion: "Elena", time: localized("antes del almuerzo", "before lunch", "avant le déjeuner", "vor dem Mittagessen", "prima di pranzo", "antes do almoço"), detailA: localized("una garza blanca", "a white heron", "un héron blanc", "einen weißen Reiher", "un airone bianco", "uma garça branca"), detailB: localized("tres patos", "three ducks", "trois canards", "drei Enten", "tre anatre", "três patos"), ending: localized("anotar los avistamientos", "write down the sightings", "noter les observations", "die Sichtungen notieren", "annotare gli avvistamenti", "anotar os avistamentos") },
  { id: "train", themeId: "travel", person: "Luis", location: localized("la estación central", "the central station", "la gare centrale", "dem Hauptbahnhof", "la stazione centrale", "a estação central"), activity: localized("tomar el tren hacia la costa", "take the train to the coast", "prendre le train vers la côte", "den Zug zur Küste nehmen", "prendere il treno per la costa", "apanhar o comboio para a costa"), object: localized("una maleta roja", "a red suitcase", "une valise rouge", "einen roten Koffer", "una valigia rossa", "uma mala vermelha"), companion: "Ana", time: localized("a las nueve", "at nine o'clock", "à neuf heures", "um neun Uhr", "alle nove", "às nove horas"), detailA: localized("el andén cuatro", "platform four", "le quai quatre", "Gleis vier", "il binario quattro", "a plataforma quatro"), detailB: localized("dos billetes junto a la ventana", "two window seats", "deux places près de la fenêtre", "zwei Fensterplätze", "due posti vicino al finestrino", "dois lugares à janela"), ending: localized("ver el mar antes de comer", "see the sea before lunch", "voir la mer avant déjeuner", "vor dem Mittagessen das Meer sehen", "vedere il mare prima di pranzo", "ver o mar antes do almoço") },
  { id: "museum", themeId: "travel", person: "Clara", location: localized("el casco antiguo", "the old town", "la vieille ville", "der Altstadt", "il centro storico", "o centro histórico"), activity: localized("visitar un museo de cerámica", "visit a pottery museum", "visiter un musée de la céramique", "ein Keramikmuseum besuchen", "visitare un museo della ceramica", "visitar um museu de cerâmica"), object: localized("un mapa plegado", "a folded map", "une carte pliée", "einen gefalteten Stadtplan", "una mappa piegata", "um mapa dobrado"), companion: "Hugo", time: localized("un sábado por la mañana", "on Saturday morning", "un samedi matin", "an einem Samstagmorgen", "il sabato mattina", "num sábado de manhã"), detailA: localized("una fuente azul", "a blue fountain", "une fontaine bleue", "einen blauen Brunnen", "una fontana blu", "uma fonte azul"), detailB: localized("una plaza con naranjos", "a square with orange trees", "une place avec des orangers", "einen Platz mit Orangenbäumen", "una piazza con aranci", "uma praça com laranjeiras"), ending: localized("comprar una postal", "buy a postcard", "acheter une carte postale", "eine Postkarte kaufen", "comprare una cartolina", "comprar um postal") },
  { id: "soup", themeId: "food", person: "Rosa", location: localized("la cocina de su hermana", "her sister's kitchen", "la cuisine de sa sœur", "der Küche ihrer Schwester", "la cucina di sua sorella", "a cozinha da irmã"), activity: localized("preparar una sopa de verduras", "make vegetable soup", "préparer une soupe de légumes", "eine Gemüsesuppe kochen", "preparare una zuppa di verdure", "preparar uma sopa de legumes"), object: localized("una cuchara de madera", "a wooden spoon", "une cuillère en bois", "einen Holzlöffel", "un cucchiaio di legno", "uma colher de pau"), companion: "Marta", time: localized("antes de la cena", "before dinner", "avant le dîner", "vor dem Abendessen", "prima di cena", "antes do jantar"), detailA: localized("las zanahorias", "the carrots", "les carottes", "die Karotten", "le carote", "as cenouras"), detailB: localized("el perejil", "the parsley", "le persil", "die Petersilie", "il prezzemolo", "a salsa"), ending: localized("servir la sopa con pan", "serve the soup with bread", "servir la soupe avec du pain", "die Suppe mit Brot servieren", "servire la zuppa con il pane", "servir a sopa com pão") },
  { id: "market", themeId: "food", person: "Marta", location: localized("el mercado cubierto", "the covered market", "le marché couvert", "der Markthalle", "il mercato coperto", "o mercado coberto"), activity: localized("elegir ingredientes para una ensalada", "choose ingredients for a salad", "choisir des ingrédients pour une salade", "Zutaten für einen Salat auswählen", "scegliere ingredienti per un'insalata", "escolher ingredientes para uma salada"), object: localized("una bolsa de tela", "a cloth bag", "un sac en tissu", "eine Stofftasche", "una borsa di stoffa", "um saco de pano"), companion: "Diego", time: localized("temprano por la mañana", "early in the morning", "tôt le matin", "früh am Morgen", "la mattina presto", "cedo de manhã"), detailA: localized("los tomates", "the tomatoes", "les tomates", "die Tomaten", "i pomodori", "os tomates"), detailB: localized("el queso fresco", "the fresh cheese", "le fromage frais", "den Frischkäse", "il formaggio fresco", "o queijo fresco"), ending: localized("volver antes de la lluvia", "return before the rain", "rentrer avant la pluie", "vor dem Regen zurückkehren", "tornare prima della pioggia", "voltar antes da chuva") },
  { id: "painting", themeId: "hobbies", person: "Elena", location: localized("el taller de arte", "the art studio", "l'atelier d'art", "dem Kunstatelier", "lo studio d'arte", "o ateliê de arte"), activity: localized("pintar un paisaje", "paint a landscape", "peindre un paysage", "eine Landschaft malen", "dipingere un paesaggio", "pintar uma paisagem"), object: localized("un pincel fino", "a fine brush", "un pinceau fin", "einen feinen Pinsel", "un pennello sottile", "um pincel fino"), companion: "Sara", time: localized("el jueves por la tarde", "on Thursday afternoon", "le jeudi après-midi", "am Donnerstagnachmittag", "giovedì pomeriggio", "na quinta-feira à tarde"), detailA: localized("un cielo violeta", "a violet sky", "un ciel violet", "einen violetten Himmel", "un cielo viola", "um céu violeta"), detailB: localized("un camino amarillo", "a yellow path", "un chemin jaune", "einen gelben Weg", "un sentiero giallo", "um caminho amarelo"), ending: localized("colgar el cuadro en casa", "hang the picture at home", "accrocher le tableau chez elle", "das Bild zu Hause aufhängen", "appendere il quadro a casa", "pendurar o quadro em casa") },
  { id: "music", themeId: "hobbies", person: "Andrés", location: localized("la sala de música", "the music room", "la salle de musique", "dem Musikraum", "la sala di musica", "a sala de música"), activity: localized("ensayar tres canciones", "practise three songs", "répéter trois chansons", "drei Lieder üben", "provare tre canzoni", "ensaiar três canções"), object: localized("una carpeta azul", "a blue folder", "un dossier bleu", "eine blaue Mappe", "una cartella blu", "uma pasta azul"), companion: "Julia", time: localized("después de comer", "after lunch", "après le déjeuner", "nach dem Mittagessen", "dopo pranzo", "depois do almoço"), detailA: localized("la canción más lenta", "the slowest song", "la chanson la plus lente", "das langsamste Lied", "la canzone più lenta", "a canção mais lenta"), detailB: localized("un ritmo alegre", "a cheerful rhythm", "un rythme joyeux", "einen fröhlichen Rhythmus", "un ritmo allegro", "um ritmo alegre"), ending: localized("invitar a los vecinos al ensayo", "invite the neighbours to the rehearsal", "inviter les voisins à la répétition", "die Nachbarn zur Probe einladen", "invitare i vicini alle prove", "convidar os vizinhos para o ensaio") },
  { id: "library", themeId: "community", person: "Carmen", location: localized("la biblioteca del barrio", "the neighbourhood library", "la bibliothèque du quartier", "der Stadtteilbibliothek", "la biblioteca del quartiere", "a biblioteca do bairro"), activity: localized("organizar un intercambio de libros", "organise a book exchange", "organiser un échange de livres", "einen Büchertausch organisieren", "organizzare uno scambio di libri", "organizar uma troca de livros"), object: localized("etiquetas naranjas", "orange labels", "des étiquettes orange", "orange Etiketten", "etichette arancioni", "etiquetas laranja"), companion: "Omar", time: localized("el lunes por la tarde", "on Monday afternoon", "le lundi après-midi", "am Montagnachmittag", "lunedì pomeriggio", "na segunda-feira à tarde"), detailA: localized("la mesa de novelas", "the novel table", "la table des romans", "den Romantisch", "il tavolo dei romanzi", "a mesa dos romances"), detailB: localized("la caja de biografías", "the biography box", "la boîte des biographies", "die Biografiekiste", "la scatola delle biografie", "a caixa das biografias"), ending: localized("recomendar un libro a cada visitante", "recommend a book to each visitor", "recommander un livre à chaque visiteur", "jedem Besucher ein Buch empfehlen", "consigliare un libro a ogni visitatore", "recomendar um livro a cada visitante") },
  { id: "square", themeId: "community", person: "Javier", location: localized("la plaza del barrio", "the neighbourhood square", "la place du quartier", "dem Platz im Viertel", "la piazza del quartiere", "a praça do bairro"), activity: localized("preparar una mesa de bienvenida", "prepare a welcome table", "préparer une table d'accueil", "einen Begrüßungstisch vorbereiten", "preparare un tavolo di benvenuto", "preparar uma mesa de boas-vindas"), object: localized("un mantel blanco", "a white tablecloth", "une nappe blanche", "eine weiße Tischdecke", "una tovaglia bianca", "uma toalha branca"), companion: "Fátima", time: localized("antes del encuentro vecinal", "before the neighbourhood gathering", "avant la rencontre du quartier", "vor dem Nachbarschaftstreffen", "prima dell'incontro di quartiere", "antes do encontro do bairro"), detailA: localized("las jarras de agua", "the water jugs", "les carafes d'eau", "die Wasserkrüge", "le caraffe d'acqua", "os jarros de água"), detailB: localized("las tarjetas con nombres", "the name cards", "les cartes avec les noms", "die Namenskarten", "i cartellini con i nomi", "os cartões com nomes"), ending: localized("saludar a las personas nuevas", "welcome the new people", "accueillir les nouvelles personnes", "die neuen Leute begrüßen", "salutare le persone nuove", "receber as pessoas novas") },
  { id: "birthday", themeId: "celebrations", person: "Beatriz", location: localized("el comedor familiar", "the family dining room", "la salle à manger familiale", "dem Esszimmer der Familie", "la sala da pranzo di famiglia", "a sala de jantar da família"), activity: localized("preparar una merienda de cumpleaños", "prepare a birthday tea", "préparer un goûter d'anniversaire", "einen Geburtstagskaffee vorbereiten", "preparare una merenda di compleanno", "preparar um lanche de aniversário"), object: localized("velas doradas", "gold candles", "des bougies dorées", "goldene Kerzen", "candeline dorate", "velas douradas"), companion: "Lucía", time: localized("el domingo a las cinco", "at five on Sunday", "dimanche à cinq heures", "am Sonntag um fünf", "domenica alle cinque", "no domingo às cinco"), detailA: localized("una tarta de limón", "a lemon cake", "un gâteau au citron", "einen Zitronenkuchen", "una torta al limone", "um bolo de limão"), detailB: localized("flores de papel", "paper flowers", "des fleurs en papier", "Papierblumen", "fiori di carta", "flores de papel"), ending: localized("cantar juntos en la mesa", "sing together at the table", "chanter ensemble à table", "gemeinsam am Tisch singen", "cantare insieme a tavola", "cantar juntos à mesa") },
  { id: "lanterns", themeId: "celebrations", person: "Paulo", location: localized("el patio", "the courtyard", "la cour", "dem Innenhof", "il cortile", "o pátio"), activity: localized("decorar una cena especial", "decorate for a special dinner", "décorer pour un dîner spécial", "für ein besonderes Abendessen schmücken", "decorare per una cena speciale", "decorar para um jantar especial"), object: localized("faroles de colores", "colourful lanterns", "des lanternes colorées", "bunte Laternen", "lanterne colorate", "lanternas coloridas"), companion: "Irene", time: localized("justo antes del atardecer", "just before sunset", "juste avant le coucher du soleil", "kurz vor Sonnenuntergang", "poco prima del tramonto", "pouco antes do pôr do sol"), detailA: localized("una cinta azul", "a blue ribbon", "un ruban bleu", "ein blaues Band", "un nastro blu", "uma fita azul"), detailB: localized("cuatro macetas pequeñas", "four small flowerpots", "quatre petits pots", "vier kleine Blumentöpfe", "quattro piccoli vasi", "quatro vasos pequenos"), ending: localized("encender los faroles al llegar los invitados", "light the lanterns when the guests arrived", "allumer les lanternes à l'arrivée des invités", "die Laternen beim Eintreffen der Gäste anzünden", "accendere le lanterne all'arrivo degli ospiti", "acender as lanternas quando os convidados chegassem") },
  { id: "umbrella", themeId: "mystery", person: "Adela", location: localized("la cafetería de la esquina", "the corner café", "le café du coin", "dem Café an der Ecke", "il bar all'angolo", "o café da esquina"), activity: localized("buscar al dueño de un paraguas", "find the owner of an umbrella", "retrouver le propriétaire d'un parapluie", "den Besitzer eines Regenschirms finden", "trovare il proprietario di un ombrello", "encontrar o dono de um guarda-chuva"), object: localized("un paraguas violeta", "a violet umbrella", "un parapluie violet", "einen violetten Regenschirm", "un ombrello viola", "um guarda-chuva violeta"), companion: "Bruno", time: localized("después de una lluvia breve", "after a brief shower", "après une courte averse", "nach einem kurzen Regenschauer", "dopo un breve acquazzone", "depois de uma chuva breve"), detailA: localized("una etiqueta con la letra M", "a label with the letter M", "une étiquette avec la lettre M", "ein Schild mit dem Buchstaben M", "un'etichetta con la lettera M", "uma etiqueta com a letra M"), detailB: localized("un recibo de la panadería", "a bakery receipt", "un reçu de la boulangerie", "eine Quittung der Bäckerei", "uno scontrino del panificio", "um recibo da padaria"), ending: localized("devolverlo a una mujer llamada Marina", "return it to a woman named Marina", "le rendre à une femme appelée Marina", "ihn einer Frau namens Marina zurückgeben", "restituirlo a una donna di nome Marina", "devolvê-lo a uma mulher chamada Marina") },
  { id: "postcard", themeId: "mystery", person: "Gabriel", location: localized("la librería antigua", "the old bookshop", "la vieille librairie", "der alten Buchhandlung", "la vecchia libreria", "a livraria antiga"), activity: localized("descubrir de dónde venía una postal", "discover where a postcard came from", "découvrir d'où venait une carte postale", "herausfinden, woher eine Postkarte kam", "scoprire da dove veniva una cartolina", "descobrir de onde vinha um postal"), object: localized("una postal con un faro", "a postcard showing a lighthouse", "une carte avec un phare", "eine Postkarte mit einem Leuchtturm", "una cartolina con un faro", "um postal com um farol"), companion: "Teresa", time: localized("una tarde tranquila", "on a quiet afternoon", "un après-midi calme", "an einem ruhigen Nachmittag", "in un pomeriggio tranquillo", "numa tarde tranquila"), detailA: localized("un sello verde", "a green stamp", "un timbre vert", "eine grüne Briefmarke", "un francobollo verde", "um selo verde"), detailB: localized("la fecha doce de mayo", "the date twelve May", "la date du douze mai", "das Datum zwölfter Mai", "la data dodici maggio", "a data doze de maio"), ending: localized("encontrar la ciudad en un atlas", "find the town in an atlas", "trouver la ville dans un atlas", "die Stadt in einem Atlas finden", "trovare la città in un atlante", "encontrar a cidade num atlas") },
];

const retellPromptCopy: Record<LanguageCode, string[]> = {
  es: ["¿Quién aparecía?", "¿Dónde ocurrió?", "¿Qué pasó primero?"],
  en: ["Who was in the story?", "Where did it happen?", "What happened first?"],
  fr: ["Qui était dans l'histoire ?", "Où cela s'est-il passé ?", "Qu'est-il arrivé en premier ?"],
  de: ["Wer kam in der Geschichte vor?", "Wo spielte sie?", "Was geschah zuerst?"],
  it: ["Chi c'era nella storia?", "Dove è successo?", "Che cosa è successo prima?"],
  pt: ["Quem estava na história?", "Onde aconteceu?", "O que aconteceu primeiro?"],
};

const storyPromptCopy: Record<LanguageCode, string> = {
  es: "Lee o escucha con calma. Después responderás sin mirar.",
  en: "Read or listen calmly. Then answer without looking back.",
  fr: "Lisez ou écoutez calmement. Répondez ensuite sans regarder.",
  de: "Lesen oder hören Sie in Ruhe zu. Antworten Sie danach ohne zurückzusehen.",
  it: "Leggi o ascolta con calma. Poi rispondi senza guardare.",
  pt: "Leia ou ouça com calma. Depois responda sem voltar a olhar.",
};

const storyTextureCopy: Record<LanguageCode, string[]> = {
  es: ["La luz era agradable y el lugar se sentía acogedor.", "Cada detalle tenía una razón sencilla dentro del plan.", "Los dos comentaron lo que todavía quedaba por hacer.", "Una brisa suave entraba mientras continuaban con la tarea.", "Se ayudaron mutuamente para recordar cada pequeño paso.", "Al terminar una parte, revisaron juntos el resultado.", "También dedicaron un momento a disfrutar de la conversación.", "La experiencia convirtió un día normal en un buen recuerdo."],
  en: ["The light was pleasant and the place felt welcoming.", "Each detail had a simple reason within their plan.", "They talked about what still needed to be done.", "A gentle breeze came through while they continued the task.", "They helped one another remember each small step.", "After finishing one part, they checked the result together.", "They also took a moment to enjoy the conversation.", "The experience turned an ordinary day into a good memory."],
  fr: ["La lumière était agréable et le lieu semblait accueillant.", "Chaque détail avait une raison simple dans leur projet.", "Ils ont parlé de ce qu'il restait encore à faire.", "Une brise légère passait pendant qu'ils continuaient leur tâche.", "Ils se sont aidés à se souvenir de chaque petite étape.", "Après une partie, ils ont vérifié le résultat ensemble.", "Ils ont aussi pris un moment pour profiter de la conversation.", "Cette expérience a transformé une journée ordinaire en bon souvenir."],
  de: ["Das Licht war angenehm und der Ort wirkte einladend.", "Jedes Detail hatte in ihrem Plan einen einfachen Grund.", "Sie besprachen, was noch erledigt werden musste.", "Eine sanfte Brise kam herein, während sie weitermachten.", "Sie halfen einander, sich an jeden kleinen Schritt zu erinnern.", "Nach einem Abschnitt prüften sie gemeinsam das Ergebnis.", "Sie nahmen sich auch Zeit für ein angenehmes Gespräch.", "So wurde ein gewöhnlicher Tag zu einer schönen Erinnerung."],
  it: ["La luce era piacevole e il luogo sembrava accogliente.", "Ogni dettaglio aveva un motivo semplice nel loro piano.", "Hanno parlato di ciò che restava ancora da fare.", "Una brezza leggera entrava mentre continuavano il lavoro.", "Si sono aiutati a ricordare ogni piccolo passaggio.", "Dopo una parte, hanno controllato insieme il risultato.", "Si sono anche fermati un momento per godersi la conversazione.", "L'esperienza ha trasformato un giorno normale in un bel ricordo."],
  pt: ["A luz era agradável e o lugar parecia acolhedor.", "Cada pormenor tinha uma razão simples dentro do plano.", "Conversaram sobre o que ainda faltava fazer.", "Uma brisa suave entrava enquanto continuavam a tarefa.", "Ajudaram-se a recordar cada pequeno passo.", "Depois de uma parte, verificaram juntos o resultado.", "Também pararam um momento para desfrutar da conversa.", "A experiência transformou um dia normal numa boa recordação."],
};

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function buildStoryText(sentences: string[], language: LanguageCode, bandIndex: number, step: number) {
  const ranges = [[35, 60], [60, 90], [90, 125], [125, 170]] as const;
  const [minimum, maximum] = ranges[bandIndex];
  const target = minimum + Math.round(((maximum - minimum) * (step - 1)) / 4);
  const storySentences = [...sentences];
  const texture = storyTextureCopy[language];
  let textureIndex = 0;
  while (countWords(storySentences.join(" ")) < target && textureIndex < texture.length) {
    const candidate = texture[textureIndex];
    if (countWords(`${storySentences.join(" ")} ${candidate}`) <= maximum) storySentences.push(candidate);
    textureIndex += 1;
  }
  return storySentences.join(" ");
}

function sentenceSet(scene: StoryScene, language: LanguageCode) {
  const p = scene.person;
  const c = scene.companion;
  const v = (value: Localized) => value[language];
  const sets: Record<LanguageCode, string[]> = {
    en: [`${p} went to ${v(scene.location)} ${v(scene.time)}.`, `The plan was to ${v(scene.activity)}.`, `${p} brought ${v(scene.object)}.`, `${c} came along to help.`, `They first noticed ${v(scene.detailA)}.`, `After that, they focused on ${v(scene.detailB)}.`, `${p} checked that everything was in the right place.`, `${c} suggested taking a short break.`, `They talked about the best part of the morning.`, `Before leaving, they looked around once more.`, `Nothing needed to be rushed, so they worked calmly.`, `They finished by deciding to ${v(scene.ending)}.`],
    es: [`${p} fue a ${v(scene.location)} ${v(scene.time)}.`, `El plan era ${v(scene.activity)}.`, `${p} llevó ${v(scene.object)}.`, `${c} fue para ayudar.`, `Primero se fijaron en ${v(scene.detailA)}.`, `Después prestaron atención a ${v(scene.detailB)}.`, `${p} comprobó que todo estuviera en su sitio.`, `${c} propuso hacer una pausa breve.`, `Hablaron de la mejor parte de la mañana.`, `Antes de irse, miraron alrededor una vez más.`, `No había prisa, así que avanzaron con calma.`, `Terminaron decidiendo ${v(scene.ending)}.`],
    fr: [`${p} est allé à ${v(scene.location)} ${v(scene.time)}.`, `Le projet était de ${v(scene.activity)}.`, `${p} avait apporté ${v(scene.object)}.`, `${c} est venu aider.`, `Ils ont d'abord remarqué ${v(scene.detailA)}.`, `Ensuite, ils se sont occupés de ${v(scene.detailB)}.`, `${p} a vérifié que tout était à sa place.`, `${c} a proposé une courte pause.`, `Ils ont parlé du meilleur moment de la matinée.`, `Avant de partir, ils ont regardé encore une fois autour d'eux.`, `Rien ne pressait et ils ont continué calmement.`, `Ils ont terminé en décidant de ${v(scene.ending)}.`],
    de: [`${p} ging ${v(scene.time)} zu ${v(scene.location)}.`, `Der Plan war, ${v(scene.activity)}.`, `${p} brachte ${v(scene.object)} mit.`, `${c} kam zum Helfen mit.`, `Zuerst bemerkten sie ${v(scene.detailA)}.`, `Danach kümmerten sie sich um ${v(scene.detailB)}.`, `${p} prüfte, ob alles am richtigen Platz war.`, `${c} schlug eine kurze Pause vor.`, `Sie sprachen über den schönsten Teil des Morgens.`, `Vor dem Gehen sahen sie sich noch einmal um.`, `Es gab keinen Grund zur Eile, also machten sie ruhig weiter.`, `Zum Schluss beschlossen sie, ${v(scene.ending)}.`],
    it: [`${p} è andato a ${v(scene.location)} ${v(scene.time)}.`, `Il piano era ${v(scene.activity)}.`, `${p} ha portato ${v(scene.object)}.`, `${c} è venuto ad aiutare.`, `Per prima cosa hanno notato ${v(scene.detailA)}.`, `Poi si sono occupati di ${v(scene.detailB)}.`, `${p} ha controllato che tutto fosse al posto giusto.`, `${c} ha proposto una breve pausa.`, `Hanno parlato della parte migliore della mattina.`, `Prima di andare via, si sono guardati intorno ancora una volta.`, `Non c'era fretta e hanno continuato con calma.`, `Alla fine hanno deciso di ${v(scene.ending)}.`],
    pt: [`${p} foi a ${v(scene.location)} ${v(scene.time)}.`, `O plano era ${v(scene.activity)}.`, `${p} levou ${v(scene.object)}.`, `${c} foi ajudar.`, `Primeiro repararam em ${v(scene.detailA)}.`, `Depois trataram de ${v(scene.detailB)}.`, `${p} confirmou que tudo estava no lugar certo.`, `${c} sugeriu uma pequena pausa.`, `Conversaram sobre a melhor parte da manhã.`, `Antes de sair, olharam em volta mais uma vez.`, `Não havia pressa e continuaram com calma.`, `No fim decidiram ${v(scene.ending)}.`],
  };
  return sets[language];
}

function questionCopy(scene: StoryScene, language: LanguageCode): StoryRecallQuestion[] {
  const v = (value: Localized) => value[language];
  const prompts: Record<LanguageCode, [string, string, string, string, string, string]> = {
    es: ["¿Dónde ocurrió la historia?", "¿Cuál era el plan?", "¿Qué llevó la persona?", "¿Quién fue a ayudar?", "¿En qué se fijaron primero?", "¿Por qué pudieron avanzar con calma?"],
    en: ["Where did the story happen?", "What was the plan?", "What did the person bring?", "Who came to help?", "What did they notice first?", "Why could they work calmly?"],
    fr: ["Où l'histoire s'est-elle passée ?", "Quel était le projet ?", "Qu'avait apporté la personne ?", "Qui est venu aider ?", "Qu'ont-ils remarqué en premier ?", "Pourquoi ont-ils pu avancer calmement ?"],
    de: ["Wo spielte die Geschichte?", "Was war der Plan?", "Was brachte die Person mit?", "Wer kam zum Helfen?", "Was bemerkten sie zuerst?", "Warum konnten sie ruhig arbeiten?"],
    it: ["Dove è successa la storia?", "Qual era il piano?", "Che cosa ha portato la persona?", "Chi è venuto ad aiutare?", "Che cosa hanno notato per prima cosa?", "Perché hanno potuto lavorare con calma?"],
    pt: ["Onde aconteceu a história?", "Qual era o plano?", "O que levou a pessoa?", "Quem foi ajudar?", "Em que repararam primeiro?", "Porque puderam continuar com calma?"],
  };
  const generic: Record<LanguageCode, string[]> = {
    es: ["otro lugar", "hacer otra tarea", "un objeto diferente", "otra persona", "otro detalle", "porque tenían mucha prisa"],
    en: ["somewhere else", "do a different task", "a different object", "someone else", "another detail", "because they were in a great hurry"],
    fr: ["ailleurs", "faire une autre tâche", "un autre objet", "une autre personne", "un autre détail", "parce qu'ils étaient très pressés"],
    de: ["an einem anderen Ort", "etwas anderes tun", "einen anderen Gegenstand", "jemand anderes", "ein anderes Detail", "weil sie große Eile hatten"],
    it: ["in un altro luogo", "fare un'altra attività", "un altro oggetto", "un'altra persona", "un altro dettaglio", "perché avevano molta fretta"],
    pt: ["noutro lugar", "fazer outra tarefa", "outro objeto", "outra pessoa", "outro pormenor", "porque tinham muita pressa"],
  };
  const calmReason = localized("porque no había prisa", "because there was no need to rush", "parce que rien ne pressait", "weil es keinen Grund zur Eile gab", "perché non c'era fretta", "porque não havia pressa");
  const answers = [v(scene.location), v(scene.activity), v(scene.object), scene.companion, v(scene.detailA), calmReason[language]];
  const kinds: StoryQuestionKind[] = ["detail", "detail", "detail", "detail", "sequence", "inference"];
  return prompts[language].map((prompt, index) => ({
    prompt,
    options: [answers[index], generic[language][index], generic[language][(index + 2) % generic[language].length]],
    answerIndex: 0,
    kind: kinds[index],
  }));
}

function levelShape(level: number) {
  const bandIndex = Math.floor((level - 1) / 5);
  const step = ((level - 1) % 5) + 1;
  const sentenceCounts = [5 + Math.floor((step - 1) / 2), 7 + Math.floor((step - 1) / 2), 9 + Math.floor((step - 1) / 2), 11 + (step === 5 ? 1 : 0)];
  const factBase = [3, 5, 7, 9][bandIndex];
  const questionBase = [2, 3, 4, 5][bandIndex];
  return {
    bandIndex,
    step,
    sentenceCount: sentenceCounts[bandIndex],
    factCount: Math.min(12, factBase + Math.floor((step - 1) / 2)),
    questionCount: Math.min(6, questionBase + (step >= 4 ? 1 : 0)),
    retellMode: (bandIndex === 0 ? "guided" : bandIndex === 1 ? "light" : "open") as StoryRecallPayload["retellMode"],
  };
}

export function buildStoryRecallLevels(): MemoryGameLevel[] {
  return Array.from({ length: BRAIN_COACH_MAX_LEVEL }, (_, levelIndex) => {
    const level = levelIndex + 1;
    const shape = levelShape(level);
    const variants = scenes.map((scene) => {
      const content = (Object.keys(scene.location) as LanguageCode[]).reduce((result, language) => {
        const sentences = sentenceSet(scene, language);
        const theme = STORY_THEMES.find((entry) => entry.id === scene.themeId)!;
        const storyId = `${scene.themeId}-${scene.id}-${getBrainCoachLevelBand(level).id}`;
        const title = `${theme.label[language]} · ${scene.person}`;
        result[language] = {
          title,
          prompt: storyPromptCopy[language],
          payload: {
            storyId,
            themeId: scene.themeId,
            story: buildStoryText(sentences.slice(0, shape.sentenceCount), language, shape.bandIndex, shape.step),
            keyFacts: sentences.slice(0, shape.factCount),
            choiceQuestions: questionCopy(scene, language).slice(0, shape.questionCount),
            levelBand: getBrainCoachLevelBand(level).label,
            bandStep: shape.step,
            retellMode: shape.retellMode,
            retellPrompts: shape.retellMode === "guided" ? retellPromptCopy[language] : shape.retellMode === "light" ? retellPromptCopy[language].slice(0, 1) : [],
            theme: { emoji: theme.emoji, accent: theme.accent, surface: theme.surface, border: theme.border, motif: theme.motif },
          },
        };
        return result;
      }, {} as Partial<Record<LanguageCode, MemoryGameVariantContent>> & { es: MemoryGameVariantContent });
      return { id: `story_recall-l${level}-${scene.themeId}-${scene.id}`, level, content };
    });
    return { level, variants };
  });
}

export function getStoryTheme(themeId: StoryThemeId) {
  return STORY_THEMES.find((theme) => theme.id === themeId) ?? STORY_THEMES[0];
}
