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
    dailyTopics: [
      {
        topic: t(
          "Una frase, un recuerdo y una conversacion.",
          "One line, one memory and one conversation.",
          "Eine Zeile, eine Erinnerung und ein Gespraech.",
          "Une phrase, un souvenir et une conversation.",
          "Una frase, un ricordo e una conversazione.",
          "Uma frase, uma memoria e uma conversa.",
        ),
        opener: t(
          "Hola, soy Isabel. Hoy compartimos libros, historias y pequenos recuerdos para conocernos mejor.",
          "Hello, I'm Isabel. Today we share books, stories and small memories so we can know one another better.",
          "Hallo, ich bin Isabel. Heute teilen wir Buecher, Geschichten und kleine Erinnerungen, um einander besser kennenzulernen.",
          "Bonjour, je suis Isabel. Aujourd'hui, nous partageons des livres, des histoires et de petits souvenirs pour mieux nous connaitre.",
          "Ciao, sono Isabel. Oggi condividiamo libri, storie e piccoli ricordi per conoscerci meglio.",
          "Ola, sou a Isabel. Hoje partilhamos livros, historias e pequenas memorias para nos conhecermos melhor.",
        ),
        contentTitle: t("Club literario vivo", "A living literary club", "Ein lebendiger Literaturclub", "Un club litteraire vivant", "Un club letterario vivo", "Um clube literario vivo"),
        contentBody: t(
          "Entra a la mesa, mira el programa, deja una reflexion y encuentra compania lectora con un saludo protegido.",
          "Step up to the table, browse the program, leave a reflection and find reading company through a protected greeting.",
          "Komm an den Tisch, sieh dir das Programm an, hinterlasse einen Beitrag und finde Lesebegleitung mit geschuetztem Gruss.",
          "Approchez de la table, parcourez le programme, laissez une reflexion et trouvez une compagnie de lecture avec un salut protege.",
          "Avvicinati al tavolo, guarda il programma, lascia una riflessione e trova compagnia di lettura con un saluto protetto.",
          "Chegue a mesa, veja o programa, deixe uma reflexao e encontre companhia de leitura com uma saudacao protegida.",
        ),
        options: [
          t("Anadir una reflexion a la mesa", "Add a reflection to the table", "Einen Beitrag zum Tisch hinzufuegen", "Ajouter une reflexion a la table", "Aggiungere una riflessione al tavolo", "Adicionar uma reflexao a mesa"),
          t("Buscar mi lugar en el club", "Find my place in the club", "Meinen Platz im Club finden", "Trouver ma place dans le club", "Trovare il mio posto nel club", "Encontrar o meu lugar no clube"),
          t("Entrar al programa de hoy", "Join today's program", "Am heutigen Programm teilnehmen", "Rejoindre le programme du jour", "Entrare nel programma di oggi", "Entrar no programa de hoje"),
        ],
        activityType: "discussion",
      },
      {
        topic: t(
          "Libros que abren una puerta.",
          "Books that open a door.",
          "Buecher, die eine Tuer oeffnen.",
          "Des livres qui ouvrent une porte.",
          "Libri che aprono una porta.",
          "Livros que abrem uma porta.",
        ),
        opener: t(
          "Hola, soy Isabel. Elige un libro, una autora o una escena; buscaremos con quien conversar.",
          "Hello, I'm Isabel. Choose a book, an author or a scene; we will find someone to talk with.",
          "Hallo, ich bin Isabel. Waehle ein Buch, eine Autorin oder eine Szene; wir finden jemanden zum Reden.",
          "Bonjour, je suis Isabel. Choisissez un livre, une autrice ou une scene; nous trouverons quelqu'un avec qui parler.",
          "Ciao, sono Isabel. Scegli un libro, un'autrice o una scena; troveremo qualcuno con cui parlarne.",
          "Ola, sou a Isabel. Escolha um livro, uma autora ou uma cena; vamos encontrar alguem para conversar.",
        ),
        contentTitle: t("Intercambio literario", "Literary exchange", "Literarischer Austausch", "Echange litteraire", "Scambio letterario", "Intercambio literario"),
        contentBody: t(
          "Cada persona puede contar que le gusto, que le sorprendio o que recuerdo desperto.",
          "Each person can share what they liked, what surprised them or which memory it opened.",
          "Jede Person kann teilen, was gefiel, was ueberraschte oder welche Erinnerung wach wurde.",
          "Chaque personne peut dire ce qu'elle a aime, ce qui l'a surprise ou quel souvenir s'est ouvert.",
          "Ognuno puo raccontare cosa gli e piaciuto, cosa lo ha sorpreso o quale ricordo ha risvegliato.",
          "Cada pessoa pode contar do que gostou, o que a surpreendeu ou que memoria despertou.",
        ),
        options: [
          t("Contar una escena favorita", "Tell a favourite scene", "Eine Lieblingsszene erzaehlen", "Raconter une scene preferee", "Raccontare una scena preferita", "Contar uma cena preferida"),
          t("Pedir una recomendacion amable", "Ask for a gentle recommendation", "Um eine freundliche Empfehlung bitten", "Demander une recommandation douce", "Chiedere un consiglio gentile", "Pedir uma recomendacao gentil"),
          t("Saludar a otro lector", "Greet another reader", "Eine andere Leserin gruessen", "Saluer une autre personne lectrice", "Salutare un'altra persona lettrice", "Saudar outra pessoa leitora"),
        ],
        activityType: "discussion",
      },
    ],
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
