import type { SocialActivityType, SocialLanguage, SocialRoom, SocialRoomCategory } from "../../src/social/types";

type LocalizedText = Partial<Record<SocialLanguage, string>> & {
  es: string;
  en: string;
  de: string;
};

type DailyTopicSeed = {
  topic: LocalizedText;
  opener: LocalizedText;
  quote?: LocalizedText;
  contentTag?: LocalizedText;
  contentTitle?: LocalizedText;
  contentBody?: LocalizedText;
  options?: LocalizedText[];
  activityType?: SocialActivityType;
};

export type SocialRoomSeed = {
  slug: string;
  names: LocalizedText;
  category: SocialRoomCategory;
  agentSlug: string;
  agentFullName: string;
  agentColour: string;
  agentCredential: LocalizedText;
  ctaLabel: LocalizedText;
  topicTags: string[];
  timeSlots: string[];
  featured: boolean;
  memberCount: number;
  sortOrder: number;
  dailyTopics: DailyTopicSeed[];
};

const t = (
  es: string,
  en: string,
  de: string,
  frOrExtra?: string | Partial<Record<SocialLanguage, string>>,
  it?: string,
  pt?: string,
): LocalizedText => ({
  es,
  en,
  de,
  ...(typeof frOrExtra === "object" && frOrExtra ? frOrExtra : {}),
  ...(typeof frOrExtra === "string" ? { fr: frOrExtra } : {}),
  ...(it ? { it } : {}),
  ...(pt ? { pt } : {}),
});

const blank = t("", "", "");

const room = (seed: SocialRoomSeed) => seed;

type ReadingTopicCopy = [string, string, string, string, string, string];

type ReadingTopicInput = {
  topic: ReadingTopicCopy;
  opener: ReadingTopicCopy;
  contentTitle: ReadingTopicCopy;
  contentBody: ReadingTopicCopy;
  options: [ReadingTopicCopy, ReadingTopicCopy, ReadingTopicCopy];
};

const readingTopic = (input: ReadingTopicInput): DailyTopicSeed => ({
  topic: t(...input.topic),
  opener: t(...input.opener),
  contentTitle: t(...input.contentTitle),
  contentBody: t(...input.contentBody),
  options: input.options.map((option) => t(...option)),
  activityType: "discussion",
});

const readingRoomDailyTopics: DailyTopicSeed[] = [
  readingTopic({
    topic: [
      "Una frase, un recuerdo y una conversacion.",
      "One line, one memory and one conversation.",
      "Eine Zeile, eine Erinnerung und ein Gespraech.",
      "Une phrase, un souvenir et une conversation.",
      "Una frase, un ricordo e una conversazione.",
      "Uma frase, uma memoria e uma conversa.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy compartimos libros, historias y pequenos recuerdos para conocernos mejor.",
      "Hello, I'm Isabel. Today we share books, stories and small memories so we can know one another better.",
      "Hallo, ich bin Isabel. Heute teilen wir Buecher, Geschichten und kleine Erinnerungen, um einander besser kennenzulernen.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous partageons des livres, des histoires et de petits souvenirs pour mieux nous connaitre.",
      "Ciao, sono Isabel. Oggi condividiamo libri, storie e piccoli ricordi per conoscerci meglio.",
      "Ola, sou a Isabel. Hoje partilhamos livros, historias e pequenas memorias para nos conhecermos melhor.",
    ],
    contentTitle: [
      "Club literario vivo",
      "A living literary club",
      "Ein lebendiger Literaturclub",
      "Un club litteraire vivant",
      "Un club letterario vivo",
      "Um clube literario vivo",
    ],
    contentBody: [
      "Entra a la mesa, mira el programa, deja una reflexion y encuentra compania lectora con un saludo protegido.",
      "Step up to the table, browse the program, leave a reflection and find reading company through a protected greeting.",
      "Komm an den Tisch, sieh dir das Programm an, hinterlasse einen Beitrag und finde Lesebegleitung mit geschuetztem Gruss.",
      "Approchez de la table, parcourez le programme, laissez une reflexion et trouvez une compagnie de lecture avec un salut protege.",
      "Avvicinati al tavolo, guarda il programma, lascia una riflessione e trova compagnia di lettura con un saluto protetto.",
      "Chegue a mesa, veja o programa, deixe uma reflexao e encontre companhia de leitura com uma saudacao protegida.",
    ],
    options: [
      ["Anadir una reflexion a la mesa", "Add a reflection to the table", "Einen Beitrag zum Tisch hinzufuegen", "Ajouter une reflexion a la table", "Aggiungere una riflessione al tavolo", "Adicionar uma reflexao a mesa"],
      ["Buscar mi lugar en el club", "Find my place in the club", "Meinen Platz im Club finden", "Trouver ma place dans le club", "Trovare il mio posto nel club", "Encontrar o meu lugar no clube"],
      ["Entrar al programa de hoy", "Join today's program", "Am heutigen Programm teilnehmen", "Rejoindre le programme du jour", "Entrare nel programma di oggi", "Entrar no programa de hoje"],
    ],
  }),
  readingTopic({
    topic: [
      "Libros que abren una puerta.",
      "Books that open a door.",
      "Buecher, die eine Tuer oeffnen.",
      "Des livres qui ouvrent une porte.",
      "Libri che aprono una porta.",
      "Livros que abrem uma porta.",
    ],
    opener: [
      "Hola, soy Isabel. Elige un libro, una autora o una escena; buscaremos con quien conversar.",
      "Hello, I'm Isabel. Choose a book, an author or a scene; we will find someone to talk with.",
      "Hallo, ich bin Isabel. Waehle ein Buch, eine Autorin oder eine Szene; wir finden jemanden zum Reden.",
      "Bonjour, je suis Isabel. Choisissez un livre, une autrice ou une scene; nous trouverons quelqu'un avec qui parler.",
      "Ciao, sono Isabel. Scegli un libro, un'autrice o una scena; troveremo qualcuno con cui parlarne.",
      "Ola, sou a Isabel. Escolha um livro, uma autora ou uma cena; vamos encontrar alguem para conversar.",
    ],
    contentTitle: [
      "Intercambio literario",
      "Literary exchange",
      "Literarischer Austausch",
      "Echange litteraire",
      "Scambio letterario",
      "Intercambio literario",
    ],
    contentBody: [
      "Cada persona puede contar que le gusto, que le sorprendio o que recuerdo desperto.",
      "Each person can share what they liked, what surprised them or which memory it opened.",
      "Jede Person kann teilen, was gefiel, was ueberraschte oder welche Erinnerung wach wurde.",
      "Chaque personne peut dire ce qu'elle a aime, ce qui l'a surprise ou quel souvenir s'est ouvert.",
      "Ognuno puo raccontare cosa gli e piaciuto, cosa lo ha sorpreso o quale ricordo ha risvegliato.",
      "Cada pessoa pode contar do que gostou, o que a surpreendeu ou que memoria despertou.",
    ],
    options: [
      ["Contar una escena favorita", "Tell a favourite scene", "Eine Lieblingsszene erzaehlen", "Raconter une scene preferee", "Raccontare una scena preferita", "Contar uma cena preferida"],
      ["Pedir una recomendacion amable", "Ask for a gentle recommendation", "Um eine freundliche Empfehlung bitten", "Demander une recommandation douce", "Chiedere un consiglio gentile", "Pedir uma recomendacao gentil"],
      ["Saludar a otro lector", "Greet another reader", "Eine andere Leserin gruessen", "Saluer une autre personne lectrice", "Salutare un'altra persona lettrice", "Saudar outra pessoa leitora"],
    ],
  }),
  readingTopic({
    topic: [
      "La primera biblioteca que recuerdas.",
      "The first library you remember.",
      "Die erste Bibliothek, an die du dich erinnerst.",
      "La premiere bibliotheque dont vous vous souvenez.",
      "La prima biblioteca che ricordi.",
      "A primeira biblioteca de que se lembra.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy abrimos recuerdos de bibliotecas, estantes y rincones donde leer se sentia seguro.",
      "Hello, I'm Isabel. Today we open memories of libraries, shelves and corners where reading felt safe.",
      "Hallo, ich bin Isabel. Heute oeffnen wir Erinnerungen an Bibliotheken, Regale und sichere Leseecken.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous ouvrons des souvenirs de bibliotheques, d'etageres et de coins rassurants.",
      "Ciao, sono Isabel. Oggi apriamo ricordi di biblioteche, scaffali e angoli dove leggere sembrava sicuro.",
      "Ola, sou a Isabel. Hoje abrimos memorias de bibliotecas, prateleiras e cantos onde ler parecia seguro.",
    ],
    contentTitle: [
      "Un estante recordado",
      "A remembered shelf",
      "Ein erinnertes Regal",
      "Une etagere en memoire",
      "Uno scaffale ricordato",
      "Uma prateleira lembrada",
    ],
    contentBody: [
      "Cuenta un lugar de lectura: una biblioteca, una casa, una escuela o una silla junto a una ventana.",
      "Share a reading place: a library, a home, a school or a chair by a window.",
      "Erzaehle von einem Leseort: Bibliothek, Zuhause, Schule oder ein Stuhl am Fenster.",
      "Partagez un lieu de lecture : bibliotheque, maison, ecole ou chaise pres d'une fenetre.",
      "Racconta un luogo di lettura: biblioteca, casa, scuola o una sedia vicino alla finestra.",
      "Partilhe um lugar de leitura: biblioteca, casa, escola ou uma cadeira junto a janela.",
    ],
    options: [
      ["Describir mi primer estante", "Describe my first shelf", "Mein erstes Regal beschreiben", "Decrire ma premiere etagere", "Descrivere il mio primo scaffale", "Descrever a minha primeira prateleira"],
      ["Contar donde leia", "Tell where I read", "Erzaehlen, wo ich las", "Dire ou je lisais", "Raccontare dove leggevo", "Contar onde lia"],
      ["Preguntar por una biblioteca", "Ask about a library", "Nach einer Bibliothek fragen", "Demander une bibliotheque", "Chiedere di una biblioteca", "Perguntar por uma biblioteca"],
    ],
  }),
  readingTopic({
    topic: [
      "Un personaje que se quedo contigo.",
      "A character who stayed with you.",
      "Eine Figur, die bei dir geblieben ist.",
      "Un personnage qui est reste avec vous.",
      "Un personaggio che e rimasto con te.",
      "Uma personagem que ficou consigo.",
    ],
    opener: [
      "Hola, soy Isabel. No hace falta recordar todo el libro; una persona de la historia basta.",
      "Hello, I'm Isabel. You do not need to remember the whole book; one person from the story is enough.",
      "Hallo, ich bin Isabel. Du musst nicht das ganze Buch erinnern; eine Person aus der Geschichte reicht.",
      "Bonjour, je suis Isabel. Pas besoin de se souvenir de tout le livre; une personne de l'histoire suffit.",
      "Ciao, sono Isabel. Non serve ricordare tutto il libro; basta una persona della storia.",
      "Ola, sou a Isabel. Nao precisa de lembrar o livro todo; uma pessoa da historia chega.",
    ],
    contentTitle: [
      "Personajes que acompanan",
      "Characters who keep company",
      "Figuren, die begleiten",
      "Personnages qui tiennent compagnie",
      "Personaggi che fanno compagnia",
      "Personagens que fazem companhia",
    ],
    contentBody: [
      "Comparte un personaje que te dio risa, valor, ternura o una pregunta.",
      "Share a character who gave you laughter, courage, tenderness or a question.",
      "Teile eine Figur, die Lachen, Mut, Zartheit oder eine Frage brachte.",
      "Partagez un personnage qui vous a donne rire, courage, douceur ou question.",
      "Condividi un personaggio che ti ha dato sorriso, coraggio, tenerezza o una domanda.",
      "Partilhe uma personagem que trouxe riso, coragem, ternura ou uma pergunta.",
    ],
    options: [
      ["Nombrar un personaje", "Name a character", "Eine Figur nennen", "Nommer un personnage", "Nominare un personaggio", "Nomear uma personagem"],
      ["Contar que senti", "Tell what I felt", "Sagen, was ich fuehlte", "Dire ce que j'ai ressenti", "Raccontare cosa ho sentito", "Contar o que senti"],
      ["Buscar personajes parecidos", "Find similar characters", "Aehnliche Figuren finden", "Trouver des personnages proches", "Trovare personaggi simili", "Encontrar personagens parecidas"],
    ],
  }),
  readingTopic({
    topic: [
      "Lecturas que consuelan.",
      "Reading that comforts.",
      "Lesestoff, der troestet.",
      "Lectures qui reconfortent.",
      "Letture che consolano.",
      "Leituras que confortam.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy la mesa busca libros tranquilos para dias que piden compania.",
      "Hello, I'm Isabel. Today the table looks for calm books for days that ask for company.",
      "Hallo, ich bin Isabel. Heute sucht der Tisch ruhige Buecher fuer Tage, die Begleitung brauchen.",
      "Bonjour, je suis Isabel. Aujourd'hui, la table cherche des livres calmes pour les jours qui demandent compagnie.",
      "Ciao, sono Isabel. Oggi il tavolo cerca libri calmi per giorni che chiedono compagnia.",
      "Ola, sou a Isabel. Hoje a mesa procura livros calmos para dias que pedem companhia.",
    ],
    contentTitle: [
      "Un libro companero",
      "A companion book",
      "Ein Begleitbuch",
      "Un livre compagnon",
      "Un libro compagnia",
      "Um livro companhia",
    ],
    contentBody: [
      "Recomienda por animo: calma, humor, esperanza, familia o una voz conocida.",
      "Recommend by mood: calm, humour, hope, family or a familiar voice.",
      "Empfiehl nach Stimmung: Ruhe, Humor, Hoffnung, Familie oder eine vertraute Stimme.",
      "Recommandez par humeur : calme, humour, espoir, famille ou voix familiere.",
      "Consiglia per umore: calma, umorismo, speranza, famiglia o una voce familiare.",
      "Recomende por humor: calma, humor, esperanca, familia ou uma voz familiar.",
    ],
    options: [
      ["Pedir algo tranquilo", "Ask for something calm", "Etwas Ruhiges erbitten", "Demander quelque chose de calme", "Chiedere qualcosa di calmo", "Pedir algo calmo"],
      ["Dejar una recomendacion", "Leave a recommendation", "Eine Empfehlung hinterlassen", "Laisser une recommandation", "Lasciare un consiglio", "Deixar uma recomendacao"],
      ["Compartir un libro companero", "Share a companion book", "Ein Begleitbuch teilen", "Partager un livre compagnon", "Condividere un libro compagnia", "Partilhar um livro companhia"],
    ],
  }),
  readingTopic({
    topic: [
      "Una imagen de un poema.",
      "One image from a poem.",
      "Ein Bild aus einem Gedicht.",
      "Une image d'un poeme.",
      "Un'immagine da una poesia.",
      "Uma imagem de um poema.",
    ],
    opener: [
      "Hola, soy Isabel. Hablamos de poesia sin recitar largos textos: basta la imagen que quedo.",
      "Hello, I'm Isabel. We talk about poetry without long quotations: the image that stayed is enough.",
      "Hallo, ich bin Isabel. Wir sprechen ueber Poesie ohne lange Zitate: Das Bild, das blieb, reicht.",
      "Bonjour, je suis Isabel. Nous parlons de poesie sans longues citations : l'image qui reste suffit.",
      "Ciao, sono Isabel. Parliamo di poesia senza lunghe citazioni: basta l'immagine rimasta.",
      "Ola, sou a Isabel. Falamos de poesia sem citacoes longas: basta a imagem que ficou.",
    ],
    contentTitle: [
      "Poesia en tus palabras",
      "Poetry in your own words",
      "Poesie in eigenen Worten",
      "Poesie avec vos mots",
      "Poesia con parole tue",
      "Poesia pelas suas palavras",
    ],
    contentBody: [
      "Describe una imagen, un color, una estacion o un sentimiento que un poema te dejo.",
      "Describe an image, colour, season or feeling a poem left with you.",
      "Beschreibe ein Bild, eine Farbe, Jahreszeit oder ein Gefuehl, das ein Gedicht hinterliess.",
      "Decrivez une image, une couleur, une saison ou un sentiment laisse par un poeme.",
      "Descrivi un'immagine, colore, stagione o sentimento lasciato da una poesia.",
      "Descreva uma imagem, cor, estacao ou sentimento deixado por um poema.",
    ],
    options: [
      ["Describir una imagen", "Describe an image", "Ein Bild beschreiben", "Decrire une image", "Descrivere un'immagine", "Descrever uma imagem"],
      ["Hablar de una estacion", "Talk about a season", "Ueber eine Jahreszeit sprechen", "Parler d'une saison", "Parlare di una stagione", "Falar de uma estacao"],
      ["Escuchar poesia breve", "Hear brief poetry", "Kurze Poesie hoeren", "Ecouter une breve poesie", "Ascoltare poesia breve", "Ouvir poesia breve"],
    ],
  }),
  readingTopic({
    topic: [
      "Biografias que parecen cercanas.",
      "Biographies that feel close.",
      "Biografien, die nah wirken.",
      "Biographies qui semblent proches.",
      "Biografie che sembrano vicine.",
      "Biografias que parecem proximas.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy buscamos vidas reales que abren conversacion sin hacer examen.",
      "Hello, I'm Isabel. Today we look for real lives that open conversation without feeling like homework.",
      "Hallo, ich bin Isabel. Heute suchen wir echte Leben, die Gespraeche oeffnen, ohne Aufgabe zu sein.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous cherchons des vies reelles qui ouvrent la conversation sans devoir.",
      "Ciao, sono Isabel. Oggi cerchiamo vite reali che aprono conversazione senza sembrare compiti.",
      "Ola, sou a Isabel. Hoje procuramos vidas reais que abrem conversa sem parecer tarefa.",
    ],
    contentTitle: [
      "Una vida bien contada",
      "A life well told",
      "Ein gut erzaehltes Leben",
      "Une vie bien racontee",
      "Una vita ben raccontata",
      "Uma vida bem contada",
    ],
    contentBody: [
      "Comparte una persona real, una epoca o una decision que te hizo pensar.",
      "Share a real person, a period or a decision that made you think.",
      "Teile eine echte Person, eine Zeit oder eine Entscheidung, die dich denken liess.",
      "Partagez une personne reelle, une epoque ou une decision qui vous a fait reflechir.",
      "Condividi una persona reale, un'epoca o una decisione che ti ha fatto pensare.",
      "Partilhe uma pessoa real, uma epoca ou uma decisao que o fez pensar.",
    ],
    options: [
      ["Nombrar una biografia", "Name a biography", "Eine Biografie nennen", "Nommer une biographie", "Nominare una biografia", "Nomear uma biografia"],
      ["Preguntar por una vida", "Ask about a life", "Nach einem Leben fragen", "Demander une vie", "Chiedere di una vita", "Perguntar por uma vida"],
      ["Conectar con historia", "Connect through history", "Durch Geschichte verbinden", "Se relier par l'histoire", "Connettersi con la storia", "Ligar pela historia"],
    ],
  }),
  readingTopic({
    topic: [
      "Lugares que una historia te llevo.",
      "Places a story took you.",
      "Orte, an die dich eine Geschichte brachte.",
      "Lieux ou une histoire vous a emmene.",
      "Luoghi dove una storia ti ha portato.",
      "Lugares aonde uma historia o levou.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy viajamos con paginas: calles, cocinas, trenes, mares o plazas.",
      "Hello, I'm Isabel. Today we travel through pages: streets, kitchens, trains, seas or squares.",
      "Hallo, ich bin Isabel. Heute reisen wir mit Seiten: Strassen, Kuechen, Zuege, Meere oder Plaetze.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous voyageons par les pages : rues, cuisines, trains, mers ou places.",
      "Ciao, sono Isabel. Oggi viaggiamo con le pagine: strade, cucine, treni, mari o piazze.",
      "Ola, sou a Isabel. Hoje viajamos pelas paginas: ruas, cozinhas, comboios, mares ou pracas.",
    ],
    contentTitle: [
      "Mapas de lectura",
      "Reading maps",
      "Lesekarten",
      "Cartes de lecture",
      "Mappe di lettura",
      "Mapas de leitura",
    ],
    contentBody: [
      "Cuenta un lugar de un libro o una historia que te hizo recordar otro sitio.",
      "Tell about a place in a book or story that made you remember another place.",
      "Erzaehle von einem Ort in einem Buch, der dich an einen anderen Ort erinnerte.",
      "Racontez un lieu dans un livre qui vous a rappele un autre endroit.",
      "Racconta un luogo in un libro che ti ha ricordato un altro posto.",
      "Conte um lugar num livro que o fez lembrar outro sitio.",
    ],
    options: [
      ["Compartir un lugar", "Share a place", "Einen Ort teilen", "Partager un lieu", "Condividere un luogo", "Partilhar um lugar"],
      ["Recordar una calle", "Remember a street", "Eine Strasse erinnern", "Se souvenir d'une rue", "Ricordare una strada", "Recordar uma rua"],
      ["Buscar historias de viaje", "Find travel stories", "Reisegeschichten finden", "Trouver des histoires de voyage", "Trovare storie di viaggio", "Encontrar historias de viagem"],
    ],
  }),
  readingTopic({
    topic: [
      "Libros que llegaron por familia.",
      "Books that came through family.",
      "Buecher, die durch Familie kamen.",
      "Livres venus par la famille.",
      "Libri arrivati dalla famiglia.",
      "Livros que chegaram pela familia.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy preguntamos quien nos puso una historia en las manos.",
      "Hello, I'm Isabel. Today we ask who first put a story in our hands.",
      "Hallo, ich bin Isabel. Heute fragen wir, wer uns zuerst eine Geschichte in die Haende legte.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous demandons qui nous a mis une histoire entre les mains.",
      "Ciao, sono Isabel. Oggi chiediamo chi ci ha messo una storia tra le mani.",
      "Ola, sou a Isabel. Hoje perguntamos quem nos colocou uma historia nas maos.",
    ],
    contentTitle: [
      "Lecturas heredadas",
      "Inherited reading",
      "Geerbtes Lesen",
      "Lectures heritees",
      "Letture ereditate",
      "Leituras herdadas",
    ],
    contentBody: [
      "Puede ser una madre, un vecino, una maestra, un hermano o una voz de radio.",
      "It might be a mother, neighbour, teacher, sibling or voice on the radio.",
      "Es kann Mutter, Nachbar, Lehrerin, Bruder oder Radiostimme gewesen sein.",
      "Cela peut etre une mere, un voisin, une maitresse, un frere ou une voix de radio.",
      "Puo essere madre, vicino, insegnante, fratello o voce della radio.",
      "Pode ser mae, vizinho, professora, irmao ou voz da radio.",
    ],
    options: [
      ["Recordar quien leia", "Remember who read", "Erinnern, wer las", "Se rappeler qui lisait", "Ricordare chi leggeva", "Recordar quem lia"],
      ["Compartir un libro familiar", "Share a family book", "Ein Familienbuch teilen", "Partager un livre familial", "Condividere un libro di famiglia", "Partilhar um livro familiar"],
      ["Preguntar por primeras lecturas", "Ask about first reads", "Nach ersten Lektueren fragen", "Demander les premieres lectures", "Chiedere le prime letture", "Perguntar pelas primeiras leituras"],
    ],
  }),
  readingTopic({
    topic: [
      "Una escena que hizo reir.",
      "A scene that made you laugh.",
      "Eine Szene, die dich lachen liess.",
      "Une scene qui vous a fait rire.",
      "Una scena che ti ha fatto ridere.",
      "Uma cena que o fez rir.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy dejamos espacio para humor suave, malentendidos y pequenas sonrisas.",
      "Hello, I'm Isabel. Today we make room for gentle humour, mix-ups and small smiles.",
      "Hallo, ich bin Isabel. Heute ist Platz fuer sanften Humor, Verwechslungen und kleine Laecheln.",
      "Bonjour, je suis Isabel. Aujourd'hui, place a l'humour doux, aux quiproquos et aux petits sourires.",
      "Ciao, sono Isabel. Oggi spazio a umorismo gentile, equivoci e piccoli sorrisi.",
      "Ola, sou a Isabel. Hoje ha lugar para humor suave, enganos e pequenos sorrisos.",
    ],
    contentTitle: [
      "Humor en la mesa",
      "Humour at the table",
      "Humor am Tisch",
      "Humour a la table",
      "Umorismo al tavolo",
      "Humor a mesa",
    ],
    contentBody: [
      "Cuenta una escena divertida en tus palabras, sin tener que recordar el final.",
      "Tell a funny scene in your own words, without needing to remember the ending.",
      "Erzaehle eine lustige Szene in eigenen Worten, ohne das Ende erinnern zu muessen.",
      "Racontez une scene drole avec vos mots, sans devoir rappeler la fin.",
      "Racconta una scena divertente con parole tue, senza ricordare il finale.",
      "Conte uma cena divertida pelas suas palavras, sem precisar lembrar o final.",
    ],
    options: [
      ["Compartir una sonrisa", "Share a smile", "Ein Laecheln teilen", "Partager un sourire", "Condividere un sorriso", "Partilhar um sorriso"],
      ["Pedir lecturas ligeras", "Ask for light reading", "Leichte Lektuere erbitten", "Demander une lecture legere", "Chiedere letture leggere", "Pedir leituras leves"],
      ["Recordar un malentendido", "Remember a mix-up", "Eine Verwechslung erinnern", "Se souvenir d'un quiproquo", "Ricordare un equivoco", "Recordar um engano"],
    ],
  }),
  readingTopic({
    topic: [
      "Un libro para releer.",
      "A book to reread.",
      "Ein Buch zum Wiederlesen.",
      "Un livre a relire.",
      "Un libro da rileggere.",
      "Um livro para reler.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy hablamos de libros que cambian cuando volvemos a ellos.",
      "Hello, I'm Isabel. Today we talk about books that change when we return to them.",
      "Hallo, ich bin Isabel. Heute sprechen wir ueber Buecher, die sich beim Wiederlesen veraendern.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous parlons de livres qui changent quand on y revient.",
      "Ciao, sono Isabel. Oggi parliamo di libri che cambiano quando torniamo a leggerli.",
      "Ola, sou a Isabel. Hoje falamos de livros que mudam quando voltamos a eles.",
    ],
    contentTitle: [
      "Volver a una pagina",
      "Returning to a page",
      "Zu einer Seite zurueck",
      "Retourner a une page",
      "Tornare a una pagina",
      "Voltar a uma pagina",
    ],
    contentBody: [
      "Puedes contar que viste distinto: una frase, una edad, una amistad o una decision.",
      "Share what felt different: a line, an age, a friendship or a decision.",
      "Teile, was anders wirkte: Zeile, Alter, Freundschaft oder Entscheidung.",
      "Partagez ce qui semblait different : phrase, age, amitie ou decision.",
      "Condividi cosa sembrava diverso: frase, eta, amicizia o decisione.",
      "Partilhe o que pareceu diferente: frase, idade, amizade ou decisao.",
    ],
    options: [
      ["Nombrar una relectura", "Name a reread", "Eine Wiederlekture nennen", "Nommer une relecture", "Nominare una rilettura", "Nomear uma releitura"],
      ["Contar que cambio", "Tell what changed", "Sagen, was sich aenderte", "Dire ce qui a change", "Dire cosa e cambiato", "Contar o que mudou"],
      ["Buscar un viejo favorito", "Find an old favourite", "Einen alten Favoriten finden", "Trouver un ancien favori", "Trovare un vecchio preferito", "Encontrar um velho favorito"],
    ],
  }),
  readingTopic({
    topic: [
      "Noticias, diarios y paginas de historia.",
      "News, journals and pages of history.",
      "Nachrichten, Tagebuecher und Geschichtsseiten.",
      "Nouvelles, journaux et pages d'histoire.",
      "Notizie, diari e pagine di storia.",
      "Noticias, diarios e paginas de historia.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy unimos lectura con el mundo vivido: periodicos, diarios y recuerdos de epoca.",
      "Hello, I'm Isabel. Today we connect reading with lived history: newspapers, journals and memories of an era.",
      "Hallo, ich bin Isabel. Heute verbinden wir Lesen mit erlebter Geschichte: Zeitungen, Tagebuecher und Epochen.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous relions lecture et histoire vecue : journaux, carnets et souvenirs d'epoque.",
      "Ciao, sono Isabel. Oggi uniamo lettura e storia vissuta: giornali, diari e ricordi di epoca.",
      "Ola, sou a Isabel. Hoje ligamos leitura e historia vivida: jornais, diarios e memorias de epoca.",
    ],
    contentTitle: [
      "Historia en voz baja",
      "History in a quiet voice",
      "Geschichte mit ruhiger Stimme",
      "Histoire a voix basse",
      "Storia a voce calma",
      "Historia em voz calma",
    ],
    contentBody: [
      "Elige una epoca, una noticia antigua o un diario que te hizo mirar de otro modo.",
      "Choose a period, an old news item or a journal that made you see differently.",
      "Waehle eine Zeit, alte Nachricht oder ein Tagebuch, das deinen Blick veraenderte.",
      "Choisissez une epoque, une ancienne nouvelle ou un carnet qui a change votre regard.",
      "Scegli un'epoca, una vecchia notizia o un diario che ti ha fatto vedere diversamente.",
      "Escolha uma epoca, uma noticia antiga ou um diario que mudou o seu olhar.",
    ],
    options: [
      ["Hablar de una epoca", "Talk about a period", "Ueber eine Zeit sprechen", "Parler d'une epoque", "Parlare di un'epoca", "Falar de uma epoca"],
      ["Compartir memoria historica", "Share a history memory", "Eine Geschichtserinnerung teilen", "Partager une memoire historique", "Condividere una memoria storica", "Partilhar uma memoria historica"],
      ["Pedir una biografia", "Ask for a biography", "Eine Biografie erbitten", "Demander une biographie", "Chiedere una biografia", "Pedir uma biografia"],
    ],
  }),
  readingTopic({
    topic: [
      "Teatro, dialogos y voces.",
      "Theatre, dialogue and voices.",
      "Theater, Dialoge und Stimmen.",
      "Theatre, dialogues et voix.",
      "Teatro, dialoghi e voci.",
      "Teatro, dialogos e vozes.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy escuchamos escenas como si una mesa pequena fuera un escenario.",
      "Hello, I'm Isabel. Today we hear scenes as if a small table were a stage.",
      "Hallo, ich bin Isabel. Heute hoeren wir Szenen, als waere ein kleiner Tisch eine Buehne.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous ecoutons des scenes comme si la table etait une scene.",
      "Ciao, sono Isabel. Oggi ascoltiamo scene come se un piccolo tavolo fosse un palco.",
      "Ola, sou a Isabel. Hoje ouvimos cenas como se uma pequena mesa fosse um palco.",
    ],
    contentTitle: [
      "Voces de escenario",
      "Stage voices",
      "Buehnenstimmen",
      "Voix de scene",
      "Voci di scena",
      "Vozes de palco",
    ],
    contentBody: [
      "Cuenta una escena hablada: teatro, cine, radio, lectura en voz alta o una frase familiar.",
      "Share a spoken scene: theatre, film, radio, reading aloud or a familiar phrase.",
      "Teile eine gesprochene Szene: Theater, Film, Radio, Vorlesen oder vertraute Worte.",
      "Partagez une scene parlee : theatre, film, radio, lecture a voix haute ou phrase familiere.",
      "Condividi una scena parlata: teatro, film, radio, lettura ad alta voce o frase familiare.",
      "Partilhe uma cena falada: teatro, filme, radio, leitura em voz alta ou frase familiar.",
    ],
    options: [
      ["Recordar una voz", "Remember a voice", "Eine Stimme erinnern", "Se souvenir d'une voix", "Ricordare una voce", "Recordar uma voz"],
      ["Hablar de teatro", "Talk about theatre", "Ueber Theater sprechen", "Parler de theatre", "Parlare di teatro", "Falar de teatro"],
      ["Leer una escena en palabras propias", "Retell a scene in my own words", "Eine Szene in eigenen Worten erzaehlen", "Redire une scene avec mes mots", "Raccontare una scena con parole mie", "Recontar uma cena pelas minhas palavras"],
    ],
  }),
  readingTopic({
    topic: [
      "Cuentos de infancia.",
      "Childhood stories.",
      "Kindheitsgeschichten.",
      "Histoires d'enfance.",
      "Storie d'infanzia.",
      "Historias de infancia.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy volvemos a cuentos, escuela, cama, cocina y primeras voces.",
      "Hello, I'm Isabel. Today we return to stories, school, bedtime, kitchens and first voices.",
      "Hallo, ich bin Isabel. Heute kehren wir zu Geschichten, Schule, Bettzeit, Kueche und ersten Stimmen zurueck.",
      "Bonjour, je suis Isabel. Aujourd'hui, retour aux contes, a l'ecole, au soir, a la cuisine et aux premieres voix.",
      "Ciao, sono Isabel. Oggi torniamo a racconti, scuola, sera, cucina e prime voci.",
      "Ola, sou a Isabel. Hoje voltamos a contos, escola, cama, cozinha e primeiras vozes.",
    ],
    contentTitle: [
      "Primeras historias",
      "First stories",
      "Erste Geschichten",
      "Premieres histoires",
      "Prime storie",
      "Primeiras historias",
    ],
    contentBody: [
      "Trae un cuento que escuchaste, leiste o inventaste, aunque solo quede una imagen.",
      "Bring a story you heard, read or invented, even if only one image remains.",
      "Bring eine Geschichte mit, die du hoertest, last oder erfandest, auch wenn nur ein Bild blieb.",
      "Apportez une histoire entendue, lue ou inventee, meme s'il ne reste qu'une image.",
      "Porta una storia ascoltata, letta o inventata, anche se resta solo un'immagine.",
      "Traga uma historia ouvida, lida ou inventada, mesmo que reste so uma imagem.",
    ],
    options: [
      ["Contar un cuento breve", "Tell a short story", "Eine kurze Geschichte erzaehlen", "Raconter une courte histoire", "Raccontare una storia breve", "Contar uma historia breve"],
      ["Recordar quien lo contaba", "Remember who told it", "Erinnern, wer sie erzaehlte", "Se rappeler qui la racontait", "Ricordare chi la raccontava", "Recordar quem a contava"],
      ["Pedir cuentos tranquilos", "Ask for calm stories", "Ruhige Geschichten erbitten", "Demander des histoires calmes", "Chiedere storie tranquille", "Pedir historias calmas"],
    ],
  }),
  readingTopic({
    topic: [
      "Comidas que aparecen en libros.",
      "Food that appears in books.",
      "Essen, das in Buechern auftaucht.",
      "Nourriture qui apparait dans les livres.",
      "Cibo che appare nei libri.",
      "Comida que aparece nos livros.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy la mesa huele a pan, sopa, cafe, fruta o fiesta recordada.",
      "Hello, I'm Isabel. Today the table smells of bread, soup, coffee, fruit or a remembered celebration.",
      "Hallo, ich bin Isabel. Heute riecht der Tisch nach Brot, Suppe, Kaffee, Obst oder einem Fest.",
      "Bonjour, je suis Isabel. Aujourd'hui, la table sent le pain, la soupe, le cafe, les fruits ou une fete.",
      "Ciao, sono Isabel. Oggi il tavolo profuma di pane, zuppa, caffe, frutta o festa ricordata.",
      "Ola, sou a Isabel. Hoje a mesa cheira a pao, sopa, cafe, fruta ou festa lembrada.",
    ],
    contentTitle: [
      "Sabores de pagina",
      "Flavours on the page",
      "Geschmack auf der Seite",
      "Saveurs de page",
      "Sapori di pagina",
      "Sabores de pagina",
    ],
    contentBody: [
      "Habla de una comida de una historia o de una comida que una historia te recordo.",
      "Talk about food in a story, or food a story made you remember.",
      "Sprich ueber Essen in einer Geschichte oder Essen, an das eine Geschichte erinnerte.",
      "Parlez d'un plat dans une histoire, ou d'un plat qu'une histoire vous a rappele.",
      "Parla di un cibo in una storia, o di un cibo che una storia ti ha ricordato.",
      "Fale de uma comida numa historia, ou de uma comida que uma historia lhe lembrou.",
    ],
    options: [
      ["Compartir un sabor", "Share a flavour", "Einen Geschmack teilen", "Partager une saveur", "Condividere un sapore", "Partilhar um sabor"],
      ["Recordar una cocina", "Remember a kitchen", "Eine Kueche erinnern", "Se souvenir d'une cuisine", "Ricordare una cucina", "Recordar uma cozinha"],
      ["Pedir historias con comida", "Ask for food stories", "Geschichten mit Essen erbitten", "Demander des histoires de cuisine", "Chiedere storie di cucina", "Pedir historias com comida"],
    ],
  }),
  readingTopic({
    topic: [
      "Viajes pequenos y grandes.",
      "Small and large journeys.",
      "Kleine und grosse Reisen.",
      "Petits et grands voyages.",
      "Piccoli e grandi viaggi.",
      "Pequenas e grandes viagens.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy puede viajar una maleta, una carta, un tren o solo una idea.",
      "Hello, I'm Isabel. Today a suitcase, a letter, a train or just an idea can travel.",
      "Hallo, ich bin Isabel. Heute kann ein Koffer, Brief, Zug oder nur eine Idee reisen.",
      "Bonjour, je suis Isabel. Aujourd'hui, une valise, une lettre, un train ou une idee peut voyager.",
      "Ciao, sono Isabel. Oggi puo viaggiare una valigia, una lettera, un treno o solo un'idea.",
      "Ola, sou a Isabel. Hoje pode viajar uma mala, uma carta, um comboio ou so uma ideia.",
    ],
    contentTitle: [
      "Historias de camino",
      "Stories on the road",
      "Geschichten unterwegs",
      "Histoires en chemin",
      "Storie in viaggio",
      "Historias em caminho",
    ],
    contentBody: [
      "Cuenta una historia de salida, regreso, mudanza o camino interior.",
      "Share a story of leaving, returning, moving home or travelling inward.",
      "Teile eine Geschichte vom Gehen, Heimkommen, Umziehen oder inneren Weg.",
      "Partagez une histoire de depart, retour, demenagement ou voyage interieur.",
      "Condividi una storia di partenza, ritorno, trasloco o viaggio interiore.",
      "Partilhe uma historia de partida, regresso, mudanca ou viagem interior.",
    ],
    options: [
      ["Contar un viaje", "Tell a journey", "Eine Reise erzaehlen", "Raconter un voyage", "Raccontare un viaggio", "Contar uma viagem"],
      ["Buscar relatos de camino", "Find journey stories", "Weggeschichten finden", "Trouver des recits de route", "Trovare racconti di viaggio", "Encontrar relatos de caminho"],
      ["Compartir un regreso", "Share a return", "Eine Rueckkehr teilen", "Partager un retour", "Condividere un ritorno", "Partilhar um regresso"],
    ],
  }),
  readingTopic({
    topic: [
      "Jardines, rios y paginas verdes.",
      "Gardens, rivers and green pages.",
      "Gaerten, Fluesse und gruene Seiten.",
      "Jardins, rivieres et pages vertes.",
      "Giardini, fiumi e pagine verdi.",
      "Jardins, rios e paginas verdes.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy buscamos naturaleza en libros y recuerdos: sombra, agua, flores, caminos.",
      "Hello, I'm Isabel. Today we look for nature in books and memories: shade, water, flowers, paths.",
      "Hallo, ich bin Isabel. Heute suchen wir Natur in Buechern und Erinnerungen: Schatten, Wasser, Blumen, Wege.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous cherchons la nature dans livres et souvenirs : ombre, eau, fleurs, chemins.",
      "Ciao, sono Isabel. Oggi cerchiamo natura in libri e ricordi: ombra, acqua, fiori, sentieri.",
      "Ola, sou a Isabel. Hoje procuramos natureza em livros e memorias: sombra, agua, flores, caminhos.",
    ],
    contentTitle: [
      "Naturaleza que acompana",
      "Nature that keeps company",
      "Natur, die begleitet",
      "Nature qui accompagne",
      "Natura che fa compagnia",
      "Natureza que acompanha",
    ],
    contentBody: [
      "Elige un paisaje de lectura o un lugar natural que una historia te devolvio.",
      "Choose a reading landscape or a natural place a story brought back to you.",
      "Waehle eine Leselandschaft oder einen Naturort, den eine Geschichte zurueckbrachte.",
      "Choisissez un paysage de lecture ou un lieu naturel qu'une histoire a ramene.",
      "Scegli un paesaggio di lettura o un luogo naturale che una storia ha riportato.",
      "Escolha uma paisagem de leitura ou um lugar natural que uma historia trouxe de volta.",
    ],
    options: [
      ["Describir un jardin", "Describe a garden", "Einen Garten beschreiben", "Decrire un jardin", "Descrivere un giardino", "Descrever um jardim"],
      ["Hablar de un rio", "Talk about a river", "Ueber einen Fluss sprechen", "Parler d'une riviere", "Parlare di un fiume", "Falar de um rio"],
      ["Pedir libros tranquilos", "Ask for calm books", "Ruhige Buecher erbitten", "Demander des livres calmes", "Chiedere libri calmi", "Pedir livros calmos"],
    ],
  }),
  readingTopic({
    topic: [
      "Amistades en las historias.",
      "Friendships in stories.",
      "Freundschaften in Geschichten.",
      "Amities dans les histoires.",
      "Amicizie nelle storie.",
      "Amizades nas historias.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy miramos amistades de papel y amistades que la lectura puede abrir.",
      "Hello, I'm Isabel. Today we look at friendships on the page and friendships reading can open.",
      "Hallo, ich bin Isabel. Heute schauen wir auf Freundschaften auf Seiten und solche, die Lesen oeffnet.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous regardons les amities sur la page et celles que la lecture ouvre.",
      "Ciao, sono Isabel. Oggi guardiamo amicizie sulle pagine e amicizie che la lettura puo aprire.",
      "Ola, sou a Isabel. Hoje olhamos amizades nas paginas e amizades que a leitura pode abrir.",
    ],
    contentTitle: [
      "Leer en compania",
      "Reading in company",
      "Lesen in Gesellschaft",
      "Lire en compagnie",
      "Leggere in compagnia",
      "Ler em companhia",
    ],
    contentBody: [
      "Cuenta una amistad de un libro o una amistad real que nacio alrededor de historias.",
      "Share a friendship from a book or a real friendship that grew around stories.",
      "Teile eine Freundschaft aus einem Buch oder eine echte, die um Geschichten wuchs.",
      "Partagez une amitie d'un livre ou une vraie amitie nee autour des histoires.",
      "Condividi un'amicizia di un libro o una reale nata intorno alle storie.",
      "Partilhe uma amizade de um livro ou uma amizade real nascida em torno de historias.",
    ],
    options: [
      ["Nombrar una amistad", "Name a friendship", "Eine Freundschaft nennen", "Nommer une amitie", "Nominare un'amicizia", "Nomear uma amizade"],
      ["Buscar lector afin", "Find a kindred reader", "Eine passende Leserin finden", "Trouver une personne proche", "Trovare un lettore affine", "Encontrar leitor parecido"],
      ["Compartir una pregunta amable", "Share a kind question", "Eine freundliche Frage teilen", "Partager une question douce", "Condividere una domanda gentile", "Partilhar uma pergunta gentil"],
    ],
  }),
  readingTopic({
    topic: [
      "Cartas, diarios y notas.",
      "Letters, diaries and notes.",
      "Briefe, Tagebuecher und Notizen.",
      "Lettres, journaux et notes.",
      "Lettere, diari e note.",
      "Cartas, diarios e notas.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy leemos lo pequeno: cartas, listas, diarios y notas guardadas.",
      "Hello, I'm Isabel. Today we read the small things: letters, lists, diaries and saved notes.",
      "Hallo, ich bin Isabel. Heute lesen wir das Kleine: Briefe, Listen, Tagebuecher und bewahrte Notizen.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous lisons les petites choses : lettres, listes, carnets et notes gardees.",
      "Ciao, sono Isabel. Oggi leggiamo le cose piccole: lettere, liste, diari e note conservate.",
      "Ola, sou a Isabel. Hoje lemos coisas pequenas: cartas, listas, diarios e notas guardadas.",
    ],
    contentTitle: [
      "Palabras guardadas",
      "Saved words",
      "Bewahrte Worte",
      "Mots gardes",
      "Parole conservate",
      "Palavras guardadas",
    ],
    contentBody: [
      "Habla de una carta real o inventada, un diario o una nota que dice mucho con poco.",
      "Talk about a real or imagined letter, a diary or a note that says much with little.",
      "Sprich ueber echten oder erfundenen Brief, Tagebuch oder Notiz, die mit wenig viel sagt.",
      "Parlez d'une lettre reelle ou imaginee, d'un journal ou d'une note qui dit beaucoup.",
      "Parla di una lettera reale o immaginata, un diario o una nota che dice molto.",
      "Fale de uma carta real ou imaginada, um diario ou uma nota que diz muito.",
    ],
    options: [
      ["Escribir una nota breve", "Write a short note", "Eine kurze Notiz schreiben", "Ecrire une courte note", "Scrivere una nota breve", "Escrever uma nota breve"],
      ["Recordar una carta", "Remember a letter", "Einen Brief erinnern", "Se souvenir d'une lettre", "Ricordare una lettera", "Recordar uma carta"],
      ["Preguntar por diarios", "Ask about diaries", "Nach Tagebuechern fragen", "Demander des journaux", "Chiedere diari", "Perguntar por diarios"],
    ],
  }),
  readingTopic({
    topic: [
      "Misterios sin prisa.",
      "Mysteries without rushing.",
      "Raetsel ohne Eile.",
      "Mysteres sans se presser.",
      "Misteri senza fretta.",
      "Misterios sem pressa.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy seguimos pistas suaves: curiosidad, detalles y finales tranquilos.",
      "Hello, I'm Isabel. Today we follow gentle clues: curiosity, details and calm endings.",
      "Hallo, ich bin Isabel. Heute folgen wir sanften Spuren: Neugier, Details und ruhige Enden.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous suivons des indices doux : curiosite, details et fins calmes.",
      "Ciao, sono Isabel. Oggi seguiamo indizi gentili: curiosita, dettagli e finali calmi.",
      "Ola, sou a Isabel. Hoje seguimos pistas suaves: curiosidade, detalhes e finais calmos.",
    ],
    contentTitle: [
      "Pistas amables",
      "Gentle clues",
      "Freundliche Spuren",
      "Indices doux",
      "Indizi gentili",
      "Pistas gentis",
    ],
    contentBody: [
      "Comparte un misterio que disfrutaste por la atmosfera, no por la tension.",
      "Share a mystery you enjoyed for its atmosphere, not its tension.",
      "Teile ein Raetsel, das du wegen der Stimmung mochtest, nicht wegen Spannung.",
      "Partagez un mystere aime pour son atmosphere, pas pour la tension.",
      "Condividi un mistero amato per l'atmosfera, non per la tensione.",
      "Partilhe um misterio apreciado pela atmosfera, nao pela tensao.",
    ],
    options: [
      ["Pedir misterio suave", "Ask for a gentle mystery", "Ein sanftes Raetsel erbitten", "Demander un mystere doux", "Chiedere un mistero gentile", "Pedir misterio suave"],
      ["Compartir una pista", "Share a clue", "Eine Spur teilen", "Partager un indice", "Condividere un indizio", "Partilhar uma pista"],
      ["Hablar de atmosfera", "Talk about atmosphere", "Ueber Stimmung sprechen", "Parler d'atmosphere", "Parlare di atmosfera", "Falar de atmosfera"],
    ],
  }),
  readingTopic({
    topic: [
      "Estaciones en los libros.",
      "Seasons in books.",
      "Jahreszeiten in Buechern.",
      "Saisons dans les livres.",
      "Stagioni nei libri.",
      "Estacoes nos livros.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy leemos clima: verano, lluvia, nieve, viento, tarde larga.",
      "Hello, I'm Isabel. Today we read weather: summer, rain, snow, wind, a long afternoon.",
      "Hallo, ich bin Isabel. Heute lesen wir Wetter: Sommer, Regen, Schnee, Wind, langer Nachmittag.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous lisons le temps : ete, pluie, neige, vent, long apres-midi.",
      "Ciao, sono Isabel. Oggi leggiamo il tempo: estate, pioggia, neve, vento, lungo pomeriggio.",
      "Ola, sou a Isabel. Hoje lemos o tempo: verao, chuva, neve, vento, tarde longa.",
    ],
    contentTitle: [
      "El tiempo de una historia",
      "A story's weather",
      "Das Wetter einer Geschichte",
      "Le temps d'une histoire",
      "Il tempo di una storia",
      "O tempo de uma historia",
    ],
    contentBody: [
      "Elige una estacion que te guste leer o una que te recuerde una etapa de vida.",
      "Choose a season you like to read, or one that reminds you of a time in life.",
      "Waehle eine Jahreszeit zum Lesen oder eine, die an eine Lebenszeit erinnert.",
      "Choisissez une saison a lire, ou une qui rappelle un moment de vie.",
      "Scegli una stagione da leggere o una che ricorda un periodo della vita.",
      "Escolha uma estacao para ler ou uma que recorde uma fase da vida.",
    ],
    options: [
      ["Elegir una estacion", "Choose a season", "Eine Jahreszeit waehlen", "Choisir une saison", "Scegliere una stagione", "Escolher uma estacao"],
      ["Compartir una tarde", "Share an afternoon", "Einen Nachmittag teilen", "Partager un apres-midi", "Condividere un pomeriggio", "Partilhar uma tarde"],
      ["Pedir lectura de lluvia", "Ask for rainy reading", "Regenlekture erbitten", "Demander une lecture de pluie", "Chiedere letture da pioggia", "Pedir leitura de chuva"],
    ],
  }),
  readingTopic({
    topic: [
      "Musica dentro de una historia.",
      "Music inside a story.",
      "Musik in einer Geschichte.",
      "Musique dans une histoire.",
      "Musica dentro una storia.",
      "Musica dentro de uma historia.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy buscamos canciones, bailes, campanas o silencios que una lectura despierta.",
      "Hello, I'm Isabel. Today we look for songs, dances, bells or silences a reading awakens.",
      "Hallo, ich bin Isabel. Heute suchen wir Lieder, Taenze, Glocken oder Stille, die Lesen weckt.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous cherchons chansons, danses, cloches ou silences eveilles par la lecture.",
      "Ciao, sono Isabel. Oggi cerchiamo canzoni, danze, campane o silenzi risvegliati dalla lettura.",
      "Ola, sou a Isabel. Hoje procuramos cancoes, dancas, sinos ou silencios que a leitura desperta.",
    ],
    contentTitle: [
      "Lecturas que suenan",
      "Reading that sounds",
      "Lesen, das klingt",
      "Lectures qui sonnent",
      "Letture che suonano",
      "Leituras que soam",
    ],
    contentBody: [
      "Cuenta una musica que una escena trae o una historia que parece tener ritmo.",
      "Share music a scene brings back, or a story that seems to have rhythm.",
      "Teile Musik, die eine Szene bringt, oder eine Geschichte mit Rhythmus.",
      "Partagez une musique ramenee par une scene, ou une histoire qui a du rythme.",
      "Condividi una musica portata da una scena, o una storia che ha ritmo.",
      "Partilhe uma musica trazida por uma cena, ou uma historia com ritmo.",
    ],
    options: [
      ["Compartir una cancion", "Share a song", "Ein Lied teilen", "Partager une chanson", "Condividere una canzone", "Partilhar uma cancao"],
      ["Hablar de ritmo", "Talk about rhythm", "Ueber Rhythmus sprechen", "Parler de rythme", "Parlare di ritmo", "Falar de ritmo"],
      ["Buscar libros con musica", "Find books with music", "Buecher mit Musik finden", "Trouver des livres avec musique", "Trovare libri con musica", "Encontrar livros com musica"],
    ],
  }),
  readingTopic({
    topic: [
      "Historias de otros paises.",
      "Stories from other countries.",
      "Geschichten aus anderen Laendern.",
      "Histoires d'autres pays.",
      "Storie da altri paesi.",
      "Historias de outros paises.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy viajamos con respeto: nombres, costumbres, casas y palabras nuevas.",
      "Hello, I'm Isabel. Today we travel with respect: names, customs, homes and new words.",
      "Hallo, ich bin Isabel. Heute reisen wir mit Respekt: Namen, Gewohnheiten, Haeuser und neue Worte.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous voyageons avec respect : noms, coutumes, maisons et mots nouveaux.",
      "Ciao, sono Isabel. Oggi viaggiamo con rispetto: nomi, usanze, case e parole nuove.",
      "Ola, sou a Isabel. Hoje viajamos com respeito: nomes, costumes, casas e palavras novas.",
    ],
    contentTitle: [
      "Un mundo compartido",
      "A shared world",
      "Eine geteilte Welt",
      "Un monde partage",
      "Un mondo condiviso",
      "Um mundo partilhado",
    ],
    contentBody: [
      "Comparte una historia que te acerco a otro lugar o una pregunta que te dejo.",
      "Share a story that brought another place closer, or a question it left with you.",
      "Teile eine Geschichte, die einen Ort naeher brachte, oder eine Frage, die blieb.",
      "Partagez une histoire qui a rapproche un lieu, ou une question qu'elle a laissee.",
      "Condividi una storia che ha avvicinato un luogo, o una domanda rimasta.",
      "Partilhe uma historia que aproximou outro lugar, ou uma pergunta que deixou.",
    ],
    options: [
      ["Nombrar un pais", "Name a country", "Ein Land nennen", "Nommer un pays", "Nominare un paese", "Nomear um pais"],
      ["Compartir una costumbre", "Share a custom", "Eine Gewohnheit teilen", "Partager une coutume", "Condividere un'usanza", "Partilhar um costume"],
      ["Pedir lectura viajera", "Ask for travelling reading", "Reiselekture erbitten", "Demander une lecture voyageuse", "Chiedere letture di viaggio", "Pedir leitura viajante"],
    ],
  }),
  readingTopic({
    topic: [
      "Valor en momentos tranquilos.",
      "Courage in quiet moments.",
      "Mut in ruhigen Momenten.",
      "Courage dans les moments calmes.",
      "Coraggio nei momenti tranquilli.",
      "Coragem nos momentos calmos.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy miramos decisiones pequenas que muestran mucha fuerza.",
      "Hello, I'm Isabel. Today we look at small decisions that show a lot of strength.",
      "Hallo, ich bin Isabel. Heute schauen wir auf kleine Entscheidungen mit viel Staerke.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous regardons de petites decisions qui montrent beaucoup de force.",
      "Ciao, sono Isabel. Oggi guardiamo piccole decisioni che mostrano molta forza.",
      "Ola, sou a Isabel. Hoje olhamos pequenas decisoes que mostram muita forca.",
    ],
    contentTitle: [
      "Fuerza discreta",
      "Quiet strength",
      "Stille Staerke",
      "Force discrete",
      "Forza discreta",
      "Forca discreta",
    ],
    contentBody: [
      "Habla de un personaje o persona real que hizo algo valiente sin ruido.",
      "Talk about a character or real person who did something brave without noise.",
      "Sprich ueber Figur oder echte Person, die still etwas Mutiges tat.",
      "Parlez d'un personnage ou d'une personne reelle qui a agi avec courage sans bruit.",
      "Parla di un personaggio o persona reale che ha fatto qualcosa di coraggioso in silenzio.",
      "Fale de uma personagem ou pessoa real que fez algo corajoso em silencio.",
    ],
    options: [
      ["Compartir un acto pequeno", "Share a small act", "Eine kleine Tat teilen", "Partager un petit geste", "Condividere un piccolo gesto", "Partilhar um pequeno gesto"],
      ["Buscar historias de valor", "Find stories of courage", "Mutgeschichten finden", "Trouver des histoires de courage", "Trovare storie di coraggio", "Encontrar historias de coragem"],
      ["Agradecer una fuerza", "Thank a strength", "Einer Staerke danken", "Remercier une force", "Ringraziare una forza", "Agradecer uma forca"],
    ],
  }),
  readingTopic({
    topic: [
      "Portadas y primeras impresiones.",
      "Covers and first impressions.",
      "Umschlaege und erste Eindruecke.",
      "Couvertures et premieres impressions.",
      "Copertine e prime impressioni.",
      "Capas e primeiras impressoes.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy miramos como elegimos: color, titulo, letra, tamano o una imagen.",
      "Hello, I'm Isabel. Today we look at how we choose: colour, title, lettering, size or an image.",
      "Hallo, ich bin Isabel. Heute schauen wir, wie wir waehlen: Farbe, Titel, Schrift, Groesse oder Bild.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous regardons comment choisir : couleur, titre, lettres, taille ou image.",
      "Ciao, sono Isabel. Oggi guardiamo come scegliamo: colore, titolo, carattere, formato o immagine.",
      "Ola, sou a Isabel. Hoje olhamos como escolhemos: cor, titulo, letra, tamanho ou imagem.",
    ],
    contentTitle: [
      "La puerta del libro",
      "The book's doorway",
      "Die Tuer des Buches",
      "La porte du livre",
      "La porta del libro",
      "A porta do livro",
    ],
    contentBody: [
      "Cuenta una portada que te atrajo o una primera pagina que te invito a seguir.",
      "Share a cover that drew you in, or a first page that invited you onward.",
      "Teile einen Umschlag, der dich anzog, oder eine erste Seite, die weiterfuehrte.",
      "Partagez une couverture attirante ou une premiere page qui invitait a continuer.",
      "Condividi una copertina che ti ha attirato o una prima pagina che invitava a continuare.",
      "Partilhe uma capa que o atraiu ou uma primeira pagina que convidou a continuar.",
    ],
    options: [
      ["Describir una portada", "Describe a cover", "Einen Umschlag beschreiben", "Decrire une couverture", "Descrivere una copertina", "Descrever uma capa"],
      ["Hablar del titulo", "Talk about the title", "Ueber den Titel sprechen", "Parler du titre", "Parlare del titolo", "Falar do titulo"],
      ["Elegir por animo", "Choose by mood", "Nach Stimmung waehlen", "Choisir par humeur", "Scegliere per umore", "Escolher pelo humor"],
    ],
  }),
  readingTopic({
    topic: [
      "Finales que dejan esperanza.",
      "Endings that leave hope.",
      "Enden, die Hoffnung lassen.",
      "Fins qui laissent de l'espoir.",
      "Finali che lasciano speranza.",
      "Finais que deixam esperanca.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy hablamos de finales suaves, abiertos o reparadores, sin contar demasiado.",
      "Hello, I'm Isabel. Today we talk about gentle, open or healing endings without giving too much away.",
      "Hallo, ich bin Isabel. Heute sprechen wir ueber sanfte, offene oder heilende Enden, ohne zu viel zu verraten.",
      "Bonjour, je suis Isabel. Aujourd'hui, parlons de fins douces, ouvertes ou reparatrices, sans trop devoiler.",
      "Ciao, sono Isabel. Oggi parliamo di finali gentili, aperti o riparatori, senza svelare troppo.",
      "Ola, sou a Isabel. Hoje falamos de finais suaves, abertos ou reparadores, sem revelar demais.",
    ],
    contentTitle: [
      "Cerrar con cuidado",
      "Closing with care",
      "Mit Sorgfalt schliessen",
      "Finir avec soin",
      "Chiudere con cura",
      "Fechar com cuidado",
    ],
    contentBody: [
      "Comparte como te gusta que una historia te deje: tranquilo, curioso, acompanado o con luz.",
      "Share how you like a story to leave you: calm, curious, accompanied or with light.",
      "Teile, wie eine Geschichte dich zuruecklassen soll: ruhig, neugierig, begleitet oder hell.",
      "Partagez comment une histoire doit vous laisser : calme, curieux, accompagne ou lumineux.",
      "Condividi come vuoi che una storia ti lasci: calmo, curioso, accompagnato o con luce.",
      "Partilhe como gosta que uma historia o deixe: calmo, curioso, acompanhado ou com luz.",
    ],
    options: [
      ["Pedir final esperanzador", "Ask for a hopeful ending", "Ein hoffnungsvolles Ende erbitten", "Demander une fin pleine d'espoir", "Chiedere un finale di speranza", "Pedir final esperancoso"],
      ["Hablar sin spoilers", "Talk without spoilers", "Ohne Spoiler sprechen", "Parler sans devoiler", "Parlare senza spoiler", "Falar sem revelar"],
      ["Compartir una sensacion final", "Share an ending feeling", "Ein Endgefuehl teilen", "Partager un sentiment final", "Condividere una sensazione finale", "Partilhar uma sensacao final"],
    ],
  }),
  readingTopic({
    topic: [
      "Leer en voz alta.",
      "Reading aloud.",
      "Laut vorlesen.",
      "Lire a voix haute.",
      "Leggere ad alta voce.",
      "Ler em voz alta.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy recordamos voces que leian: casa, escuela, radio, club o una persona querida.",
      "Hello, I'm Isabel. Today we remember reading voices: home, school, radio, club or someone dear.",
      "Hallo, ich bin Isabel. Heute erinnern wir Lesestimmen: Zuhause, Schule, Radio, Club oder liebe Person.",
      "Bonjour, je suis Isabel. Aujourd'hui, nous rappelons des voix qui lisaient : maison, ecole, radio, club ou proche.",
      "Ciao, sono Isabel. Oggi ricordiamo voci che leggevano: casa, scuola, radio, club o persona cara.",
      "Ola, sou a Isabel. Hoje recordamos vozes que liam: casa, escola, radio, clube ou alguem querido.",
    ],
    contentTitle: [
      "Voces lectoras",
      "Reading voices",
      "Lesestimmen",
      "Voix de lecture",
      "Voci di lettura",
      "Vozes de leitura",
    ],
    contentBody: [
      "No hace falta leer un texto largo; cuenta que voz o ritmo te gustaba escuchar.",
      "No long text is needed; share what voice or rhythm you liked hearing.",
      "Kein langer Text noetig; teile, welche Stimme oder welches Tempo du gern hoertest.",
      "Pas besoin de long texte; partagez quelle voix ou quel rythme vous aimiez entendre.",
      "Non serve un testo lungo; condividi quale voce o ritmo ti piaceva ascoltare.",
      "Nao e preciso texto longo; partilhe que voz ou ritmo gostava de ouvir.",
    ],
    options: [
      ["Recordar una voz lectora", "Remember a reading voice", "Eine Lesestimme erinnern", "Se rappeler une voix lectrice", "Ricordare una voce lettrice", "Recordar uma voz leitora"],
      ["Compartir ritmo tranquilo", "Share a calm rhythm", "Ruhiges Tempo teilen", "Partager un rythme calme", "Condividere un ritmo calmo", "Partilhar ritmo calmo"],
      ["Pedir lectura acompanada", "Ask for accompanied reading", "Begleitetes Lesen erbitten", "Demander une lecture accompagnee", "Chiedere lettura accompagnata", "Pedir leitura acompanhada"],
    ],
  }),
  readingTopic({
    topic: [
      "Recomendar por estado de animo.",
      "Recommend by mood.",
      "Nach Stimmung empfehlen.",
      "Recommander par humeur.",
      "Consigliare per umore.",
      "Recomendar por humor.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy no pedimos el libro perfecto, solo una sugerencia amable para un animo concreto.",
      "Hello, I'm Isabel. Today we do not need the perfect book, just a kind suggestion for a particular mood.",
      "Hallo, ich bin Isabel. Heute brauchen wir kein perfektes Buch, nur eine freundliche Empfehlung fuer eine Stimmung.",
      "Bonjour, je suis Isabel. Aujourd'hui, pas besoin du livre parfait, seulement une suggestion douce pour une humeur.",
      "Ciao, sono Isabel. Oggi non serve il libro perfetto, solo un consiglio gentile per un umore.",
      "Ola, sou a Isabel. Hoje nao precisamos do livro perfeito, so uma sugestao gentil para um humor.",
    ],
    contentTitle: [
      "El estante del animo",
      "The mood shelf",
      "Das Stimmungsregal",
      "L'etagere des humeurs",
      "Lo scaffale dell'umore",
      "A prateleira do humor",
    ],
    contentBody: [
      "Elige compania, memoria, risa, calma o curiosidad, y deja una recomendacion breve.",
      "Choose company, memory, laughter, calm or curiosity, and leave a brief recommendation.",
      "Waehle Begleitung, Erinnerung, Lachen, Ruhe oder Neugier und hinterlasse eine kurze Empfehlung.",
      "Choisissez compagnie, souvenir, rire, calme ou curiosite, puis laissez une breve recommandation.",
      "Scegli compagnia, memoria, risata, calma o curiosita, e lascia un consiglio breve.",
      "Escolha companhia, memoria, riso, calma ou curiosidade, e deixe uma recomendacao breve.",
    ],
    options: [
      ["Recomendar algo calmo", "Recommend something calm", "Etwas Ruhiges empfehlen", "Recommander quelque chose de calme", "Consigliare qualcosa di calmo", "Recomendar algo calmo"],
      ["Pedir algo divertido", "Ask for something funny", "Etwas Lustiges erbitten", "Demander quelque chose de drole", "Chiedere qualcosa di divertente", "Pedir algo divertido"],
      ["Dejar una nota breve", "Leave a brief note", "Eine kurze Notiz lassen", "Laisser une breve note", "Lasciare una nota breve", "Deixar uma nota breve"],
    ],
  }),
  readingTopic({
    topic: [
      "Trabajos, oficios y manos.",
      "Work, crafts and hands.",
      "Arbeit, Handwerk und Haende.",
      "Travail, metiers et mains.",
      "Lavoro, mestieri e mani.",
      "Trabalho, oficios e maos.",
    ],
    opener: [
      "Hola, soy Isabel. Hoy miramos historias de panaderos, maestras, costureras, medicos, agricultores y oficios.",
      "Hello, I'm Isabel. Today we look at stories of bakers, teachers, seamstresses, doctors, farmers and trades.",
      "Hallo, ich bin Isabel. Heute schauen wir Geschichten von Baeckern, Lehrern, Naeherinnen, Aerzten, Bauern und Berufen an.",
      "Bonjour, je suis Isabel. Aujourd'hui, histoires de boulangers, professeurs, couturieres, medecins, agriculteurs et metiers.",
      "Ciao, sono Isabel. Oggi storie di fornai, insegnanti, sarte, medici, agricoltori e mestieri.",
      "Ola, sou a Isabel. Hoje historias de padeiros, professores, costureiras, medicos, agricultores e oficios.",
    ],
    contentTitle: [
      "Historias de oficio",
      "Stories of craft",
      "Berufsgeschichten",
      "Histoires de metier",
      "Storie di mestiere",
      "Historias de oficio",
    ],
    contentBody: [
      "Cuenta una habilidad de una historia o de tu vida que merezca ser recordada.",
      "Share a skill from a story or your life that deserves to be remembered.",
      "Teile eine Faehigkeit aus Geschichte oder Leben, die Erinnerung verdient.",
      "Partagez une competence d'une histoire ou de votre vie qui merite memoire.",
      "Condividi un'abilita di una storia o della tua vita che merita memoria.",
      "Partilhe uma habilidade de uma historia ou da sua vida que merece memoria.",
    ],
    options: [
      ["Nombrar un oficio", "Name a craft", "Ein Handwerk nennen", "Nommer un metier", "Nominare un mestiere", "Nomear um oficio"],
      ["Compartir una habilidad", "Share a skill", "Eine Faehigkeit teilen", "Partager une competence", "Condividere un'abilita", "Partilhar uma habilidade"],
      ["Buscar historias de trabajo", "Find work stories", "Arbeitsgeschichten finden", "Trouver des histoires de travail", "Trovare storie di lavoro", "Encontrar historias de trabalho"],
    ],
  }),
  readingTopic({
    topic: [
      "Manana abrimos otro estante.",
      "Tomorrow we open another shelf.",
      "Morgen oeffnen wir ein anderes Regal.",
      "Demain, nous ouvrons une autre etagere.",
      "Domani apriamo un altro scaffale.",
      "Amanha abrimos outra prateleira.",
    ],
    opener: [
      "Hola, soy Isabel. Cerramos el mes con una pregunta sencilla: que tema quieres volver a encontrar?",
      "Hello, I'm Isabel. We close the month with a simple question: what theme would you like to meet again?",
      "Hallo, ich bin Isabel. Wir schliessen den Monat mit einer einfachen Frage: Welches Thema moechtest du wiederfinden?",
      "Bonjour, je suis Isabel. Nous terminons le mois par une question simple : quel theme voulez-vous retrouver ?",
      "Ciao, sono Isabel. Chiudiamo il mese con una domanda semplice: quale tema vuoi ritrovare?",
      "Ola, sou a Isabel. Fechamos o mes com uma pergunta simples: que tema gostaria de reencontrar?",
    ],
    contentTitle: [
      "El club sigue",
      "The club continues",
      "Der Club geht weiter",
      "Le club continue",
      "Il club continua",
      "O clube continua",
    ],
    contentBody: [
      "Elige el estante que te gustaria repetir: memorias, poesia, historias breves, amistad o recomendaciones.",
      "Choose the shelf you would like to repeat: memoirs, poetry, short stories, friendship or recommendations.",
      "Waehle das Regal, das du wiederholen moechtest: Memoiren, Poesie, Kurzgeschichten, Freundschaft oder Empfehlungen.",
      "Choisissez l'etagere a retrouver : memoires, poesie, nouvelles, amitie ou recommandations.",
      "Scegli lo scaffale da ritrovare: memorie, poesia, racconti brevi, amicizia o consigli.",
      "Escolha a prateleira a repetir: memorias, poesia, contos, amizade ou recomendacoes.",
    ],
    options: [
      ["Votar el proximo estante", "Vote for the next shelf", "Fuer das naechste Regal stimmen", "Voter pour la prochaine etagere", "Votare il prossimo scaffale", "Votar na proxima prateleira"],
      ["Agradecer una conversacion", "Thank a conversation", "Fuer ein Gespraech danken", "Remercier une conversation", "Ringraziare una conversazione", "Agradecer uma conversa"],
      ["Guardar una idea para manana", "Save an idea for tomorrow", "Eine Idee fuer morgen merken", "Garder une idee pour demain", "Salvare un'idea per domani", "Guardar uma ideia para amanha"],
    ],
  }),
];

export const socialRoomSeeds: SocialRoomSeed[] = [
  room({
    slug: "garden-corner",
    names: t("Rincón del jardín", "Garden Corner", "Gartenecke"),
    category: "activity",
    agentSlug: "elena-ruiz",
    agentFullName: "Elena Ruiz",
    agentColour: "#16A34A",
    agentCredential: t("Jardinera urbana", "Urban gardener", "Stadtgärtnerin"),
    ctaLabel: t("Entrar", "Enter", "Eintreten"),
    topicTags: ["plants", "garden", "home", "nature"],
    timeSlots: ["morning", "afternoon"],
    featured: true,
    memberCount: 7,
    sortOrder: 10,
    dailyTopics: [
      {
        topic: t(
          "Plantas alegres para una ventana luminosa.",
          "Cheerful plants for a bright window.",
          "Freundliche Pflanzen für ein helles Fenster.",
        ),
        opener: t(
          "Hola, soy Elena. ¿Qué planta te acompaña en casa?",
          "Hello, I'm Elena. Which plant keeps you company at home?",
          "Hallo, ich bin Elena. Welche Pflanze begleitet dich zu Hause?",
        ),
        contentTitle: t("Una planta fácil", "One easy plant", "Eine einfache Pflanze"),
        contentBody: t(
          "Hablemos de plantas sencillas, riego y rincones con luz.",
          "Let's talk about simple plants, watering and bright corners.",
          "Sprechen wir über einfache Pflanzen, Gießen und helle Ecken.",
        ),
        options: [
          t("¿Qué planta me recomiendas?", "Which plant do you recommend?", "Welche Pflanze empfiehlst du?"),
          t("Tengo hojas amarillas", "My leaves are yellow", "Meine Blätter sind gelb"),
        ],
        activityType: "advice",
      },
    ],
  }),
  room({
    slug: "games-room",
    names: t("Sala de juegos", "Games Room", "Spielzimmer"),
    category: "activity",
    agentSlug: "viktor-sanz",
    agentFullName: "Viktor Sanz",
    agentColour: "#F59E0B",
    agentCredential: t("Compañero de juegos", "Games companion", "Spielbegleiter"),
    ctaLabel: t("Jugar", "Play", "Spielen"),
    topicTags: ["games", "chess", "scrabble", "words", "dominoes", "bridge", "cards", "puzzles", "game:chess", "game:word", "game:dominoes", "game:bridge"],
    timeSlots: ["afternoon", "evening"],
    featured: true,
    memberCount: 8,
    sortOrder: 20,
    dailyTopics: [
      {
        topic: t(
          "Ajedrez, letras, dominó y bridge.",
          "Chess, word tiles, dominoes and bridge.",
          "Schach, Wortsteine, Domino und Bridge.",
        ),
        opener: t(
          "Hola, soy Viktor. Podemos jugar ajedrez, letras, dominó o bridge.",
          "Hello, I'm Viktor. We can play chess, word tiles, dominoes or bridge.",
          "Hallo, ich bin Viktor. Wir können Schach, Wortsteine, Domino oder Bridge spielen.",
        ),
        contentTitle: t("Un reto corto", "A short challenge", "Eine kurze Aufgabe"),
        contentBody: t(
          "Elige ajedrez, letras, dominó o bridge.",
          "Choose chess, word tiles, dominoes or bridge.",
          "Wähle Schach, Wortsteine, Domino oder Bridge.",
        ),
        options: [
          t("Juguemos ajedrez", "Let's play chess", "Lass uns Schach spielen"),
          t("Quiero letras", "I want word tiles", "Ich möchte Wortsteine"),
          t("Juguemos dominó", "Let's play dominoes", "Lass uns Domino spielen"),
          t("Mesa de bridge", "Bridge table", "Bridgetisch"),
        ],
        activityType: "game",
      },
    ],
  }),
  room({
    slug: "kitchen-table",
    names: t("Mesa de cocina", "Kitchen Table", "Küchentisch"),
    category: "useful",
    agentSlug: "lola-martinez",
    agentFullName: "Lola Martínez",
    agentColour: "#C2410C",
    agentCredential: t("Chef mediterránea", "Mediterranean chef", "Mediterrane Köchin"),
    ctaLabel: t("Cocinar", "Cook", "Kochen"),
    topicTags: ["food", "recipes", "mediterranean", "home"],
    timeSlots: ["morning", "afternoon"],
    featured: true,
    memberCount: 7,
    sortOrder: 30,
    dailyTopics: [
      {
        topic: t(
          "Una comida sencilla con sabores de siempre.",
          "A simple meal with familiar flavours.",
          "Ein einfaches Essen mit vertrauten Aromen.",
        ),
        opener: t(
          "Hola, soy Lola. ¿Qué plato te apetece preparar hoy?",
          "Hello, I'm Lola. What would you like to cook today?",
          "Hallo, ich bin Lola. Was möchtest du heute kochen?",
        ),
        contentTitle: t("Algo fácil hoy", "Something easy today", "Heute etwas Einfaches"),
        contentBody: t(
          "Podemos pensar en una receta corta, suave y apetecible.",
          "We can think of a short, gentle and tasty recipe.",
          "Wir finden ein kurzes, sanftes und leckeres Rezept.",
        ),
        options: [
          t("¿Qué puedo cocinar?", "What can I cook?", "Was kann ich kochen?"),
          t("Quiero algo ligero", "I want something light", "Ich möchte etwas Leichtes"),
        ],
        activityType: "recipe",
      },
    ],
  }),
  room({
    slug: "morning-movement",
    names: t("Movimiento suave", "Gentle Movement", "Sanfte Bewegung"),
    category: "activity",
    agentSlug: "amara-osei",
    agentFullName: "Amara Osei",
    agentColour: "#0284C7",
    agentCredential: t("Guía de movimiento", "Movement guide", "Bewegungsbegleiterin"),
    ctaLabel: t("Moverme", "Move", "Bewegen"),
    topicTags: ["movement", "stretching", "mobility", "safe"],
    timeSlots: ["morning", "afternoon"],
    featured: true,
    memberCount: 6,
    sortOrder: 40,
    dailyTopics: [
      {
        topic: t(
          "Movimientos seguros para empezar el día.",
          "Safe movements to start the day.",
          "Sichere Bewegungen für den Tagesbeginn.",
        ),
        opener: t(
          "Hola, soy Amara. Podemos movernos suavemente y sin prisa.",
          "Hello, I'm Amara. We can move gently and without hurry.",
          "Hallo, ich bin Amara. Wir können uns sanft und ohne Eile bewegen.",
        ),
        contentTitle: t("Despertar suave", "Gentle wake-up", "Sanft aufwachen"),
        contentBody: t(
          "Empezamos con un movimiento sentado y fácil.",
          "We start with an easy seated movement.",
          "Wir beginnen mit einer einfachen Bewegung im Sitzen.",
        ),
        options: [
          t("Quiero moverme sentado", "I want seated movement", "Ich möchte mich im Sitzen bewegen"),
          t("Algo para hombros", "Something for shoulders", "Etwas für die Schultern"),
        ],
        activityType: "challenge",
      },
    ],
  }),
  room({
    slug: "evening-wind-down",
    names: t("Calma nocturna", "Evening Calm", "Abendruhe"),
    category: "activity",
    agentSlug: "marco-reyes",
    agentFullName: "Marco Reyes",
    agentColour: "#4F46E5",
    agentCredential: t("Guía de calma", "Calm guide", "Ruhebegleiter"),
    ctaLabel: t("Relajarme", "Relax", "Entspannen"),
    topicTags: ["sleep", "calm", "breathing", "evening"],
    timeSlots: ["evening"],
    featured: true,
    memberCount: 6,
    sortOrder: 50,
    dailyTopics: [
      {
        topic: t(
          "Respirar, cerrar el día y descansar.",
          "Breathe, close the day and rest.",
          "Atmen, den Tag beenden und ruhen.",
        ),
        opener: t(
          "Hola, soy Marco. Bajamos el ritmo juntos antes de dormir.",
          "Hello, I'm Marco. We slow down together before sleep.",
          "Hallo, ich bin Marco. Wir werden vor dem Schlafen gemeinsam ruhiger.",
        ),
        contentTitle: t("Cerrar el día", "Close the day", "Den Tag beenden"),
        contentBody: t(
          "Podemos hacer una pausa corta de respiración y calma.",
          "We can take a short breathing and calm pause.",
          "Wir machen eine kurze Atempause mit Ruhe.",
        ),
        options: [
          t("Quiero relajarme", "I want to relax", "Ich möchte entspannen"),
          t("Ayúdame a dormir", "Help me sleep", "Hilf mir beim Schlafen"),
        ],
        activityType: "advice",
      },
    ],
  }),
  room({
    slug: "music-room",
    names: t("Sala de música", "Music Room", "Musikzimmer"),
    category: "activity",
    agentSlug: "diego-salinas",
    agentFullName: "Diego Salinas",
    agentColour: "#7E22CE",
    agentCredential: t("Musicólogo", "Musicologist", "Musikwissenschaftler"),
    ctaLabel: t("Unirme al circulo", "Join the circle", "Dem Kreis beitreten"),
    topicTags: ["music", "classical", "history", "listening"],
    timeSlots: ["afternoon", "evening"],
    featured: true,
    memberCount: 7,
    sortOrder: 60,
    dailyTopics: [
      {
        topic: t(
          "Canciones de cada vida.",
          "Songs from every life.",
          "Lieder aus jedem Leben.",
        ),
        opener: t(
          "Hola, soy Diego. Trae una canción.",
          "Hello, I'm Diego. Bring a song.",
          "Hallo, ich bin Diego. Bring ein Lied mit.",
        ),
        contentTitle: t("La música nos une", "Music connects us", "Musik verbindet uns"),
        contentBody: t(
          "Las canciones nos unen.",
          "Songs connect us.",
          "Lieder verbinden uns.",
        ),
        options: [
          t("Compartir una canción de mi vida", "Share a song from my life", "Ein Lied aus meinem Leben teilen"),
          t("Conocer a alguien con música", "Meet someone through music", "Jemanden über Musik kennenlernen"),
          t("Buscar un himno alegre", "Find a joyful anthem", "Ein froehliches Lied finden"),
        ],
        activityType: "discussion",
      },
    ],
  }),
  room({
    slug: "reading-room",
    names: t("Club literario", "Literary Club", "Literarischer Club", "Club litteraire", "Club letterario", "Clube literario"),
    category: "social",
    agentSlug: "isabel-fuentes",
    agentFullName: "Isabel Fuentes",
    agentColour: "#7C2D12",
    agentCredential: t("Anfitriona literaria", "Literary host", "Literarische Gastgeberin", "Hote litteraire", "Ospite letteraria", "Anfitria literaria"),
    ctaLabel: t("Unirme al club", "Join the club", "Dem Club beitreten", "Rejoindre le club", "Unirmi al club", "Juntar-me ao clube"),
    topicTags: [
      "books",
      "literature",
      "poetry",
      "reading",
      "stories",
      "book_club",
      "conversation",
      "memoir",
      "library",
      "short_stories",
      "classics",
      "book_memories",
      "reading_companion",
      "book_recommendations",
    ],
    timeSlots: ["morning", "afternoon", "evening"],
    featured: true,
    memberCount: 7,
    sortOrder: 70,
    dailyTopics: readingRoomDailyTopics,
  }),
  room({
    slug: "memory-lane",
    names: t("Recuerdos", "Memory Lane", "Erinnerungen"),
    category: "social",
    agentSlug: "sofia-montoya",
    agentFullName: "Sofía Montoya",
    agentColour: "#DB2777",
    agentCredential: t("Narradora de vida", "Life storyteller", "Lebensgeschichten-Begleiterin"),
    ctaLabel: t("Recordar", "Remember", "Erinnern"),
    topicTags: ["memories", "life", "family", "stories"],
    timeSlots: ["afternoon", "evening"],
    featured: false,
    memberCount: 6,
    sortOrder: 80,
    dailyTopics: [
      {
        topic: t(
          "Un recuerdo pequeño que merece volver.",
          "A small memory worth revisiting.",
          "Eine kleine Erinnerung, die zurückkommen darf.",
        ),
        opener: t(
          "Hola, soy Sofía. Podemos recordar con calma y sin prisa.",
          "Hello, I'm Sofía. We can remember calmly and without hurry.",
          "Hallo, ich bin Sofía. Wir können uns ruhig und ohne Eile erinnern.",
        ),
        contentTitle: t("Un buen recuerdo", "A good memory", "Eine schöne Erinnerung"),
        contentBody: t(
          "Puedes contarme una persona, un lugar o una canción.",
          "You can tell me about a person, a place or a song.",
          "Du kannst mir von einer Person, einem Ort oder einem Lied erzählen.",
        ),
        options: [
          t("Quiero recordar mi infancia", "I want to remember childhood", "Ich möchte mich an meine Kindheit erinnern"),
          t("Hablemos de mi familia", "Let's talk about my family", "Sprechen wir über meine Familie"),
        ],
        activityType: "story",
      },
    ],
  }),
  room({
    slug: "morning-circle",
    names: t("Círculo diario", "Daily Circle", "Täglicher Kreis"),
    category: "social",
    agentSlug: "vyva-morning",
    agentFullName: "VYVA",
    agentColour: "#F97316",
    agentCredential: t("Compañera diaria", "Daily companion", "Tägliche Begleiterin"),
    ctaLabel: t("Empezar", "Start", "Starten"),
    topicTags: ["morning", "routine", "mood", "planning"],
    timeSlots: ["morning"],
    featured: false,
    memberCount: 9,
    sortOrder: 90,
    dailyTopics: [
      {
        topic: t(
          "Saludo, ánimo y plan sencillo.",
          "Greeting, mood and simple plan.",
          "Begrüßung, Stimmung und einfacher Plan.",
        ),
        opener: t(
          "Buenos días. Estoy aquí para empezar el día contigo.",
          "Good morning. I'm here to start the day with you.",
          "Guten Morgen. Ich bin hier, um den Tag mit dir zu beginnen.",
        ),
        contentTitle: t("Hoy con calma", "Today calmly", "Heute ruhig"),
        contentBody: t(
          "Empezamos con una pregunta simple y un plan pequeño.",
          "We start with a simple question and a small plan.",
          "Wir beginnen mit einer einfachen Frage und einem kleinen Plan.",
        ),
        options: [
          t("¿Qué hago hoy?", "What should I do today?", "Was mache ich heute?"),
          t("Quiero organizar mi día", "I want to plan my day", "Ich möchte meinen Tag planen"),
        ],
        activityType: "discussion",
      },
    ],
  }),
  room({
    slug: "news-world-affairs",
    names: t("Noticias", "News", "Nachrichten"),
    category: "useful",
    agentSlug: "ana-serrano",
    agentFullName: "Ana Serrano",
    agentColour: "#475569",
    agentCredential: t("Analista de actualidad", "News analyst", "Nachrichtenanalystin"),
    ctaLabel: t("Entender", "Understand", "Verstehen"),
    topicTags: ["news", "world", "local", "explain"],
    timeSlots: ["morning", "afternoon"],
    featured: false,
    memberCount: 8,
    sortOrder: 100,
    dailyTopics: [
      {
        topic: t(
          "Actualidad explicada con calma.",
          "Current events explained calmly.",
          "Aktuelles ruhig erklärt.",
        ),
        opener: t(
          "Hola, soy Ana. Miramos una noticia y la explicamos sin alarmismo.",
          "Hello, I'm Ana. We look at one story and explain it without alarm.",
          "Hallo, ich bin Ana. Wir schauen eine Nachricht an und erklären sie ohne Alarm.",
        ),
        contentTitle: t("Una noticia clara", "One clear story", "Eine klare Nachricht"),
        contentBody: t(
          "Te explico contexto, qué importa y qué no está confirmado.",
          "I explain context, what matters and what is not confirmed.",
          "Ich erkläre Kontext, was zählt und was nicht bestätigt ist.",
        ),
        options: [
          t("Explícame las noticias", "Explain the news", "Erklär mir die Nachrichten"),
          t("¿Qué es importante hoy?", "What matters today?", "Was ist heute wichtig?"),
        ],
        activityType: "discussion",
      },
    ],
  }),
  room({
    slug: "walking-companion",
    names: t("Paseo acompañado", "Walking Companion", "Spazierbegleitung"),
    category: "activity",
    agentSlug: "camino",
    agentFullName: "Camino",
    agentColour: "#0F766E",
    agentCredential: t("Compañera de paseo", "Walking companion", "Spazierbegleiterin"),
    ctaLabel: t("Pasear", "Walk", "Gehen"),
    topicTags: ["walk", "movement", "outside", "company"],
    timeSlots: ["morning", "afternoon"],
    featured: false,
    memberCount: 7,
    sortOrder: 110,
    dailyTopics: [
      {
        topic: t(
          "Paseos seguros y conversación.",
          "Safe walks and conversation.",
          "Sichere Spaziergänge und Gespräche.",
        ),
        opener: t(
          "Hola, soy Camino. Podemos preparar un paseo breve y seguro.",
          "Hello, I'm Camino. We can prepare a short, safe walk.",
          "Hallo, ich bin Camino. Wir können einen kurzen, sicheren Spaziergang planen.",
        ),
        contentTitle: t("Paseo corto", "Short walk", "Kurzer Spaziergang"),
        contentBody: t(
          "Lo adaptamos a cómo te sientas y al tiempo de hoy.",
          "We adapt it to how you feel and today's weather.",
          "Wir passen ihn an dein Gefühl und das Wetter an.",
        ),
        options: [
          t("Quiero pasear", "I want to walk", "Ich möchte spazieren"),
          t("Hazme compañía", "Keep me company", "Leiste mir Gesellschaft"),
        ],
        activityType: "challenge",
      },
    ],
  }),
  room({
    slug: "together-room",
    names: t("Sala Juntos", "Together Room", "Gemeinsam-Raum", {
      fr: "Salle Ensemble",
      it: "Stanza Insieme",
      pt: "Sala Juntos",
    }),
    category: "connection",
    agentSlug: "vyva-host",
    agentFullName: "VYVA Host",
    agentColour: "#6D28D9",
    agentCredential: t("Anfitriona de planes compartidos", "Shared plans host", "Gastgeberin fuer gemeinsame Plaene", {
      fr: "Hote de plans partages",
      it: "Guida per piani condivisi",
      pt: "Anfitria de planos partilhados",
    }),
    ctaLabel: t("Buscar compania", "Find company", "Begleitung finden", {
      fr: "Trouver de la compagnie",
      it: "Trova compagnia",
      pt: "Encontrar companhia",
    }),
    topicTags: [
      "friendship",
      "connection",
      "restaurant",
      "movie",
      "housing",
      "services",
      "deals",
      "local",
      "nearby",
      "planning",
    ],
    timeSlots: ["morning", "afternoon", "evening"],
    featured: true,
    memberCount: 10,
    sortOrder: 120,
    dailyTopics: [
      {
        topic: t(
          "Elige un plan y encuentra a alguien para hacerlo contigo.",
          "Pick a plan and find someone to do it with you.",
          "Waehle einen Plan und finde jemanden, der ihn mit dir macht.",
          {
            fr: "Choisissez un plan et trouvez quelqu'un pour le faire avec vous.",
            it: "Scegli un piano e trova qualcuno con cui farlo.",
            pt: "Escolha um plano e encontre alguem para o fazer consigo.",
          },
        ),
        opener: t(
          "Hola, soy VYVA. Dime que quieres hacer: casa, servicio, trato, pelicula, restaurante o cualquier plan.",
          "Hello, I'm VYVA. Tell me what you want to do: home, service, deal, movie, restaurant or any plan.",
          "Hallo, ich bin VYVA. Sag mir, was du vorhast: Zuhause, Service, Deal, Film, Restaurant oder ein anderer Plan.",
          {
            fr: "Bonjour, je suis VYVA. Dites-moi ce que vous voulez faire: logement, service, offre, film, restaurant ou tout autre plan.",
            it: "Ciao, sono VYVA. Dimmi cosa vuoi fare: casa, servizio, offerta, film, ristorante o qualsiasi piano.",
            pt: "Ola, sou a VYVA. Diga-me o que quer fazer: casa, servico, oferta, filme, restaurante ou qualquer plano.",
          },
        ),
        contentTitle: t("Planes con otra persona", "Plans with another person", "Plaene mit einer anderen Person", {
          fr: "Plans avec une autre personne",
          it: "Piani con un'altra persona",
          pt: "Planos com outra pessoa",
        }),
        contentBody: t(
          "VYVA te ayuda a elegir un plan, encontrar una buena pareja y decidir si hace falta cercania.",
          "VYVA helps you choose a plan, find a good match and decide whether nearby matters.",
          "VYVA hilft dir, einen Plan zu waehlen, eine passende Person zu finden und zu entscheiden, ob Naehe wichtig ist.",
          {
            fr: "VYVA vous aide a choisir un plan, trouver une bonne personne et decider si la proximite compte.",
            it: "VYVA ti aiuta a scegliere un piano, trovare una buona persona e decidere se la vicinanza conta.",
            pt: "A VYVA ajuda a escolher um plano, encontrar uma boa companhia e decidir se a proximidade importa.",
          },
        ),
        options: [
          t("Quiero un plan cerca", "I want a nearby plan", "Ich moechte einen Plan in der Naehe", {
            fr: "Je veux un plan a proximite",
            it: "Voglio un piano vicino",
            pt: "Quero um plano por perto",
          }),
          t("Buscame alguien para una pelicula", "Find someone for a movie", "Finde jemanden fuer einen Film", {
            fr: "Trouvez quelqu'un pour un film",
            it: "Trovami qualcuno per un film",
            pt: "Encontre alguem para um filme",
          }),
          t("Ayudame a negociar un trato", "Help me negotiate a deal", "Hilf mir, einen Deal zu verhandeln", {
            fr: "Aidez-moi a negocier une offre",
            it: "Aiutami a negoziare un'offerta",
            pt: "Ajude-me a negociar uma oferta",
          }),
        ],
        activityType: "discussion",
      },
    ],
  }),
];

export const socialRoomSlugAliases: Record<string, string> = {
  "garden-chat": "garden-corner",
  "chess-corner": "games-room",
  "music-salon": "music-room",
  "book-club": "reading-room",
  "walking-club": "walking-companion",
  "news-cafe": "news-world-affairs",
};

export function resolveSocialRoomSlug(slug: string): string {
  return socialRoomSlugAliases[slug] ?? slug;
}

export function getSocialRoomBySlug(slug: string): SocialRoomSeed | undefined {
  const canonicalSlug = resolveSocialRoomSlug(slug);
  return socialRoomSeeds.find((roomSeed) => roomSeed.slug === canonicalSlug);
}

export function getTimeSlotFromDate(date = new Date()): "morning" | "afternoon" | "evening" {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function pick<T>(value: Partial<Record<SocialLanguage, T>> & { en: T; es?: T }, language: SocialLanguage): T {
  return value[language] ?? value.en ?? value.es!;
}

export function localizeRoom(seed: SocialRoomSeed, language: SocialLanguage): Omit<SocialRoom, "sessionDate" | "topic" | "opener" | "quote" | "activityType" | "contentTag" | "contentTitle" | "contentBody" | "options" | "liveBadge"> {
  return {
    slug: seed.slug,
    name: pick(seed.names, language),
    category: seed.category,
    agentSlug: seed.agentSlug,
    agentFullName: seed.agentFullName,
    agentColour: seed.agentColour,
    agentCredential: pick(seed.agentCredential, language),
    ctaLabel: pick(seed.ctaLabel, language),
    topicTags: seed.topicTags,
    timeSlots: seed.timeSlots,
    featured: seed.featured,
    participantCount: seed.memberCount,
  };
}

export function buildDailyRoomSession(
  seed: SocialRoomSeed,
  language: SocialGameLanguage = "es",
  date = new Date(),
) {
  const daySeed = Math.floor(date.getTime() / 86_400_000);
  const topic = seed.dailyTopics[daySeed % seed.dailyTopics.length] ?? seed.dailyTopics[0];

  return {
    sessionDate: date.toISOString().slice(0, 10),
    topic: pick(topic.topic, language),
    opener: pick(topic.opener, language),
    quote: topic.quote ? pick(topic.quote, language) : "",
    activityType: topic.activityType ?? "discussion",
    contentTag: topic.contentTag ? pick(topic.contentTag, language) : "",
    contentTitle: topic.contentTitle ? pick(topic.contentTitle, language) : "",
    contentBody: topic.contentBody ? pick(topic.contentBody, language) : "",
    options: topic.options?.map((option) => pick(option, language)) ?? [],
  };
}
