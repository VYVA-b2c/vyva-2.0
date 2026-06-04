import {
  ArrowLeft,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Dice5,
  Eraser,
  Gamepad2,
  HeartHandshake,
  HelpCircle,
  Send,
  Spade,
  Sparkles,
  Undo2,
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
  SocialGameRoundVisual,
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
  bridge: Spade,
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
    startRoundLabel: "Start puzzle",
    completeRoundLabel: "Check answer",
    findPartnerLabel: "Find a playing partner",
    sayHelloLabel: "Say hello",
    roundCompleteLabel: "Puzzle complete",
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

type ChessPieceName = Extract<SocialGameRoundVisual, { kind: "chessBoard" }>["pieces"][number]["piece"];
type ChessPieceShape = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";

const chessPieceDescriptions: Record<ChessPieceName, string> = {
  whiteKing: "White king",
  whiteQueen: "White queen",
  whiteRook: "White rook",
  whiteBishop: "White bishop",
  whiteKnight: "White knight",
  whitePawn: "White pawn",
  blackKing: "Black king",
  blackQueen: "Black queen",
  blackRook: "Black rook",
  blackBishop: "Black bishop",
  blackKnight: "Black knight",
  blackPawn: "Black pawn",
};

const chessPieceShapes: Record<ChessPieceName, ChessPieceShape> = {
  whiteKing: "king",
  whiteQueen: "queen",
  whiteRook: "rook",
  whiteBishop: "bishop",
  whiteKnight: "knight",
  whitePawn: "pawn",
  blackKing: "king",
  blackQueen: "queen",
  blackRook: "rook",
  blackBishop: "bishop",
  blackKnight: "knight",
  blackPawn: "pawn",
};

function normalizeWordAnswer(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function getWordHelpLabel(language: SocialGameLanguage) {
  if (language === "fr") return "Afficher l'aide";
  if (language === "it") return "Mostra aiuto";
  if (language === "pt") return "Mostrar ajuda";
  if (language === "de") return "Hilfe zeigen";
  if (language === "en") return "Show help";
  return "Mostrar ayuda";
}

function getWordCheckLabel(language: SocialGameLanguage) {
  if (language === "fr") return "Verifier le mot";
  if (language === "it") return "Controlla parola";
  if (language === "pt") return "Verificar palavra";
  if (language === "de") return "Wort pruefen";
  if (language === "en") return "Check word";
  return "Comprobar palabra";
}

function getWordUndoLabel(language: SocialGameLanguage) {
  if (language === "fr") return "Annuler";
  if (language === "it") return "Annulla";
  if (language === "pt") return "Desfazer";
  if (language === "de") return "Rueckgaengig";
  if (language === "en") return "Undo";
  return "Deshacer";
}

function getWordClearLabel(language: SocialGameLanguage) {
  if (language === "fr") return "Effacer";
  if (language === "it") return "Cancella";
  if (language === "pt") return "Limpar";
  if (language === "de") return "Leeren";
  if (language === "en") return "Clear";
  return "Borrar";
}

function getWordTrayLabel(language: SocialGameLanguage) {
  if (language === "fr") return "Ta reponse";
  if (language === "it") return "La tua risposta";
  if (language === "pt") return "Sua resposta";
  if (language === "de") return "Deine Antwort";
  if (language === "en") return "Your answer";
  return "Tu respuesta";
}

function getWordRackLabel(language: SocialGameLanguage) {
  if (language === "fr") return "Lettres";
  if (language === "it") return "Lettere";
  if (language === "pt") return "Letras";
  if (language === "de") return "Steine";
  if (language === "en") return "Tiles";
  return "Letras";
}

function getWordTryAgainCopy(language: SocialGameLanguage) {
  if (language === "fr") return "Presque. Essaie un autre ordre ou utilise l'aide.";
  if (language === "it") return "Quasi. Prova un altro ordine o usa l'aiuto.";
  if (language === "pt") return "Quase. Tente outra ordem ou use a ajuda.";
  if (language === "de") return "Fast. Probiere eine andere Reihenfolge oder nutze die Hilfe.";
  if (language === "en") return "Close. Try another order or use the help.";
  return "Casi. Prueba otro orden o usa la ayuda.";
}

function normalizeChoiceAnswer(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getChoiceTryAgainCopy(language: SocialGameLanguage) {
  if (language === "fr") return "Pas tout a fait. Essaie une autre reponse.";
  if (language === "it") return "Non proprio. Prova un'altra risposta.";
  if (language === "pt") return "Ainda nao. Tente outra resposta.";
  if (language === "de") return "Noch nicht ganz. Probiere eine andere Antwort.";
  if (language === "en") return "Not quite. Try another answer.";
  return "Todavia no. Prueba otra respuesta.";
}

function DominoTile({ tile, muted = false }: { tile: [number, number]; muted?: boolean }) {
  return (
    <div
      className={`grid h-[72px] w-[116px] grid-cols-2 overflow-hidden rounded-[14px] border-2 bg-[#FFFDF7] shadow-[0_10px_20px_rgba(24,60,66,0.12)] ${muted ? "border-[#D8E6E2] opacity-75" : "border-[#087C82]"}`}
      aria-label={`Domino ${tile[0]}-${tile[1]}`}
    >
      {tile.map((value, index) => (
        <span key={`${value}-${index}`} className="flex items-center justify-center border-l border-[#E9DED0] first:border-l-0 font-body text-[24px] font-extrabold text-[#173941]">
          {value === 0 ? "-" : value}
        </span>
      ))}
    </div>
  );
}

function ChessPieceGlyph({ piece, cutout }: { piece: ChessPieceName; cutout: string }) {
  const shape = chessPieceShapes[piece];

  return (
    <svg
      aria-hidden="true"
      className="h-[84%] w-[84%] drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]"
      fill="none"
      viewBox="0 0 64 64"
    >
      {shape === "king" && (
        <g fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 8v14M25 15h14" strokeWidth="5" />
          <path d="M24 28c1-7 15-7 16 0l4 18H20l4-18Z" strokeWidth="2" />
          <path d="M18 51h28v6H18z" strokeWidth="2" />
        </g>
      )}
      {shape === "queen" && (
        <g fill="currentColor" stroke="currentColor" strokeLinejoin="round">
          <circle cx="17" cy="18" r="4" />
          <circle cx="32" cy="13" r="4" />
          <circle cx="47" cy="18" r="4" />
          <path d="M14 25l10 18h16l10-18-12 8-6-15-6 15-12-8Z" strokeWidth="2" />
          <path d="M20 49h24v7H20z" strokeWidth="2" />
        </g>
      )}
      {shape === "rook" && (
        <g fill="currentColor" stroke="currentColor" strokeLinejoin="round">
          <path d="M18 13h9v7h10v-7h9v20H18V13Z" strokeWidth="2" />
          <path d="M24 33h16l4 15H20l4-15Z" strokeWidth="2" />
          <path d="M18 51h28v6H18z" strokeWidth="2" />
        </g>
      )}
      {shape === "bishop" && (
        <g fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 9c-8 7-13 17-13 27 0 7 5 11 13 11s13-4 13-11c0-10-5-20-13-27Z" strokeWidth="2" />
          <path d="M35 19 25 35" stroke={cutout} strokeWidth="4" />
          <path d="M24 49h16l5 8H19l5-8Z" strokeWidth="2" />
        </g>
      )}
      {shape === "knight" && (
        <g fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 54h28l-5-10c4-6 5-13 3-20-3-8-10-14-21-17l-3 11-9 5 9 6-5 10 12 3-9 12Z" strokeWidth="2" />
          <circle cx="32" cy="22" r="2.5" fill={cutout} stroke="none" />
          <path d="M24 29h7" stroke={cutout} strokeWidth="3" />
        </g>
      )}
      {shape === "pawn" && (
        <g fill="currentColor" stroke="currentColor" strokeLinejoin="round">
          <circle cx="32" cy="18" r="9" strokeWidth="2" />
          <path d="M25 31h14l5 16H20l5-16Z" strokeWidth="2" />
          <path d="M18 51h28v6H18z" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

function ChessBoardVisual({ visual }: { visual: Extract<SocialGameRoundVisual, { kind: "chessBoard" }> }) {
  const piecesBySquare = new Map(visual.pieces.map((piece) => [piece.square, piece]));
  const highlightSet = new Set(visual.highlights ?? []);
  const arrowTargets = new Set((visual.arrows ?? []).flatMap((arrow) => [arrow.from, arrow.to]));

  return (
    <div className="rounded-[24px] border border-[#D8E6E2] bg-[#F7FAF8] p-4" data-testid="games-visual-chess">
      <p className="font-body text-[16px] font-extrabold leading-snug text-[#31555D]">{visual.caption}</p>
      <div className="mt-3 grid aspect-square max-w-[360px] grid-cols-8 overflow-hidden rounded-[18px] border border-[#BFDAD7]">
        {Array.from({ length: 64 }, (_, index) => {
          const file = index % 8;
          const rank = 8 - Math.floor(index / 8);
          const square = `${String.fromCharCode("a".charCodeAt(0) + file)}${rank}`;
          const piece = piecesBySquare.get(square);
          const dark = (file + rank) % 2 === 0;
          const marked = highlightSet.has(square) || arrowTargets.has(square);

          return (
            <div
              key={square}
              className={`relative flex items-center justify-center text-[11px] font-black ${dark ? "bg-[#8CB5A7]" : "bg-[#F2E7D5]"}`}
            >
              {marked && <span className="absolute inset-1 rounded-[8px] border-2 border-[#F59E0B]" />}
              {piece && (
                <span
                  aria-label={chessPieceDescriptions[piece.piece]}
                  className={`relative z-10 flex h-[82%] w-[82%] items-center justify-center rounded-full border shadow-[0_7px_14px_rgba(23,57,65,0.18)] ${piece.piece.startsWith("white") ? "border-[#C9B99D] bg-[#FFFDF7] text-[#07313A]" : "border-[#173941] bg-[#173941] text-[#FFFDF7]"}`}
                  role="img"
                >
                  <ChessPieceGlyph piece={piece.piece} cutout={piece.piece.startsWith("white") ? "#FFFDF7" : "#173941"} />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DominoesVisual({ visual }: { visual: Extract<SocialGameRoundVisual, { kind: "dominoes" }> }) {
  const tiles = visual.candidateTiles ?? visual.hand ?? (visual.focusTile ? [visual.focusTile] : []);

  return (
    <div className="rounded-[24px] border border-[#D8E6E2] bg-[#F7FAF8] p-4" data-testid="games-visual-dominoes">
      <p className="font-body text-[16px] font-extrabold leading-snug text-[#31555D]">{visual.caption}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {visual.openEnds && (
          <div className="flex items-center gap-2 rounded-[18px] bg-white px-4 py-3 font-body text-[16px] font-extrabold text-[#075C64]">
            <span>{visual.openEnds[0]}</span>
            <span className="h-px w-8 bg-[#BFDAD7]" />
            <span>{visual.openEnds[1]}</span>
          </div>
        )}
        {visual.playedTile && <DominoTile tile={visual.playedTile} />}
        {tiles.map((tile, index) => (
          <DominoTile key={`${tile[0]}-${tile[1]}-${index}`} tile={tile} muted={Boolean(visual.playedTile)} />
        ))}
      </div>
      {(visual.target !== undefined || visual.desired !== undefined || visual.avoid !== undefined) && (
        <div className="mt-3 flex flex-wrap gap-2 font-body text-[14px] font-extrabold text-[#597178]">
          {visual.target !== undefined && <span className="rounded-full bg-white px-3 py-1">Target {visual.target}</span>}
          {visual.desired !== undefined && <span className="rounded-full bg-white px-3 py-1">Keep {visual.desired}</span>}
          {visual.avoid !== undefined && <span className="rounded-full bg-white px-3 py-1">Avoid {visual.avoid}</span>}
        </div>
      )}
    </div>
  );
}

function BridgeCardsVisual({ visual }: { visual: Extract<SocialGameRoundVisual, { kind: "bridgeCards" }> }) {
  return (
    <div className="rounded-[24px] border border-[#D8E6E2] bg-[#F7FAF8] p-4" data-testid="games-visual-bridge">
      <p className="font-body text-[16px] font-extrabold leading-snug text-[#31555D]">{visual.caption}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {visual.points !== undefined && <span className="rounded-full bg-white px-4 py-2 font-body text-[15px] font-extrabold text-[#075C64]">{visual.points} points</span>}
        {visual.partnerBid && <span className="rounded-full bg-white px-4 py-2 font-body text-[15px] font-extrabold text-[#075C64]">Partner: {visual.partnerBid}</span>}
        {visual.contract && <span className="rounded-full bg-white px-4 py-2 font-body text-[15px] font-extrabold text-[#075C64]">Contract: {visual.contract}</span>}
      </div>
      {visual.suitLengths && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {visual.suitLengths.map((item) => (
            <div key={`${item.suit}-${item.length}`} className="rounded-[16px] bg-white px-4 py-3 font-body text-[16px] font-extrabold text-[#173941]">
              {item.length} {item.suit}
            </div>
          ))}
        </div>
      )}
      {visual.cards && (
        <div className="mt-3 flex flex-wrap gap-2">
          {visual.cards.map((card, index) => (
            <div key={`${card.rank}-${card.suit}-${index}`} className="flex h-[92px] w-[68px] flex-col justify-between rounded-[14px] border border-[#D9C8AD] bg-white px-2 py-2 shadow-[0_10px_20px_rgba(24,60,66,0.12)]">
              <span className="font-body text-[15px] font-black text-[#173941]">{card.rank}</span>
              <span className="font-body text-[13px] font-extrabold text-[#A86200]">{card.suit}</span>
            </div>
          ))}
        </div>
      )}
      {visual.missingCard && (
        <p className="mt-3 rounded-[16px] bg-white px-4 py-3 font-body text-[15px] font-extrabold text-[#597178]">
          Missing: {visual.missingCard.rank} of {visual.missingCard.suit}
        </p>
      )}
    </div>
  );
}

function PuzzleVisualPanel({ visual }: { visual?: SocialGameRoundVisual }) {
  if (!visual || visual.kind === "wordTiles") return null;
  if (visual.kind === "chessBoard") return <ChessBoardVisual visual={visual} />;
  if (visual.kind === "dominoes") return <DominoesVisual visual={visual} />;
  return <BridgeCardsVisual visual={visual} />;
}

type WordTilesInteractionProps = {
  round: SocialGameRound;
  visual: Extract<SocialGameRoundVisual, { kind: "wordTiles" }>;
  language: SocialGameLanguage;
  selectedTileIndices: number[];
  showHelp: boolean;
  feedback: string | null;
  isComplete: boolean;
  roundCompleteLabel: string;
  onChooseTile: (index: number) => void;
  onUndo: () => void;
  onClear: () => void;
  onShowHelp: () => void;
  onCheckAnswer: () => void;
  onChooseHelpChoice: (choice: string) => void;
};

function WordTilesInteraction({
  round,
  visual,
  language,
  selectedTileIndices,
  showHelp,
  feedback,
  isComplete,
  roundCompleteLabel,
  onChooseTile,
  onUndo,
  onClear,
  onShowHelp,
  onCheckAnswer,
  onChooseHelpChoice,
}: WordTilesInteractionProps) {
  const selectedSet = new Set(selectedTileIndices);
  const selectedTiles = selectedTileIndices.map((index) => visual.tiles[index]).filter(Boolean);
  const traySlots = Array.from({ length: Math.max(1, visual.answerLength) }, (_, index) => selectedTiles[index] ?? "");

  return (
    <div className="mt-5 space-y-4" data-testid="games-word-tiles-panel">
      <div className="rounded-[24px] border border-[#D8E6E2] bg-[#F7FAF8] p-4">
        <div className="flex flex-wrap gap-2">
          {visual.baseWord && <span className="rounded-full bg-white px-4 py-2 font-body text-[15px] font-extrabold text-[#075C64]">Base: {visual.baseWord}</span>}
          {visual.pattern && <span className="rounded-full bg-white px-4 py-2 font-body text-[15px] font-extrabold text-[#075C64]">{visual.pattern}</span>}
          {visual.clue && <span className="rounded-full bg-white px-4 py-2 font-body text-[15px] font-extrabold text-[#597178]">{visual.clue}</span>}
        </div>

        <div className="mt-4">
          <p className="font-body text-[15px] font-extrabold uppercase text-[#597178]">{getWordRackLabel(language)}</p>
          <div className="mt-2 flex flex-wrap gap-2" aria-label={getWordRackLabel(language)}>
            {visual.tiles.map((tile, index) => {
              const used = selectedSet.has(index);
              return (
                <button
                  key={`${tile}-${index}`}
                  type="button"
                  onClick={() => onChooseTile(index)}
                  disabled={used || isComplete || selectedTileIndices.length >= visual.answerLength}
                  data-testid={`word-tile-${index}`}
                  className="flex min-h-[58px] min-w-[58px] items-center justify-center rounded-[16px] border border-[#D9C8AD] bg-[#FFF7E6] px-3 font-body text-[22px] font-black text-[#173941] shadow-[0_10px_18px_rgba(24,60,66,0.10)] disabled:opacity-35"
                >
                  {tile}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <p className="font-body text-[15px] font-extrabold uppercase text-[#597178]">{getWordTrayLabel(language)}</p>
          <div className="mt-2 flex flex-wrap gap-2" data-testid="word-answer-tray">
            {traySlots.map((tile, index) => (
              <div
                key={`${tile || "slot"}-${index}`}
                className="flex min-h-[58px] min-w-[58px] items-center justify-center rounded-[16px] border-2 border-dashed border-[#BFDAD7] bg-white px-3 font-body text-[22px] font-black text-[#075C64]"
              >
                {tile}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={onUndo}
            disabled={!selectedTileIndices.length || isComplete}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#BFDAD7] bg-white px-3 font-body text-[15px] font-extrabold text-[#075C64] disabled:opacity-40"
          >
            <Undo2 size={18} />
            {getWordUndoLabel(language)}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!selectedTileIndices.length || isComplete}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#BFDAD7] bg-white px-3 font-body text-[15px] font-extrabold text-[#075C64] disabled:opacity-40"
          >
            <Eraser size={18} />
            {getWordClearLabel(language)}
          </button>
          <button
            type="button"
            onClick={onShowHelp}
            disabled={isComplete}
            data-testid="word-show-help"
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#BFDAD7] bg-white px-3 font-body text-[15px] font-extrabold text-[#075C64] disabled:opacity-40"
          >
            <HelpCircle size={18} />
            {getWordHelpLabel(language)}
          </button>
          <button
            type="button"
            onClick={onCheckAnswer}
            disabled={selectedTileIndices.length < visual.answerLength || isComplete}
            data-testid="word-check-answer"
            className="min-h-[48px] rounded-[16px] bg-[#087C82] px-3 font-body text-[15px] font-extrabold text-white disabled:opacity-45"
          >
            {getWordCheckLabel(language)}
          </button>
        </div>
      </div>

      {feedback && !isComplete && (
        <p className="rounded-[18px] bg-[#FFF7E6] px-4 py-3 font-body text-[17px] font-extrabold leading-snug text-[#A86200]">
          {feedback}
        </p>
      )}

      {showHelp && !isComplete && (
        <div className="rounded-[20px] bg-[#F4FAF8] px-4 py-3" data-testid="word-help-choices">
          <p className="font-body text-[16px] font-extrabold leading-snug text-[#527079]">
            {getHintLabel(language)}: {round.hint}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {round.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => onChooseHelpChoice(choice)}
                className="min-h-[50px] rounded-[16px] border border-[#D8E6E2] bg-white px-4 font-body text-[17px] font-bold text-[#173941]"
              >
                {choice}
              </button>
            ))}
          </div>
        </div>
      )}

      {isComplete && (
        <div className="rounded-[22px] border border-[#BDE8D4] bg-[#EFFBF4] px-4 py-4">
          <p className="flex items-center gap-2 font-body text-[19px] font-extrabold text-[#087443]">
            <Check size={21} strokeWidth={3} />
            {roundCompleteLabel}
          </p>
          <p className="mt-2 font-body text-[18px] font-semibold leading-snug text-[#31594A]">
            {round.successMessage}
          </p>
        </div>
      )}
    </div>
  );
}

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
  const [selectedWordTileIndices, setSelectedWordTileIndices] = useState<number[]>([]);
  const [showWordHelp, setShowWordHelp] = useState(false);
  const [wordFeedback, setWordFeedback] = useState<string | null>(null);
  const [choiceFeedback, setChoiceFeedback] = useState<string | null>(null);

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
  const selectedWordVisual = selectedRound?.visual?.kind === "wordTiles" ? selectedRound.visual : null;

  const selectRound = (round: SocialGameRound) => {
    setSelectedRoundId(round.id);
    setStartedRoundId(null);
    setSelectedChoice("");
    setCompletedRoundId(null);
    setMatchResponse(null);
    setSelectedWordTileIndices([]);
    setShowWordHelp(false);
    setWordFeedback(null);
    setChoiceFeedback(null);
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
    setSelectedWordTileIndices([]);
    setShowWordHelp(false);
    setWordFeedback(null);
    setChoiceFeedback(null);
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
    if (!selectedRound || !selectedChoice) return;

    if (normalizeChoiceAnswer(selectedChoice) === normalizeChoiceAnswer(selectedRound.answer)) {
      setCompletedRoundId(selectedRound.id);
      setChoiceFeedback(null);
      return;
    }

    setChoiceFeedback(getChoiceTryAgainCopy(language));
  };

  const chooseWordTile = (index: number) => {
    if (!selectedWordVisual || hasCompletedSelectedRound) return;
    setSelectedWordTileIndices((current) => {
      if (current.includes(index) || current.length >= selectedWordVisual.answerLength) return current;
      return [...current, index];
    });
    setWordFeedback(null);
  };

  const undoWordTile = () => {
    setSelectedWordTileIndices((current) => current.slice(0, -1));
    setWordFeedback(null);
  };

  const clearWordTiles = () => {
    setSelectedWordTileIndices([]);
    setWordFeedback(null);
  };

  const completeWordChoice = (choice: string) => {
    if (!selectedRound) return;

    if (normalizeWordAnswer(choice) === normalizeWordAnswer(selectedRound.answer)) {
      setSelectedChoice(selectedRound.answer);
      setCompletedRoundId(selectedRound.id);
      setWordFeedback(null);
    } else {
      setShowWordHelp(true);
      setWordFeedback(getWordTryAgainCopy(language));
    }
  };

  const checkWordAnswer = () => {
    if (!selectedRound || !selectedWordVisual) return;

    const answer = selectedWordTileIndices.map((index) => selectedWordVisual.tiles[index]).join("");
    completeWordChoice(answer);
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
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#D8E6E2] bg-[#F4FAF8] px-4 py-3">
                    <p className="font-body text-[18px] font-extrabold text-[#087C82]">
                      {puzzleBankLabels.progress}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => selectPuzzleAtOffset(-1)}
                        aria-label={puzzleBankLabels.previous}
                        data-testid="games-previous-puzzle"
                        className="flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#BFDAD7] bg-white px-3 font-body text-[15px] font-extrabold text-[#075C64] shadow-[0_8px_18px_rgba(11,60,66,0.06)]"
                      >
                        <ChevronLeft size={19} />
                        <span className="hidden sm:inline">{puzzleBankLabels.previous}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => selectPuzzleAtOffset(1)}
                        aria-label={puzzleBankLabels.next}
                        data-testid="games-next-puzzle"
                        className="flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] bg-[#087C82] px-4 font-body text-[16px] font-extrabold text-white shadow-[0_10px_22px_rgba(8,124,130,0.16)]"
                      >
                        <span>{puzzleBankLabels.next}</span>
                        <ChevronRight size={19} />
                      </button>
                    </div>
                  </div>
                )}

                {hasStartedSelectedRound ? (
                  <div className="mt-5">
                    <div className="mb-4">
                      <PuzzleVisualPanel visual={selectedRound.visual} />
                    </div>
                    <p className="font-body text-[22px] font-bold leading-snug text-[#173941]">{selectedRound.prompt}</p>

                    {selectedWordVisual ? (
                      <WordTilesInteraction
                        round={selectedRound}
                        visual={selectedWordVisual}
                        language={language}
                        selectedTileIndices={selectedWordTileIndices}
                        showHelp={showWordHelp}
                        feedback={wordFeedback}
                        isComplete={hasCompletedSelectedRound}
                        roundCompleteLabel={gameTable.roundCompleteLabel}
                        onChooseTile={chooseWordTile}
                        onUndo={undoWordTile}
                        onClear={clearWordTiles}
                        onShowHelp={() => setShowWordHelp(true)}
                        onCheckAnswer={checkWordAnswer}
                        onChooseHelpChoice={completeWordChoice}
                      />
                    ) : (
                      <>
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
                                  onClick={() => {
                                    setSelectedChoice(choice);
                                    setChoiceFeedback(null);
                                  }}
                                  aria-pressed={active}
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
                        {choiceFeedback && (
                          <p className="mt-3 rounded-[18px] bg-[#FFF7E8] px-4 py-3 font-body text-[17px] font-bold leading-snug text-[#8A5200]" role="status">
                            {choiceFeedback}
                          </p>
                        )}

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
                            className="mt-5 flex min-h-[62px] w-full items-center justify-center gap-3 rounded-[20px] bg-[#087C82] px-5 font-body text-[21px] font-extrabold text-white shadow-[0_14px_30px_rgba(8,124,130,0.18)] disabled:bg-[#D8E6E2] disabled:text-[#61777D] disabled:shadow-none"
                          >
                            <Check size={24} strokeWidth={3} />
                            {gameTable.completeRoundLabel}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="mt-5">
                      <PuzzleVisualPanel visual={selectedRound.visual} />
                    </div>
                    <p className="mt-5 font-body text-[20px] font-semibold leading-snug text-[#466871]">
                      {selectedRound.prompt}
                    </p>
                    <button
                      type="button"
                      onClick={() => void startRound()}
                      disabled={!selectedRound || isPersistingRound}
                      data-testid="games-start-round"
                      className="mt-5 flex min-h-[64px] w-full items-center justify-center gap-3 rounded-[22px] bg-[#007B7E] px-5 font-body text-[21px] font-extrabold text-white shadow-[0_16px_34px_rgba(0,123,126,0.18)] disabled:opacity-55"
                    >
                      <Users size={25} />
                      {gameTable.startRoundLabel}
                    </button>
                  </>
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

        <div className="sticky bottom-3 z-10 mt-5 rounded-[26px] border border-[#D8E6E2] bg-white/95 p-3 shadow-[0_18px_44px_rgba(7,49,58,0.16)] backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => void findPartner()}
            disabled={isMatching || !selectedRound}
            className="flex min-h-[64px] w-full items-center justify-center gap-3 rounded-[22px] border border-[#087C82] bg-white px-5 font-body text-[21px] font-extrabold text-[#087C82] disabled:opacity-55"
          >
            <Send size={24} />
            {gameTable.findPartnerLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
