import type { SocialGameKind, SocialLanguage } from "../../src/social/types";
import { resolveSocialRoomSlug } from "./socialRoomsSeed.js";
import { buildGamePreferenceTag, labelForGameKind } from "./socialGameRounds.js";

export type SocialMatchCandidate = {
  userId: string;
  displayName: string;
  interestTags: string[];
  discoverable?: boolean;
};

export type SocialMatchOptions = {
  roomSlug: string;
  gameKind?: SocialGameKind | null;
  readingPreferenceTags?: string[] | null;
};

export type ScoredSocialMatch = SocialMatchCandidate & {
  shared: string[];
  score: number;
};

const MATCHABLE_ROOM_SLUGS = new Set(["pen-pals", "heritage-exchange", "games-room", "together-room", "reading-room"]);
const READING_MATCH_TAGS = new Set([
  "books",
  "literature",
  "poetry",
  "reading",
  "stories",
  "book_club",
  "memoir",
  "library",
  "short_stories",
  "classics",
  "book_memories",
  "reading_companion",
  "book_recommendations",
]);

export function supportsSocialMatching(roomSlug: string) {
  return MATCHABLE_ROOM_SLUGS.has(resolveSocialRoomSlug(roomSlug));
}

function uniqueTags(tags: string[]) {
  return Array.from(new Set(tags.filter(Boolean)));
}

export function scoreSocialMatchCandidate(
  userInterestTags: string[],
  candidate: SocialMatchCandidate,
  options: SocialMatchOptions,
): ScoredSocialMatch {
  const canonicalSlug = resolveSocialRoomSlug(options.roomSlug);
  const readingPreferenceTags = canonicalSlug === "reading-room" ? options.readingPreferenceTags ?? [] : [];
  const userTags = uniqueTags([...userInterestTags, ...readingPreferenceTags]);
  const candidateTags = uniqueTags(candidate.interestTags);
  const shared = userTags.filter((tag) => candidateTags.includes(tag));
  const union = uniqueTags([...userTags, ...candidateTags]);
  let score = union.length === 0 ? 0 : shared.length / union.length;

  if (canonicalSlug === "games-room" && options.gameKind) {
    const gameTag = buildGamePreferenceTag(options.gameKind);
    const candidateLikesGame = candidateTags.includes(gameTag);
    const userLikesGame = userTags.includes(gameTag);

    if (candidateLikesGame) score += 2;
    if (candidateLikesGame && userLikesGame) score += 1;
  }

  if (canonicalSlug === "reading-room") {
    const sharedReadingTags = shared.filter((tag) => READING_MATCH_TAGS.has(tag));
    const candidateLikesReading = candidateTags.some((tag) => READING_MATCH_TAGS.has(tag));
    const userLikesReading = userTags.some((tag) => READING_MATCH_TAGS.has(tag));

    if (candidateLikesReading) score += 0.65;
    if (candidateLikesReading && userLikesReading) score += 0.35;
    score += Math.min(sharedReadingTags.length * 0.35, 1.4);
  }

  return {
    ...candidate,
    shared,
    score,
  };
}

export function pickBestSocialMatch(
  userInterestTags: string[],
  candidates: SocialMatchCandidate[],
  options: SocialMatchOptions,
) {
  return candidates
    .filter((candidate) => candidate.discoverable !== false)
    .map((candidate) => scoreSocialMatchCandidate(userInterestTags, candidate, options))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)[0] ?? null;
}

export function formatSharedTopic(tag: string | undefined, language: SocialLanguage) {
  if (!tag) {
    if (language === "de") return "Lieblingsthemen";
    if (language === "en") return "favourite games";
    return "juegos favoritos";
  }

  if (tag.startsWith("game:")) {
    const kind = tag.slice("game:".length) as SocialGameKind;
    if (["chess", "word", "dominoes", "trivia"].includes(kind)) {
      return labelForGameKind(kind, language);
    }
  }

  const literaryLabels: Record<string, Record<SocialLanguage, string>> = {
    books: { es: "libros", de: "Buecher", en: "books" },
    literature: { es: "literatura", de: "Literatur", en: "literature" },
    poetry: { es: "poesia", de: "Poesie", en: "poetry" },
    reading: { es: "lectura", de: "Lesen", en: "reading" },
    stories: { es: "historias", de: "Geschichten", en: "stories" },
    memoir: { es: "memorias", de: "Memoiren", en: "memoirs" },
    library: { es: "biblioteca", de: "Bibliothek", en: "library memories" },
    short_stories: { es: "cuentos", de: "Kurzgeschichten", en: "short stories" },
    classics: { es: "clasicos", de: "Klassiker", en: "classics" },
    book_memories: { es: "recuerdos de libros", de: "Bucherinnerungen", en: "book memories" },
    reading_companion: { es: "compania de lectura", de: "Lesebegleitung", en: "reading companionship" },
    book_recommendations: { es: "recomendaciones", de: "Empfehlungen", en: "recommendations" },
  };

  if (literaryLabels[tag]) return literaryLabels[tag][language];

  return tag.replace(/^game:/, "");
}
