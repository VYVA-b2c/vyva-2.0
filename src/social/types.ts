export type SocialLanguage = "es" | "de" | "en";

export type SocialGameLanguage = "es" | "en" | "fr" | "de" | "it" | "pt";

export type SocialRoomCategory = "activity" | "social" | "useful" | "connection";

export type SocialActivityType =
  | "discussion"
  | "quiz"
  | "challenge"
  | "recipe"
  | "game"
  | "story"
  | "advice";

export type SocialGameKind = "chess" | "word" | "dominoes" | "bridge";

export type SocialGameRoundVisual =
  | {
      kind: "wordTiles";
      tiles: string[];
      answerLength: number;
      baseWord?: string;
      pattern?: string;
      clue?: string;
    }
  | {
      kind: "chessBoard";
      caption: string;
      pieces: Array<{
        square: string;
        piece: "whiteKing" | "whiteQueen" | "whiteRook" | "whiteBishop" | "whiteKnight" | "whitePawn" | "blackKing" | "blackQueen" | "blackRook" | "blackBishop" | "blackKnight" | "blackPawn";
      }>;
      highlights?: string[];
      arrows?: Array<{ from: string; to: string; label?: string }>;
    }
  | {
      kind: "dominoes";
      caption: string;
      openEnds?: [number, number];
      hand?: Array<[number, number]>;
      candidateTiles?: Array<[number, number]>;
      playedTile?: [number, number];
      focusTile?: [number, number];
      target?: number;
      desired?: number;
      avoid?: number;
      playOn?: number;
      otherEnd?: number;
    }
  | {
      kind: "bridgeCards";
      caption: string;
      points?: number;
      contract?: string;
      partnerBid?: string;
      cards?: Array<{ rank: string; suit: string }>;
      suitLengths?: Array<{ suit: string; length: number }>;
      missingCard?: { rank: string; suit: string };
    };

export type SocialGameRound = {
  id: string;
  kind: SocialGameKind;
  title: string;
  body: string;
  prompt: string;
  choices: string[];
  answer: string;
  hint: string;
  tags: string[];
  estimatedDurationSeconds: number;
  successMessage: string;
  visual?: SocialGameRoundVisual;
};

export type SocialGameReadyMember = {
  id: string;
  name: string;
  gameKind: SocialGameKind;
  statusLabel: string;
  sharedTopic: string;
};

export type SocialGameTable = {
  hostLine: string;
  tableLabel: string;
  readyLabel: string;
  chooseRoundLabel: string;
  connectionTitle: string;
  connectionBody: string;
  startRoundLabel: string;
  completeRoundLabel: string;
  findPartnerLabel: string;
  sayHelloLabel: string;
  roundCompleteLabel: string;
  rounds: SocialGameRound[];
  defaultRoundId: string;
  readyMembers: SocialGameReadyMember[];
};

export type SocialRoom = {
  slug: string;
  name: string;
  category: SocialRoomCategory;
  agentSlug: string;
  agentFullName: string;
  agentColour: string;
  agentCredential: string;
  ctaLabel: string;
  topicTags: string[];
  timeSlots: string[];
  featured: boolean;
  participantCount: number;
  sessionDate: string;
  topic: string;
  opener: string;
  quote: string;
  activityType: SocialActivityType;
  contentTag: string;
  contentTitle: string;
  contentBody: string;
  options: string[];
  liveBadge: string;
  heroScore?: number;
};

export type SocialTranscriptItem = {
  id: string;
  speaker: "agent" | "user";
  text: string;
  createdAt: string;
};

export type SocialRoomMember = {
  id: string;
  name: string;
  sharedTopic?: string;
  statusLabel?: string;
};

export type SocialRoomChatItem = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
  connectable?: boolean;
};

export type SocialRoomVisitState = {
  isFirstVisit: boolean;
  visitCount: number;
  previousVisitCount?: number;
};

export type SocialConversationContext = {
  generatedAt: string;
  lines: string[];
  text: string;
  facts?: Record<string, unknown>;
};

export type SocialHubResponse = {
  user: {
    id: string;
    firstName: string;
    language: SocialLanguage;
  };
  timeSlot: string;
  activeCount: number;
  interestTags: string[];
  lastRooms: string[];
  heroRooms: SocialRoom[];
  alsoForYou: SocialRoom[];
  listRooms: SocialRoom[];
};

export type SocialRoomResponse = {
  room: SocialRoom;
  transcript: SocialTranscriptItem[];
  promptChips: string[];
  members: SocialRoomMember[];
  memberChat: SocialRoomChatItem[];
  visitState?: SocialRoomVisitState;
  conversationContext?: SocialConversationContext;
  gameTable?: SocialGameTable;
};

export type SocialMatchResponse = {
  noMatch: boolean;
  agentMessage: string;
  matchedUser?: {
    userId: string;
    name: string;
  };
  sharedTopics?: string[];
};
