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

export type SocialGameKind = "chess" | "word" | "dominoes" | "trivia";

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

export type SocialRoomPlanResponseValue = "join" | "maybe";
export type SocialRoomPlanKind = "plan" | "message" | "question";
export type SocialRoomComfortNeed = "quiet_pace" | "easy_access" | "seating";
export type SocialRoomExperienceCategory =
  | "movie_date"
  | "restaurant_date"
  | "home_share"
  | "service_booking"
  | "deal_help"
  | "outing"
  | "other";
export type SocialRoomPreferredTime = "morning" | "afternoon" | "evening" | "flexible";
export type SocialRoomCostRange = "free" | "low" | "shared" | "discuss";
export type SocialRoomGroupSize = "one_to_one" | "small_group" | "open_room";
export type SocialRoomSafetyFlag = "money" | "housing" | "service" | "private_contact" | "transport";
export type SocialRoomSafetyReportTargetType = "room" | "plan" | "message" | "question" | "poll" | "reply";

export type SocialRoomReplyTone = "support" | "curious" | "help";

export type SocialRoomComfortCheckOption = {
  id: SocialRoomComfortNeed;
  label: string;
  count: number;
};

export type SocialRoomComfortCheck = {
  title: string;
  body: string;
  options: SocialRoomComfortCheckOption[];
  myComfortNeeds: SocialRoomComfortNeed[];
  totalResponses: number;
};

export type SocialRoomReply = {
  id: string;
  planKey: string;
  authorName: string;
  body: string;
  tone: SocialRoomReplyTone;
  status: "active" | "hidden" | string;
  createdAt: string;
};

export type SocialRoomPlan = {
  id: string;
  key: string;
  kind?: SocialRoomPlanKind;
  title: string;
  body: string;
  locationLabel: string;
  comfortNeeds?: SocialRoomComfortNeed[];
  experienceCategory?: SocialRoomExperienceCategory;
  preferredTime?: SocialRoomPreferredTime;
  costRange?: SocialRoomCostRange;
  groupSize?: SocialRoomGroupSize;
  safetyFlags?: SocialRoomSafetyFlag[];
  fitReasons?: string[];
  needsReview?: boolean;
  startsAt?: string | null;
  status: "active" | "hidden" | "closed" | string;
  source?: "seed" | "user" | string;
  createdBy?: string | null;
  createdAt?: string | null;
  responseCounts: Record<SocialRoomPlanResponseValue, number>;
  myResponse?: SocialRoomPlanResponseValue | null;
  replies?: SocialRoomReply[];
};

export type SocialRoomPlanResponse = {
  planId: string;
  response: SocialRoomPlanResponseValue;
  responseCounts: Record<SocialRoomPlanResponseValue, number>;
};

export type SocialRoomPollOption = {
  id: string;
  label: string;
  votes: number;
};

export type SocialRoomPoll = {
  id: string;
  key: string;
  question: string;
  status: "active" | "closed" | string;
  options: SocialRoomPollOption[];
  totalVotes: number;
  myVote?: string | null;
};

export type SocialRoomVote = {
  pollId: string;
  optionId: string;
  options: SocialRoomPollOption[];
  totalVotes: number;
};

export type SocialRoomDiscussionPrompt = {
  id: string;
  title: string;
  body: string;
  starterButtons: string[];
};

export type SocialRoomSafetyState = {
  title: string;
  body: string;
  consentLine: string;
  helpLabel: string;
  agreementTitle?: string;
  agreementLines?: string[];
  acknowledgementLabel?: string;
  acknowledgedLabel?: string;
  myAcknowledgedAt?: string | null;
};

export type SocialRoomNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
};

export type SocialRoomPulse = {
  featuredPlan: SocialRoomPlan;
  secondaryPlans: SocialRoomPlan[];
  postedExperiences: SocialRoomPlan[];
  memberPresence: SocialRoomMember[];
  activePoll: SocialRoomPoll;
  comfortCheck: SocialRoomComfortCheck;
  discussionPrompt: SocialRoomDiscussionPrompt;
  safety: SocialRoomSafetyState;
  notifications: SocialRoomNotification[];
};

export type SocialReadingClubMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

export type SocialReadingClubAgendaItem = {
  id: string;
  timeLabel: string;
  title: string;
  body: string;
  statusLabel: string;
};

export type SocialReadingClubShelfItem = {
  id: string;
  title: string;
  authorLabel: string;
  tag: string;
  body: string;
  discussionStarter: string;
};

export type SocialReadingClubShelf = {
  id: string;
  title: string;
  body: string;
  items: SocialReadingClubShelfItem[];
};

export type SocialReadingClubMemberSpotlight = {
  memberId: string;
  name: string;
  roleLine: string;
  body: string;
  starter: string;
};

export type SocialReadingCompanionMode = {
  id: string;
  title: string;
  body: string;
  ctaLabel: string;
  bridgePrompt: string;
};

export type SocialReadingClubPassportItem = {
  id: string;
  label: string;
  body: string;
};

export type SocialReadingClubDestination = {
  title: string;
  subtitle: string;
  hostNote: string;
  todayQuestion: string;
  metrics: SocialReadingClubMetric[];
  agendaTitle: string;
  agenda: SocialReadingClubAgendaItem[];
  shelvesTitle: string;
  shelves: SocialReadingClubShelf[];
  spotlightsTitle: string;
  memberSpotlights: SocialReadingClubMemberSpotlight[];
  companionTitle: string;
  companionBody: string;
  companionModes: SocialReadingCompanionMode[];
  passportTitle: string;
  passportBody: string;
  passportItems: SocialReadingClubPassportItem[];
  reflectionTitle: string;
  reflectionPlaceholder: string;
  reflectionSubmitLabel: string;
  reflectionPrompts: string[];
  guidelinesTitle: string;
  guidelines: string[];
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
  pulse?: SocialRoomPulse;
  readingClub?: SocialReadingClubDestination;
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
