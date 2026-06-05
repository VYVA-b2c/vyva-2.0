import { randomUUID } from "crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db.js";
import {
  socialRoomModerationActions,
  socialRoomNotifications,
  socialRoomPlanResponses,
  socialRoomPlans,
  socialRoomPolls,
  socialRoomSafetyReports,
  socialRoomVotes,
} from "../../shared/schema.js";
import type {
  SocialLanguage,
  SocialRoomComfortCheck,
  SocialRoomMember,
  SocialRoomPlan,
  SocialRoomPlanKind,
  SocialRoomPlanResponseValue,
  SocialRoomPulse,
  SocialRoomPoll,
  SocialRoomSafetyReportTargetType,
} from "../../src/social/types.js";

type LocalizedText = Partial<Record<SocialLanguage, string>> & {
  es: string;
  en: string;
};

type SeedPlan = {
  key: string;
  kind?: SocialRoomPlanKind;
  title: LocalizedText;
  body: LocalizedText;
  locationLabel: string;
};

type SeedPollOption = {
  id: string;
  label: LocalizedText;
};

type MemoryReport = {
  id: string;
  roomSlug: string;
  reporterId: string;
  targetType: SocialRoomSafetyReportTargetType;
  targetId?: string | null;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
};

type MemoryPost = {
  id: string;
  planKey: string;
  roomSlug: string;
  userId: string;
  kind: SocialRoomPlanKind;
  title: string;
  details: string;
  locationLabel: string;
  createdAt: string;
};

const READING_ROOM_SLUG = "reading-room";
const READING_POLL_KEY = "reading-club-next-shelf";
const SAFE_DB_TIMEOUT_MS = 1400;

const t = (es: string, en: string, de: string, fr?: string, it?: string, pt?: string): LocalizedText => ({
  es,
  en,
  de,
  ...(fr ? { fr } : {}),
  ...(it ? { it } : {}),
  ...(pt ? { pt } : {}),
});

const seedPlans: SeedPlan[] = [
  {
    key: "morning-welcome-table",
    title: t("Mesa de bienvenida", "Welcome table", "Willkommenstisch"),
    body: t(
      "Comparte un libro, una escena o un recuerdo. Puedes entrar sin haber terminado nada.",
      "Share a book, a scene or a memory. You can join without having finished anything.",
      "Teile ein Buch, eine Szene oder Erinnerung. Du kannst auch ohne fertiges Buch dazukommen.",
      "Partagez un livre, une scene ou un souvenir. Vous pouvez entrer sans avoir termine quoi que ce soit.",
      "Condividi un libro, una scena o un ricordo. Puoi entrare anche senza aver finito nulla.",
      "Partilhe um livro, uma cena ou uma memoria. Pode entrar sem ter terminado nada.",
    ),
    locationLabel: "online",
  },
  {
    key: "afternoon-recommendation-exchange",
    title: t("Intercambio de recomendaciones", "Recommendation exchange", "Empfehlungsaustausch"),
    body: t(
      "Deja una sugerencia amable por estado de animo: comoda, divertida, reflexiva o familiar.",
      "Leave a gentle suggestion by mood: comforting, funny, thoughtful or familiar.",
      "Hinterlasse eine sanfte Empfehlung nach Stimmung: troestlich, lustig, nachdenklich oder vertraut.",
      "Laissez une recommandation douce par humeur : reconfortante, drole, reflechie ou familiere.",
      "Lascia un consiglio gentile per umore: confortante, divertente, riflessivo o familiare.",
      "Deixe uma sugestao gentil por humor: reconfortante, divertida, reflexiva ou familiar.",
    ),
    locationLabel: "online",
  },
  {
    key: "evening-small-salon",
    title: t("Salon pequeno", "Small salon", "Kleiner Salon"),
    body: t(
      "Isabel forma circulos pequenos alrededor de memorias, cuentos y personajes favoritos.",
      "Isabel forms small circles around memoirs, short stories and favourite characters.",
      "Isabel bildet kleine Kreise rund um Memoiren, Kurzgeschichten und Lieblingsfiguren.",
      "Isabel forme de petits cercles autour de memoires, nouvelles et personnages preferes.",
      "Isabel forma piccoli cerchi intorno a memorie, racconti brevi e personaggi preferiti.",
      "A Isabel forma pequenos circulos sobre memorias, contos e personagens preferidas.",
    ),
    locationLabel: "online",
  },
];

const pollQuestion = t(
  "Que estante abrimos despues?",
  "Which shelf should we open next?",
  "Welches Regal oeffnen wir als Naechstes?",
  "Quelle etagere ouvrons-nous ensuite ?",
  "Quale scaffale apriamo dopo?",
  "Que prateleira abrimos a seguir?",
);

const pollOptions: SeedPollOption[] = [
  { id: "memoir", label: t("Memorias", "Memoirs", "Memoiren", "Memoires", "Memorie", "Memorias") },
  { id: "short-story", label: t("Cuentos", "Short stories", "Kurzgeschichten", "Nouvelles", "Racconti brevi", "Contos") },
  { id: "poetry", label: t("Poesia", "Poetry", "Poesie", "Poesie", "Poesia", "Poesia") },
  { id: "classics", label: t("Clasicos", "Classics", "Klassiker", "Classiques", "Classici", "Classicos") },
];

const planResponses = new Map<string, SocialRoomPlanResponseValue>();
const pollVotes = new Map<string, string>();
const posts: MemoryPost[] = [];
const reports: MemoryReport[] = [];

function localize(value: LocalizedText, language: SocialLanguage) {
  return value[language] || value.en || value.es;
}

function publicRoomId(roomSlug: string) {
  return roomSlug || READING_ROOM_SLUG;
}

function normalizePlanKind(value: unknown): SocialRoomPlanKind {
  if (value === "plan" || value === "question") return value;
  return "message";
}

function normalizePlanResponse(value: unknown): SocialRoomPlanResponseValue {
  return value === "join" ? "join" : "maybe";
}

function responseKey(userId: string, planKey: string) {
  return `${userId}:${planKey}`;
}

function voteKey(userId: string, pollKey: string) {
  return `${userId}:${pollKey}`;
}

function emptyPlanCounts() {
  return { join: 0, maybe: 0 };
}

function seededPlanCounts(planKey: string) {
  const counts = emptyPlanCounts();
  for (const [key, response] of planResponses.entries()) {
    if (!key.endsWith(`:${planKey}`)) continue;
    counts[response] += 1;
  }
  return counts;
}

function postToPlan(post: MemoryPost, userId: string): SocialRoomPlan {
  return {
    id: post.planKey,
    key: post.planKey,
    kind: post.kind,
    title: post.title,
    body: post.details,
    locationLabel: post.locationLabel,
    startsAt: null,
    status: "active",
    source: "user",
    createdBy: post.userId,
    createdAt: post.createdAt,
    responseCounts: seededPlanCounts(post.planKey),
    myResponse: planResponses.get(responseKey(userId, post.planKey)) ?? null,
  };
}

function memoryPosts(roomSlug: string, userId: string) {
  return posts
    .filter((post) => post.roomSlug === publicRoomId(roomSlug))
    .map((post) => postToPlan(post, userId));
}

function defaultMemberPresence(language: SocialLanguage): SocialRoomMember[] {
  if (language === "de") {
    return [
      { id: "member-maria", name: "Maria", statusLabel: "Bringt eine Erinnerung mit" },
      { id: "member-jose", name: "Jose", statusLabel: "Sucht eine Biografie" },
      { id: "member-carmen", name: "Carmen", statusLabel: "Tauscht Empfehlungen" },
    ];
  }

  if (language === "en") {
    return [
      { id: "member-maria", name: "Maria", statusLabel: "Bringing a memory" },
      { id: "member-jose", name: "Jose", statusLabel: "Looking for a biography" },
      { id: "member-carmen", name: "Carmen", statusLabel: "Swapping recommendations" },
    ];
  }

  if (language === "fr") {
    return [
      { id: "member-maria", name: "Maria", statusLabel: "Apporte un souvenir" },
      { id: "member-jose", name: "Jose", statusLabel: "Cherche une biographie" },
      { id: "member-carmen", name: "Carmen", statusLabel: "Echange des recommandations" },
    ];
  }

  if (language === "it") {
    return [
      { id: "member-maria", name: "Maria", statusLabel: "Porta un ricordo" },
      { id: "member-jose", name: "Jose", statusLabel: "Cerca una biografia" },
      { id: "member-carmen", name: "Carmen", statusLabel: "Scambia consigli" },
    ];
  }

  if (language === "pt") {
    return [
      { id: "member-maria", name: "Maria", statusLabel: "Traz uma memoria" },
      { id: "member-jose", name: "Jose", statusLabel: "Procura uma biografia" },
      { id: "member-carmen", name: "Carmen", statusLabel: "Troca recomendacoes" },
    ];
  }

  return [
    { id: "member-maria", name: "Maria", statusLabel: "Trae un recuerdo" },
    { id: "member-jose", name: "Jose", statusLabel: "Busca una biografia" },
    { id: "member-carmen", name: "Carmen", statusLabel: "Cambia recomendaciones" },
  ];
}

function seededPoll(language: SocialLanguage, userId: string): SocialRoomPoll {
  const votesByOption = new Map(pollOptions.map((option) => [option.id, 0]));
  for (const optionId of pollVotes.values()) {
    votesByOption.set(optionId, (votesByOption.get(optionId) ?? 0) + 1);
  }

  const options = pollOptions.map((option) => ({
    id: option.id,
    label: localize(option.label, language),
    votes: votesByOption.get(option.id) ?? 0,
  }));

  return {
    id: READING_POLL_KEY,
    key: READING_POLL_KEY,
    question: localize(pollQuestion, language),
    status: "active",
    options,
    totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    myVote: pollVotes.get(voteKey(userId, READING_POLL_KEY)) ?? null,
  };
}

function getDiscussionPrompt(language: SocialLanguage) {
  if (language === "de") {
    return {
      id: "reading-table-post",
      title: "Was legst du auf den Clubtisch?",
      body: "Eine Szene, Figur, Erinnerung oder Empfehlung reicht.",
      starterButtons: ["Szene teilen", "Empfehlung geben", "Isabel fragen"],
    };
  }

  if (language === "en") {
    return {
      id: "reading-table-post",
      title: "What will you add to the club table?",
      body: "A scene, character, memory or recommendation is enough.",
      starterButtons: ["Share a scene", "Recommend a book", "Ask Isabel"],
    };
  }

  if (language === "fr") {
    return {
      id: "reading-table-post",
      title: "Qu'ajoutez-vous a la table du club ?",
      body: "Une scene, un personnage, un souvenir ou une recommandation suffit.",
      starterButtons: ["Partager une scene", "Recommander un livre", "Demander a Isabel"],
    };
  }

  if (language === "it") {
    return {
      id: "reading-table-post",
      title: "Cosa aggiungi al tavolo del club?",
      body: "Basta una scena, un personaggio, un ricordo o un consiglio.",
      starterButtons: ["Condividi una scena", "Consiglia un libro", "Chiedi a Isabel"],
    };
  }

  if (language === "pt") {
    return {
      id: "reading-table-post",
      title: "O que vai acrescentar a mesa do clube?",
      body: "Uma cena, personagem, memoria ou recomendacao chega.",
      starterButtons: ["Partilhar uma cena", "Recomendar um livro", "Perguntar a Isabel"],
    };
  }

  return {
    id: "reading-table-post",
    title: "Que dejas en la mesa del club?",
    body: "Basta una escena, un personaje, un recuerdo o una recomendacion.",
    starterButtons: ["Compartir escena", "Recomendar libro", "Preguntar a Isabel"],
  };
}

function getReadingComfortCheck(language: SocialLanguage): SocialRoomComfortCheck {
  if (language === "de") {
    return {
      title: "Was macht das Lesen angenehm?",
      body: "Waehle, was dir beim Clubtisch hilft.",
      options: [
        { id: "quiet_pace", label: "Ruhiges Tempo", count: 0 },
        { id: "easy_access", label: "Einfacher Zugang", count: 0 },
        { id: "seating", label: "Sitzplatz", count: 0 },
      ],
      myComfortNeeds: [],
      totalResponses: 0,
    };
  }

  if (language === "en") {
    return {
      title: "What makes reading comfortable?",
      body: "Choose what helps you at the club table.",
      options: [
        { id: "quiet_pace", label: "Quiet pace", count: 0 },
        { id: "easy_access", label: "Easy access", count: 0 },
        { id: "seating", label: "Place to sit", count: 0 },
      ],
      myComfortNeeds: [],
      totalResponses: 0,
    };
  }

  if (language === "fr") {
    return {
      title: "Qu'est-ce qui rend la lecture confortable ?",
      body: "Choisissez ce qui vous aide a la table du club.",
      options: [
        { id: "quiet_pace", label: "Rythme calme", count: 0 },
        { id: "easy_access", label: "Acces facile", count: 0 },
        { id: "seating", label: "Place assise", count: 0 },
      ],
      myComfortNeeds: [],
      totalResponses: 0,
    };
  }

  if (language === "it") {
    return {
      title: "Cosa rende comoda la lettura?",
      body: "Scegli cosa ti aiuta al tavolo del club.",
      options: [
        { id: "quiet_pace", label: "Ritmo tranquillo", count: 0 },
        { id: "easy_access", label: "Accesso facile", count: 0 },
        { id: "seating", label: "Posto per sedersi", count: 0 },
      ],
      myComfortNeeds: [],
      totalResponses: 0,
    };
  }

  if (language === "pt") {
    return {
      title: "O que torna a leitura confortavel?",
      body: "Escolha o que ajuda na mesa do clube.",
      options: [
        { id: "quiet_pace", label: "Ritmo tranquilo", count: 0 },
        { id: "easy_access", label: "Acesso facil", count: 0 },
        { id: "seating", label: "Lugar para sentar", count: 0 },
      ],
      myComfortNeeds: [],
      totalResponses: 0,
    };
  }

  return {
    title: "Que hace comoda la lectura?",
    body: "Elige lo que ayuda en la mesa del club.",
    options: [
      { id: "quiet_pace", label: "Ritmo tranquilo", count: 0 },
      { id: "easy_access", label: "Acceso facil", count: 0 },
      { id: "seating", label: "Sentarse", count: 0 },
    ],
    myComfortNeeds: [],
    totalResponses: 0,
  };
}

function getSafetyCopy(language: SocialLanguage) {
  if (language === "de") {
    return {
      title: "Literarischer Clubschutz",
      body: "Isabel schuetzt Ton, Tempo und persoenliche Grenzen im Club.",
      consentLine: "Ein Kontakt wird nur geoeffnet, wenn beide Personen zustimmen.",
      helpLabel: "Clubhilfe",
    };
  }

  if (language === "en") {
    return {
      title: "Literary club care",
      body: "Isabel protects tone, pace and personal boundaries in the club.",
      consentLine: "A connection opens only when both people agree.",
      helpLabel: "Club help",
    };
  }

  if (language === "fr") {
    return {
      title: "Attention du club litteraire",
      body: "Isabel protege le ton, le rythme et les limites personnelles du club.",
      consentLine: "Un lien ne s'ouvre que lorsque les deux personnes acceptent.",
      helpLabel: "Aide du club",
    };
  }

  if (language === "it") {
    return {
      title: "Cura del club letterario",
      body: "Isabel protegge tono, ritmo e confini personali nel club.",
      consentLine: "Un contatto si apre solo quando entrambe le persone accettano.",
      helpLabel: "Aiuto del club",
    };
  }

  if (language === "pt") {
    return {
      title: "Cuidado do clube literario",
      body: "A Isabel protege o tom, o ritmo e os limites pessoais no clube.",
      consentLine: "Uma ligacao abre apenas quando ambas as pessoas concordam.",
      helpLabel: "Ajuda do clube",
    };
  }

  return {
    title: "Cuidado del club literario",
    body: "Isabel cuida el tono, el ritmo y los limites personales del club.",
    consentLine: "Una conexion se abre solo cuando ambas personas aceptan.",
    helpLabel: "Ayuda del club",
  };
}

function fallbackPulse(
  userId: string,
  language: SocialLanguage,
  memberPresence: SocialRoomMember[] = defaultMemberPresence(language),
): SocialRoomPulse {
  const plans = seedPlans.map<SocialRoomPlan>((plan) => ({
    id: plan.key,
    key: plan.key,
    kind: plan.kind ?? "plan",
    title: localize(plan.title, language),
    body: localize(plan.body, language),
    locationLabel: plan.locationLabel,
    startsAt: null,
    status: "active",
    source: "seed",
    responseCounts: seededPlanCounts(plan.key),
    myResponse: planResponses.get(responseKey(userId, plan.key)) ?? null,
  }));

  return {
    featuredPlan: plans[0],
    secondaryPlans: plans.slice(1),
    postedExperiences: memoryPosts(READING_ROOM_SLUG, userId),
    memberPresence: memberPulseSummary(memberPresence),
    activePoll: seededPoll(language, userId),
    comfortCheck: getReadingComfortCheck(language),
    discussionPrompt: getDiscussionPrompt(language),
    safety: getSafetyCopy(language),
    notifications: [],
  };
}

async function safeDb<T>(label: string, action: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeout = new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        Promise.resolve(fallback()).then(resolve, reject);
      }, SAFE_DB_TIMEOUT_MS);
    });
    return await Promise.race([action(), timeout]);
  } catch (error) {
    console.warn(`[reading-club-pulse] ${label} fallback`, error);
    return await fallback();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function ensureSeedRows(roomId: string) {
  for (const plan of seedPlans) {
    await db
      .insert(socialRoomPlans)
      .values({
        room_id: roomId,
        plan_key: plan.key,
        kind: plan.kind ?? "plan",
        title_es: plan.title.es,
        title_de: plan.title.de,
        title_en: plan.title.en,
        body_es: plan.body.es,
        body_de: plan.body.de,
        body_en: plan.body.en,
        location_label: plan.locationLabel,
        status: "active",
        source: "seed",
      })
      .onConflictDoUpdate({
        target: [socialRoomPlans.room_id, socialRoomPlans.plan_key],
        set: {
          kind: plan.kind ?? "plan",
          title_es: plan.title.es,
          title_de: plan.title.de,
          title_en: plan.title.en,
          body_es: plan.body.es,
          body_de: plan.body.de,
          body_en: plan.body.en,
          location_label: plan.locationLabel,
          updated_at: new Date(),
        },
      });
  }

  await db
    .insert(socialRoomPolls)
    .values({
      room_id: roomId,
      poll_key: READING_POLL_KEY,
      question_es: pollQuestion.es,
      question_de: pollQuestion.de,
      question_en: pollQuestion.en,
      options: pollOptions.map((option) => ({
        id: option.id,
        label_es: option.label.es,
        label_de: option.label.de,
        label_en: option.label.en,
      })),
      status: "active",
    })
    .onConflictDoUpdate({
      target: [socialRoomPolls.room_id, socialRoomPolls.poll_key],
      set: {
        question_es: pollQuestion.es,
        question_de: pollQuestion.de,
        question_en: pollQuestion.en,
        options: pollOptions.map((option) => ({
          id: option.id,
          label_es: option.label.es,
          label_de: option.label.de,
          label_en: option.label.en,
        })),
        updated_at: new Date(),
      },
    });
}

function rowPlanTitle(plan: typeof socialRoomPlans.$inferSelect, language: SocialLanguage) {
  if (language !== "de" && language !== "en" && language !== "es") {
    const seed = seedPlans.find((entry) => entry.key === plan.plan_key);
    if (seed) return localize(seed.title, language);
  }
  if (language === "de") return plan.title_de;
  if (language === "en") return plan.title_en;
  return plan.title_es;
}

function rowPlanBody(plan: typeof socialRoomPlans.$inferSelect, language: SocialLanguage) {
  if (language !== "de" && language !== "en" && language !== "es") {
    const seed = seedPlans.find((entry) => entry.key === plan.plan_key);
    if (seed) return localize(seed.body, language);
  }
  if (language === "de") return plan.body_de;
  if (language === "en") return plan.body_en;
  return plan.body_es;
}

function rowPollQuestion(poll: typeof socialRoomPolls.$inferSelect, language: SocialLanguage) {
  if (language !== "de" && language !== "en" && language !== "es" && poll.poll_key === READING_POLL_KEY) {
    return localize(pollQuestion, language);
  }
  if (language === "de") return poll.question_de;
  if (language === "en") return poll.question_en;
  return poll.question_es;
}

function rowPollOptionLabel(
  option: { id?: string; label_es: string; label_de: string; label_en: string },
  language: SocialLanguage,
) {
  if (language !== "de" && language !== "en" && language !== "es" && option.id) {
    const seed = pollOptions.find((entry) => entry.id === option.id);
    if (seed) return localize(seed.label, language);
  }
  if (language === "de") return option.label_de;
  if (language === "en") return option.label_en;
  return option.label_es;
}

export async function buildReadingClubPulse(
  userId: string,
  language: SocialLanguage,
  roomId?: string | null,
  memberPresence: SocialRoomMember[] = defaultMemberPresence(language),
): Promise<SocialRoomPulse> {
  if (!roomId) return fallbackPulse(userId, language, memberPresence);

  return safeDb(
    "build pulse",
    async () => {
      await ensureSeedRows(roomId);

      const planRows = await db
        .select()
        .from(socialRoomPlans)
        .where(and(eq(socialRoomPlans.room_id, roomId), ne(socialRoomPlans.status, "hidden")));

      const pollRows = await db
        .select()
        .from(socialRoomPolls)
        .where(and(eq(socialRoomPolls.room_id, roomId), ne(socialRoomPolls.status, "hidden")))
        .limit(1);

      const planIds = planRows.map((plan) => plan.id);
      const responseRows = planIds.length
        ? await db.select().from(socialRoomPlanResponses).where(inArray(socialRoomPlanResponses.plan_id, planIds))
        : [];
      const poll = pollRows[0];
      const voteRows = poll
        ? await db.select().from(socialRoomVotes).where(eq(socialRoomVotes.poll_id, poll.id))
        : [];
      const notifications = await db
        .select()
        .from(socialRoomNotifications)
        .where(eq(socialRoomNotifications.user_id, userId))
        .orderBy(desc(socialRoomNotifications.created_at))
        .limit(3);

      const seedOrder = new Map(seedPlans.map((seed, index) => [seed.key, index]));
      const mapPlanRow = (plan: (typeof planRows)[number]): SocialRoomPlan => {
        const counts = emptyPlanCounts();
        for (const row of responseRows.filter((response) => response.plan_id === plan.id)) {
          const response = normalizePlanResponse(row.response);
          counts[response] += 1;
        }

        const myResponse = responseRows.find((response) => response.plan_id === plan.id && response.user_id === userId);

        return {
          id: plan.plan_key,
          key: plan.plan_key,
          kind: normalizePlanKind(plan.kind),
          title: rowPlanTitle(plan, language),
          body: rowPlanBody(plan, language),
          locationLabel: plan.location_label,
          startsAt: plan.starts_at?.toISOString() ?? null,
          status: plan.status,
          source: plan.source,
          createdBy: plan.created_by,
          createdAt: plan.created_at.toISOString(),
          responseCounts: counts,
          myResponse: myResponse ? normalizePlanResponse(myResponse.response) : null,
        };
      };

      const seededPlans = planRows
        .filter((plan) => plan.source !== "user" && seedOrder.has(plan.plan_key))
        .sort((a, b) => (seedOrder.get(a.plan_key) ?? 999) - (seedOrder.get(b.plan_key) ?? 999))
        .map(mapPlanRow);

      const dbPosts = planRows
        .filter((plan) => plan.source === "user" || !seedOrder.has(plan.plan_key))
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .map(mapPlanRow);
      const seenPostKeys = new Set(dbPosts.map((plan) => plan.key));
      const memoryOnlyPosts = memoryPosts(READING_ROOM_SLUG, userId).filter((plan) => !seenPostKeys.has(plan.key));

      const fallback = fallbackPulse(userId, language, memberPresence);
      const activePoll = poll
        ? (() => {
            const options = poll.options.map((option) => ({
              id: option.id,
              label: rowPollOptionLabel(option, language),
              votes: voteRows.filter((vote) => vote.option_id === option.id).length,
            }));
            return {
              id: poll.poll_key,
              key: poll.poll_key,
              question: rowPollQuestion(poll, language),
              status: poll.status,
              options,
              totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
              myVote: voteRows.find((vote) => vote.user_id === userId)?.option_id ?? null,
            };
          })()
        : fallback.activePoll;

      return {
        featuredPlan: seededPlans[0] ?? fallback.featuredPlan,
        secondaryPlans: seededPlans.slice(1).length ? seededPlans.slice(1) : fallback.secondaryPlans,
        postedExperiences: [...memoryOnlyPosts, ...dbPosts].slice(0, 8),
        memberPresence: memberPulseSummary(memberPresence),
        activePoll,
        comfortCheck: getReadingComfortCheck(language),
        discussionPrompt: getDiscussionPrompt(language),
        safety: getSafetyCopy(language),
        notifications: notifications.map((notification) => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          createdAt: notification.created_at.toISOString(),
          readAt: notification.read_at?.toISOString() ?? null,
        })),
      };
    },
    () => fallbackPulse(userId, language, memberPresence),
  );
}

export async function respondToReadingClubPlan(input: {
  userId: string;
  roomId?: string | null;
  planKey: string;
  response: SocialRoomPlanResponseValue;
  language: SocialLanguage;
}) {
  if (input.roomId) {
    const canRespond = await safeDb(
      "check plan status",
      async () => {
        await ensureSeedRows(input.roomId!);
        const [plan] = await db
          .select({ status: socialRoomPlans.status })
          .from(socialRoomPlans)
          .where(and(eq(socialRoomPlans.room_id, input.roomId!), eq(socialRoomPlans.plan_key, input.planKey)))
          .limit(1);
        return !plan || plan.status === "active";
      },
      () => true,
    );

    if (!canRespond) return { error: "Plan is closed" as const };
  }

  planResponses.set(responseKey(input.userId, input.planKey), input.response);

  if (input.roomId) {
    await safeDb(
      "respond to plan",
      async () => {
        await ensureSeedRows(input.roomId!);
        const [plan] = await db
          .select({ id: socialRoomPlans.id })
          .from(socialRoomPlans)
          .where(and(eq(socialRoomPlans.room_id, input.roomId!), eq(socialRoomPlans.plan_key, input.planKey)))
          .limit(1);
        if (!plan) return;

        await db
          .insert(socialRoomPlanResponses)
          .values({
            plan_id: plan.id,
            user_id: input.userId,
            response: input.response,
          })
          .onConflictDoUpdate({
            target: [socialRoomPlanResponses.plan_id, socialRoomPlanResponses.user_id],
            set: {
              response: input.response,
              updated_at: new Date(),
            },
          });
      },
      async () => undefined,
    );
  }

  const pulse = await buildReadingClubPulse(input.userId, input.language, input.roomId);
  return {
    planResponse: {
      planId: input.planKey,
      response: input.response,
      responseCounts:
        [pulse.featuredPlan, ...pulse.secondaryPlans, ...pulse.postedExperiences].find((plan) => plan.key === input.planKey)?.responseCounts ??
        seededPlanCounts(input.planKey),
    },
    pulse,
  };
}

export async function voteReadingClubPoll(input: {
  userId: string;
  roomId?: string | null;
  pollKey: string;
  optionId: string;
  language: SocialLanguage;
}) {
  const validOption = pollOptions.some((option) => option.id === input.optionId);
  if (!validOption) return { error: "Invalid poll option" as const };

  if (input.roomId) {
    const canVote = await safeDb(
      "check poll status",
      async () => {
        await ensureSeedRows(input.roomId!);
        const [poll] = await db
          .select({ status: socialRoomPolls.status })
          .from(socialRoomPolls)
          .where(and(eq(socialRoomPolls.room_id, input.roomId!), eq(socialRoomPolls.poll_key, input.pollKey)))
          .limit(1);
        return !poll || poll.status === "active";
      },
      () => true,
    );

    if (!canVote) return { error: "Poll is closed" as const };
  }

  pollVotes.set(voteKey(input.userId, input.pollKey), input.optionId);

  if (input.roomId) {
    await safeDb(
      "vote poll",
      async () => {
        await ensureSeedRows(input.roomId!);
        const [poll] = await db
          .select({ id: socialRoomPolls.id })
          .from(socialRoomPolls)
          .where(and(eq(socialRoomPolls.room_id, input.roomId!), eq(socialRoomPolls.poll_key, input.pollKey)))
          .limit(1);
        if (!poll) return;

        await db
          .insert(socialRoomVotes)
          .values({
            poll_id: poll.id,
            user_id: input.userId,
            option_id: input.optionId,
          })
          .onConflictDoUpdate({
            target: [socialRoomVotes.poll_id, socialRoomVotes.user_id],
            set: {
              option_id: input.optionId,
              updated_at: new Date(),
            },
          });
      },
      async () => undefined,
    );
  }

  const pulse = await buildReadingClubPulse(input.userId, input.language, input.roomId);
  return {
    vote: {
      pollId: input.pollKey,
      optionId: input.optionId,
      options: pulse.activePoll.options,
      totalVotes: pulse.activePoll.totalVotes,
    },
    pulse,
  };
}

export async function createReadingClubPost(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  title: string;
  details: string;
  locationLabel?: string;
  kind?: SocialRoomPlanKind;
  language: SocialLanguage;
}) {
  const kind = normalizePlanKind(input.kind);
  const postId = randomUUID();
  const post: MemoryPost = {
    id: postId,
    planKey: `reading-post-${postId}`,
    roomSlug: publicRoomId(input.roomSlug),
    userId: input.userId,
    kind,
    title: input.title,
    details: input.details,
    locationLabel: input.locationLabel === "nearby" ? "nearby" : "club-table",
    createdAt: new Date().toISOString(),
  };
  posts.unshift(post);

  if (input.roomId) {
    await safeDb(
      "create reading post",
      async () => {
        await db
          .insert(socialRoomPlans)
          .values({
            room_id: input.roomId!,
            plan_key: post.planKey,
            kind,
            title_es: input.title,
            title_de: input.title,
            title_en: input.title,
            body_es: input.details,
            body_de: input.details,
            body_en: input.details,
            location_label: post.locationLabel,
            status: "active",
            source: "user",
            created_by: input.userId,
          })
          .onConflictDoNothing({
            target: [socialRoomPlans.room_id, socialRoomPlans.plan_key],
          });

        await db.insert(socialRoomNotifications).values({
          user_id: input.userId,
          room_id: input.roomId,
          type: "reading_post_created",
          title: input.title,
          body: input.details,
          metadata: { postId: post.id, kind },
        });
      },
      async () => undefined,
    );
  }

  return {
    proposal: post,
    pulse: await buildReadingClubPulse(input.userId, input.language, input.roomId),
  };
}

export async function createReadingClubSafetyReport(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  reason: string;
  details: string;
  targetType?: SocialRoomSafetyReportTargetType;
  targetId?: string | null;
  language: SocialLanguage;
}) {
  const targetType = input.targetType ?? "room";
  const report: MemoryReport = {
    id: randomUUID(),
    roomSlug: publicRoomId(input.roomSlug),
    reporterId: input.userId,
    targetType,
    targetId: input.targetId ?? null,
    reason: input.reason,
    details: input.details,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  reports.unshift(report);

  if (input.roomId) {
    await safeDb(
      "create safety report",
      async () => {
        await db.insert(socialRoomSafetyReports).values({
          room_id: input.roomId!,
          reporter_id: input.userId,
          target_type: targetType,
          target_id: input.targetId ?? null,
          reason: input.reason,
          details: input.details,
        });
      },
      async () => undefined,
    );
  }

  return {
    reportId: report.id,
    report,
    pulse: await buildReadingClubPulse(input.userId, input.language, input.roomId),
  };
}

export async function listReadingClubModeration(roomSlug: string, roomId?: string | null) {
  if (!roomId) {
    return {
      reports: reports.filter((report) => report.roomSlug === publicRoomId(roomSlug)),
      proposals: posts.filter((post) => post.roomSlug === publicRoomId(roomSlug)),
      actions: [],
    };
  }

  return safeDb(
    "list moderation",
    async () => {
      const [reportRows, actionRows, planRows, pollRows] = await Promise.all([
        db
          .select()
          .from(socialRoomSafetyReports)
          .where(eq(socialRoomSafetyReports.room_id, roomId))
          .orderBy(desc(socialRoomSafetyReports.created_at)),
        db
          .select()
          .from(socialRoomModerationActions)
          .where(eq(socialRoomModerationActions.room_id, roomId))
          .orderBy(desc(socialRoomModerationActions.created_at)),
        db.select().from(socialRoomPlans).where(eq(socialRoomPlans.room_id, roomId)),
        db.select().from(socialRoomPolls).where(eq(socialRoomPolls.room_id, roomId)),
      ]);

      return {
        reports: reportRows.map((report) => ({
          id: report.id,
          roomSlug,
          reporterId: report.reporter_id,
          targetType: report.target_type as SocialRoomSafetyReportTargetType,
          targetId: report.target_id ?? null,
          reason: report.reason,
          details: report.details,
          status: report.status,
          createdAt: report.created_at.toISOString(),
          reviewedAt: report.reviewed_at?.toISOString() ?? null,
          reviewedBy: report.reviewed_by ?? null,
        })),
        proposals: posts.filter((post) => post.roomSlug === publicRoomId(roomSlug)),
        actions: actionRows,
        plans: planRows,
        polls: pollRows,
      };
    },
    () => ({
      reports: reports.filter((report) => report.roomSlug === publicRoomId(roomSlug)),
      proposals: posts.filter((post) => post.roomSlug === publicRoomId(roomSlug)),
      actions: [],
    }),
  );
}

export async function updateReadingClubReport(input: {
  reportId: string;
  adminUserId: string;
  status: string;
}) {
  const memoryReport = reports.find((report) => report.id === input.reportId);
  if (memoryReport) {
    memoryReport.status = input.status;
    memoryReport.reviewedAt = new Date().toISOString();
    memoryReport.reviewedBy = input.adminUserId;
  }

  await safeDb(
    "update report",
    async () => {
      await db
        .update(socialRoomSafetyReports)
        .set({
          status: input.status,
          reviewed_at: new Date(),
          reviewed_by: input.adminUserId,
        })
        .where(eq(socialRoomSafetyReports.id, input.reportId));
    },
    async () => undefined,
  );
}

export function memberPulseSummary(members: SocialRoomMember[]) {
  return members.slice(0, 3).map((member) => ({
    id: member.id,
    name: member.name,
    statusLabel: member.statusLabel ?? member.sharedTopic ?? "",
    sharedTopic: member.sharedTopic,
  }));
}
