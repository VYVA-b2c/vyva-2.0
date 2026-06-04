import {
  ArrowLeft,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Crown,
  Dice5,
  Gamepad2,
  HeartHandshake,
  MessageCircle,
  Send,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/queryClient";
import gameTableImage from "@/assets/games-room-tabletop.webp";
import AgentAvatar from "./AgentAvatar";
import SocialStyles from "./SocialStyles";
import type {
  SocialGameKind,
  SocialGameLanguage,
  SocialGameRound,
  SocialMatchResponse,
  SocialRoomChatItem,
  SocialRoomResponse,
} from "./types";

type GamesRoomScreenProps = {
  roomResponse: SocialRoomResponse;
  language: SocialGameLanguage;
  visitId?: string | null;
  onBack: () => void;
};

const roundIcons: Record<SocialGameKind, LucideIcon> = {
  chess: Crown,
  word: Gamepad2,
  dominoes: Dice5,
  trivia: CircleHelp,
};

function fallbackGameTable(roomResponse: SocialRoomResponse) {
  const readyCount = Math.max(3, Math.min(roomResponse.room.participantCount, 9));

  return {
    hostLine: "Viktor is hosting short classic rounds.",
    tableLabel: "Today's table",
    readyLabel: `${readyCount} people ready`,
    chooseRoundLabel: "Choose a round",
    connectionTitle: "Find a playing partner",
    connectionBody: "VYVA only looks for people who opted in. Contact details stay private.",
    startRoundLabel: "Start round",
    completeRoundLabel: "Complete round",
    findPartnerLabel: "Find a playing partner",
    sayHelloLabel: "Say hello",
    roundCompleteLabel: "Round complete",
    defaultRoundId: "chess-clue-fork",
    readyMembers: [
      {
        id: "member-ana",
        name: "Ana",
        gameKind: "word" as const,
        statusLabel: "Ana likes word games",
        sharedTopic: "word games",
      },
      {
        id: "member-luis",
        name: "Luis",
        gameKind: "chess" as const,
        statusLabel: "Luis is solving chess",
        sharedTopic: "chess clues",
      },
    ],
    rounds: [
      {
        id: "chess-clue-fork",
        kind: "chess" as const,
        title: "Chess clue",
        body: "Spot a friendly tactic.",
        prompt: "White's knight can check the king and attack the queen. What tactic is this?",
        choices: ["Fork", "Castle", "Trade pawns"],
        answer: "Fork",
        hint: "One piece makes two threats at the same time.",
        tags: ["games", "chess", "game:chess", "chess:fork"],
        estimatedDurationSeconds: 90,
        successMessage: "Nice steady thinking. Forks are a classic way to start a chess chat.",
      },
    ],
  };
}

function formatChatTime(createdAt: string, language: SocialGameLanguage) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString(language, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMemberInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getRoundActionLabel(language: SocialGameLanguage) {
  if (language === "fr") return "Choisir une reponse";
  if (language === "it") return "Scegli una risposta";
  if (language === "pt") return "Escolha uma resposta";
  if (language === "de") return "Antwort waehlen";
  if (language === "en") return "Choose an answer";
  return "Elige una respuesta";
}

function getMatchLoadingLabel(language: SocialGameLanguage) {
  if (language === "fr") return "VYVA cherche...";
  if (language === "it") return "VYVA sta cercando...";
  if (language === "pt") return "VYVA esta procurando...";
  if (language === "de") return "VYVA sucht...";
  if (language === "en") return "VYVA is looking...";
  return "VYVA esta buscando...";
}

function getChatTitle(language: SocialGameLanguage) {
  if (language === "fr") return "Autour de la table";
  if (language === "it") return "Intorno al tavolo";
  if (language === "pt") return "Ao redor da mesa";
  if (language === "de") return "Was am Tisch passiert";
  if (language === "en") return "Around the table";
  return "En la mesa";
}

function getHintLabel(language: SocialGameLanguage) {
  if (language === "fr") return "Indice";
  if (language === "it") return "Aiuto";
  if (language === "pt") return "Dica";
  if (language === "de") return "Hinweis";
  if (language === "en") return "Hint";
  return "Pista";
}

function getPuzzleBankLabels(language: SocialGameLanguage, index: number, total: number) {
  const safeIndex = Math.max(0, index) + 1;

  if (language === "fr") {
    return {
      progress: `Puzzle ${safeIndex} sur ${total}`,
      previous: "Precedent",
      next: "Puzzle suivant",
    };
  }

  if (language === "it") {
    return {
      progress: `Puzzle ${safeIndex} di ${total}`,
      previous: "Precedente",
      next: "Puzzle successivo",
    };
  }

  if (language === "pt") {
    return {
      progress: `Puzzle ${safeIndex} de ${total}`,
      previous: "Anterior",
      next: "Proximo puzzle",
    };
  }

  if (language === "de") {
    return {
      progress: `Raetsel ${safeIndex} von ${total}`,
      previous: "Vorheriges",
      next: "Naechstes Raetsel",
    };
  }

  if (language === "en") {
    return {
      progress: `Puzzle ${safeIndex} of ${total}`,
      previous: "Previous",
      next: "Next puzzle",
    };
  }

  return {
    progress: `Puzle ${safeIndex} de ${total}`,
    previous: "Anterior",
    next: "Siguiente puzle",
  };
}

const memberColours = ["#0F766E", "#F97316", "#7C3AED", "#DB2777"];

export default function GamesRoomScreen({
  roomResponse,
  language,
  visitId,
  onBack,
}: GamesRoomScreenProps) {
  const { room, memberChat } = roomResponse;
  const gameTable = roomResponse.gameTable ?? fallbackGameTable(roomResponse);
  const roundCards = useMemo(() => {
    const seen = new Set<SocialGameKind>();
    return gameTable.rounds.filter((round) => {
      if (seen.has(round.kind)) return false;
      seen.add(round.kind);
      return true;
    });
  }, [gameTable.rounds]);

  const initialRoundId = gameTable.rounds.some((round) => round.id === gameTable.defaultRoundId)
    ? gameTable.defaultRoundId
    : gameTable.rounds[0]?.id ?? "";

  const [selectedRoundId, setSelectedRoundId] = useState(initialRoundId);
  const [startedRoundId, setStartedRoundId] = useState<string | null>(null);
  const [selectedChoice, setSelectedChoice] = useState("");
  const [completedRoundId, setCompletedRoundId] = useState<string | null>(null);
  const [isPersistingRound, setIsPersistingRound] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [matchResponse, setMatchResponse] = useState<SocialMatchResponse | null>(null);

  const selectedRound = useMemo(
    () => gameTable.rounds.find((round) => round.id === selectedRoundId) ?? gameTable.rounds[0],
    [gameTable.rounds, selectedRoundId],
  );
  const selectedKindRounds = useMemo(
    () => (selectedRound ? gameTable.rounds.filter((round) => round.kind === selectedRound.kind) : []),
    [gameTable.rounds, selectedRound],
  );
  const selectedPuzzleIndex = selectedKindRounds.findIndex((round) => round.id === selectedRound?.id);
  const puzzleBankLabels = selectedRound
    ? getPuzzleBankLabels(language, selectedPuzzleIndex, selectedKindRounds.length)
    : null;
  const visibleChat = memberChat.slice(0, 3);
  const hasStartedSelectedRound = startedRoundId === selectedRound?.id;
  const hasCompletedSelectedRound = completedRoundId === selectedRound?.id;

  const selectRound = (round: SocialGameRound) => {
    setSelectedRoundId(round.id);
    setStartedRoundId(null);
    setSelectedChoice("");
    setCompletedRoundId(null);
    setMatchResponse(null);
  };

  const selectPuzzleAtOffset = (offset: number) => {
    if (!selectedRound || selectedKindRounds.length < 2) return;

    const currentIndex = Math.max(0, selectedPuzzleIndex);
    const nextIndex = (currentIndex + offset + selectedKindRounds.length) % selectedKindRounds.length;
    selectRound(selectedKindRounds[nextIndex]);
  };

  const startRound = async () => {
    if (!selectedRound) return;

    setStartedRoundId(selectedRound.id);
    setSelectedChoice("");
    setCompletedRoundId(null);
    setMatchResponse(null);
    setIsPersistingRound(true);

    try {
      await apiFetch(`/api/social/rooms/${room.slug}/game-round`, {
        method: "POST",
        body: JSON.stringify({
          lang: language,
          visitId: visitId ?? undefined,
          roundId: selectedRound.id,
          gameKind: selectedRound.kind,
        }),
      });
    } finally {
      setIsPersistingRound(false);
    }
  };

  const completeRound = () => {
    if (!selectedRound) return;
    setCompletedRoundId(selectedRound.id);
  };

  const findPartner = async () => {
    if (!selectedRound || isMatching) return;

    setIsMatching(true);
    try {
      const response = await apiFetch(`/api/social/rooms/${room.slug}/match`, {
        method: "POST",
        body: JSON.stringify({
          lang: language,
          gameKind: selectedRound.kind,
        }),
      });

      if (!response.ok) return;
      setMatchResponse((await response.json()) as SocialMatchResponse);
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAF8] px-4 pb-8 pt-4 text-[#07313A] sm:px-6 lg:px-8">
      <SocialStyles />

      <div className="mx-auto max-w-6xl">
        <header className="grid grid-cols-[56px_1fr_auto] items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white text-[#075C64] shadow-[0_14px_30px_rgba(9,52,59,0.12)]"
          >
            <ArrowLeft size={27} strokeWidth={2.8} />
          </button>

          <div className="min-w-0 text-center">
            <h1 className="font-display text-[42px] leading-[0.98] text-[#07313A] sm:text-[56px] lg:text-[64px]">
              {room.name}
            </h1>
          </div>

          <div className="flex min-h-14 items-center gap-2 rounded-[18px] bg-white px-4 font-body text-[19px] font-bold text-[#087C82] shadow-[0_14px_30px_rgba(9,52,59,0.1)]">
            <Users size={23} />
            {room.participantCount}
          </div>
        </header>

        <div className="mt-5 flex items-center justify-center gap-3">
          <AgentAvatar
            agentSlug={room.agentSlug}
            fullName={room.agentFullName}
            colour={room.agentColour}
            size={64}
            title={room.agentFullName}
          />
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-body text-[25px] font-extrabold leading-tight text-[#132C35]">
              {room.agentFullName.split(" ")[0] || room.agentFullName} is hosting
              <Sparkles size={22} className="text-[#7C3AED]" />
            </p>
            <p className="mt-1 font-body text-[17px] font-semibold leading-snug text-[#557078]">{gameTable.hostLine}</p>
          </div>
        </div>

        <main className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-start">
          <section className="space-y-5">
            <div className="relative overflow-hidden rounded-[28px] bg-[#0A7372] shadow-[0_22px_52px_rgba(7,49,58,0.16)]">
              <img
                src={gameTableImage}
                alt=""
                className="aspect-[16/10] w-full object-cover"
                draggable={false}
              />
              <div className="absolute left-4 top-4 rounded-[20px] bg-white/95 px-5 py-4 shadow-[0_16px_34px_rgba(7,49,58,0.12)] backdrop-blur-sm">
                <p className="font-body text-[23px] font-extrabold leading-tight text-[#083640]">{gameTable.tableLabel}</p>
                <p className="mt-2 flex items-center gap-2 font-body text-[18px] font-bold text-[#087C82]">
                  <Users size={22} />
                  {gameTable.readyLabel}
                </p>
              </div>
            </div>

            <section aria-labelledby="game-round-heading">
              <h2 id="game-round-heading" className="font-body text-[30px] font-extrabold leading-tight text-[#07313A]">
                {gameTable.chooseRoundLabel}
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {roundCards.map((round) => {
                  const active = round.kind === selectedRound?.kind;
                  const Icon = roundIcons[round.kind];
                  return (
                    <button
                      key={round.kind}
                      type="button"
                      onClick={() => selectRound(round)}
                      data-testid={`games-round-${round.kind}`}
                      className="relative min-h-[148px] rounded-[24px] border bg-white px-3 py-4 text-center shadow-[0_12px_28px_rgba(11,60,66,0.08)] transition-transform active:scale-[0.99]"
                      style={{
                        borderColor: active ? "#087C82" : "#DDE5E3",
                        background: active ? "linear-gradient(180deg,#E9FAF8 0%,#FFFFFF 100%)" : "#FFFFFF",
                      }}
                    >
                      {active && (
                        <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#087C82] text-white">
                          <Check size={22} strokeWidth={3} />
                        </span>
                      )}
                      <span className="mx-auto flex h-[58px] w-[58px] items-center justify-center rounded-[20px] bg-[#E8F7F6] text-[#087C82]">
                        <Icon size={31} strokeWidth={2.6} />
                      </span>
                      <span className="mt-4 block font-body text-[19px] font-extrabold leading-tight text-[#0C2F38]">
                        {round.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {selectedRound && (
              <section
                className="rounded-[28px] border border-[#D8E6E2] bg-white px-5 py-5 shadow-[0_16px_34px_rgba(11,60,66,0.08)]"
                aria-live="polite"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[20px] bg-[#FFF4DA] text-[#A86200]">
                    <Brain size={31} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-body text-[25px] font-extrabold leading-tight text-[#07313A]">{selectedRound.title}</h2>
                    <p className="mt-1 font-body text-[18px] font-semibold leading-snug text-[#597178]">{selectedRound.body}</p>
                  </div>
                </div>
                {puzzleBankLabels && selectedKindRounds.length > 1 && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-[#F4FAF8] px-4 py-3">
                    <p className="font-body text-[17px] font-extrabold text-[#087C82]">
                      {puzzleBankLabels.progress}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => selectPuzzleAtOffset(-1)}
                        data-testid="games-previous-puzzle"
                        className="flex min-h-[46px] items-center justify-center gap-2 rounded-[15px] border border-[#BFDAD7] bg-white px-3 font-body text-[15px] font-extrabold text-[#075C64]"
                      >
                        <ChevronLeft size={19} />
                        {puzzleBankLabels.previous}
                      </button>
                      <button
                        type="button"
                        onClick={() => selectPuzzleAtOffset(1)}
                        data-testid="games-next-puzzle"
                        className="flex min-h-[46px] items-center justify-center gap-2 rounded-[15px] border border-[#087C82] bg-white px-3 font-body text-[15px] font-extrabold text-[#075C64]"
                      >
                        {puzzleBankLabels.next}
                        <ChevronRight size={19} />
                      </button>
                    </div>
                  </div>
                )}

                {hasStartedSelectedRound ? (
                  <div className="mt-5">
                    <p className="font-body text-[22px] font-bold leading-snug text-[#173941]">{selectedRound.prompt}</p>
                    <p className="mt-3 rounded-[18px] bg-[#F4FAF8] px-4 py-3 font-body text-[17px] font-semibold leading-snug text-[#527079]">
                      {getHintLabel(language)}: {selectedRound.hint}
                    </p>

                    <div className="mt-4" aria-label={getRoundActionLabel(language)}>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {selectedRound.choices.map((choice) => {
                          const active = choice === selectedChoice;
                          return (
                            <button
                              key={choice}
                              type="button"
                              onClick={() => setSelectedChoice(choice)}
                              className="min-h-[56px] rounded-[18px] border px-4 font-body text-[18px] font-bold"
                              style={{
                                borderColor: active ? "#087C82" : "#D8E6E2",
                                background: active ? "#E8F7F6" : "#FFFFFF",
                                color: active ? "#075C64" : "#173941",
                              }}
                            >
                              {choice}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {hasCompletedSelectedRound ? (
                      <div className="mt-5 rounded-[22px] border border-[#BDE8D4] bg-[#EFFBF4] px-4 py-4">
                        <p className="flex items-center gap-2 font-body text-[19px] font-extrabold text-[#087443]">
                          <Check size={21} strokeWidth={3} />
                          {gameTable.roundCompleteLabel}
                        </p>
                        <p className="mt-2 font-body text-[18px] font-semibold leading-snug text-[#31594A]">
                          {selectedRound.successMessage}
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={completeRound}
                        disabled={!selectedChoice}
                        data-testid="games-complete-round"
                        className="mt-5 min-h-[62px] w-full rounded-[20px] bg-[#087C82] px-5 font-body text-[21px] font-extrabold text-white shadow-[0_14px_30px_rgba(8,124,130,0.18)] disabled:opacity-50"
                      >
                        {gameTable.completeRoundLabel}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="mt-5 font-body text-[20px] font-semibold leading-snug text-[#466871]">
                    {selectedRound.prompt}
                  </p>
                )}
              </section>
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-[28px] border border-[#D8E6E2] bg-white px-5 py-5 shadow-[0_16px_34px_rgba(11,60,66,0.08)]">
              <h2 className="font-body text-[27px] font-extrabold leading-tight text-[#07313A]">{gameTable.connectionTitle}</h2>
              <p className="mt-2 font-body text-[17px] font-semibold leading-snug text-[#5B747B]">{gameTable.connectionBody}</p>

              <div className="mt-5 space-y-3">
                {gameTable.readyMembers.map((member, index) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 rounded-[22px] border border-[#E2E9E7] bg-[#FCFFFD] px-4 py-4"
                  >
                    <div
                      className="relative flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full font-body text-[22px] font-extrabold text-white"
                      style={{ background: memberColours[index % memberColours.length] }}
                    >
                      {getMemberInitials(member.name)}
                      <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-[#2FB344]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-[23px] font-extrabold leading-tight text-[#173941]">{member.name}</p>
                      <p className="mt-1 font-body text-[17px] font-semibold leading-snug text-[#61777D]">{member.statusLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void findPartner()}
                      className="min-h-[52px] rounded-[17px] border border-[#087C82] px-4 font-body text-[17px] font-extrabold text-[#087C82]"
                    >
                      {gameTable.sayHelloLabel}
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void findPartner()}
                disabled={isMatching || !selectedRound}
                data-testid="games-find-partner"
                className="mt-5 flex min-h-[66px] w-full items-center justify-center gap-3 rounded-[22px] bg-[#007B7E] px-5 font-body text-[21px] font-extrabold text-white shadow-[0_16px_34px_rgba(0,123,126,0.2)] disabled:opacity-55"
              >
                <HeartHandshake size={25} />
                {isMatching ? getMatchLoadingLabel(language) : gameTable.findPartnerLabel}
              </button>

              {matchResponse && (
                <div className="mt-4 rounded-[22px] bg-[#F4FAF8] px-4 py-4" data-testid="games-match-result">
                  <p className="font-body text-[18px] font-bold leading-snug text-[#173941]">{matchResponse.agentMessage}</p>
                  {!matchResponse.noMatch && matchResponse.matchedUser && (
                    <p className="mt-2 font-body text-[17px] font-semibold text-[#087C82]">
                      {matchResponse.matchedUser.name}
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-[#D8E6E2] bg-white px-5 py-5 shadow-[0_16px_34px_rgba(11,60,66,0.08)]">
              <h2 className="font-body text-[25px] font-extrabold leading-tight text-[#07313A]">{getChatTitle(language)}</h2>
              <div className="mt-4 space-y-3">
                {visibleChat.map((item: SocialRoomChatItem, index) => (
                  <div key={item.id} className="flex gap-3 rounded-[20px] bg-[#F7FAF8] px-4 py-4">
                    <div
                      className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full font-body text-[17px] font-extrabold text-white"
                      style={{ background: memberColours[index % memberColours.length] }}
                    >
                      {getMemberInitials(item.authorName)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-body text-[17px] font-extrabold text-[#173941]">{item.authorName}</p>
                        <p className="font-body text-[14px] font-semibold text-[#7D9095]">{formatChatTime(item.createdAt, language)}</p>
                      </div>
                      <p className="mt-1 font-body text-[17px] font-semibold leading-snug text-[#5A7279]">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </main>

        <div className="sticky bottom-3 z-10 mt-5 grid gap-3 rounded-[26px] border border-[#D8E6E2] bg-white/95 p-3 shadow-[0_18px_44px_rgba(7,49,58,0.16)] backdrop-blur sm:grid-cols-2 lg:hidden">
          <button
            type="button"
            onClick={() => void startRound()}
            disabled={!selectedRound || isPersistingRound}
            data-testid="games-start-round-mobile"
            className="flex min-h-[64px] items-center justify-center gap-3 rounded-[22px] bg-[#007B7E] px-5 font-body text-[21px] font-extrabold text-white disabled:opacity-55"
          >
            <Users size={25} />
            {gameTable.startRoundLabel}
          </button>
          <button
            type="button"
            onClick={() => void findPartner()}
            disabled={isMatching || !selectedRound}
            className="flex min-h-[64px] items-center justify-center gap-3 rounded-[22px] border border-[#087C82] bg-white px-5 font-body text-[21px] font-extrabold text-[#087C82] disabled:opacity-55"
          >
            <Send size={24} />
            {gameTable.sayHelloLabel}
          </button>
        </div>

        <div className="mt-5 hidden grid-cols-2 gap-3 lg:grid">
          <button
            type="button"
            onClick={() => void startRound()}
            disabled={!selectedRound || isPersistingRound}
            data-testid="games-start-round"
            className="flex min-h-[68px] items-center justify-center gap-3 rounded-[22px] bg-[#007B7E] px-5 font-body text-[22px] font-extrabold text-white shadow-[0_16px_34px_rgba(0,123,126,0.18)] disabled:opacity-55"
          >
            <Users size={26} />
            {gameTable.startRoundLabel}
          </button>
          <button
            type="button"
            onClick={() => void findPartner()}
            disabled={isMatching || !selectedRound}
            className="flex min-h-[68px] items-center justify-center gap-3 rounded-[22px] border border-[#087C82] bg-white px-5 font-body text-[22px] font-extrabold text-[#087C82] shadow-[0_16px_34px_rgba(8,124,130,0.1)] disabled:opacity-55"
          >
            <MessageCircle size={26} />
            {gameTable.sayHelloLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
