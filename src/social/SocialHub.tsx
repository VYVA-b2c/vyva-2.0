import {
  BookOpen,
  ChefHat,
  ChevronRight,
  Footprints,
  Gamepad2,
  HeartHandshake,
  Leaf,
  MessageCircleHeart,
  Music2,
  Share2,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n";
import VoiceHero from "@/components/VoiceHero";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import { BottomSheet, EmptyState } from "@/components/vyva-ui";
import { useRouteVoiceAutoStart } from "@/hooks/useRouteVoiceAutoStart";
import AgentAvatar from "./AgentAvatar";
import SocialStyles from "./SocialStyles";
import {
  formatLiveText,
  getRoomBadge,
  getRoomPickerName,
  getSocialCopy,
  getSocialGameLanguage,
  getSocialLanguage,
} from "./roomUtils";
import {
  TogetherProximityIcon,
  TogetherSafetyIcon,
  getTogetherPlans,
  getTogetherRoomCopy,
  isTogetherRoom,
} from "./togetherRoom";
import type { SocialGameLanguage, SocialHubResponse, SocialLanguage, SocialRoom } from "./types";

const FAST_HELP_WINDOW_SIZE = 3;
const ROOM_ROTATION_MS = 9000;
const FAST_HELP_PRIORITY = ["kitchen-table", "music-room", "garden-corner"] as const;

function getMoreRoomsLabel(language: SocialLanguage) {
  if (language === "es") return "Mostrar más salas";
  if (language === "de") return "Mehr Räume zeigen";
  return "Show more rooms";
}

function getLoadingRoomsLabel(language: SocialLanguage) {
  if (language === "es") return "Preparando salas...";
  if (language === "de") return "Raeume werden vorbereitet...";
  return "Preparing rooms...";
}

type SocialPrimaryCard = {
  id: "match" | "socialise" | "share" | "participate";
  title: string;
  description: string;
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  glow: string;
};

type SocialHubEntryCopy = {
  focusDescription: string;
  fastHelpKicker: string;
  fastHelpTitle: string;
  cards: SocialPrimaryCard[];
};

function getSocialHubEntryCopy(language: SocialLanguage): SocialHubEntryCopy {
  const baseCards: Pick<SocialPrimaryCard, "id" | "title" | "Icon" | "iconBg" | "iconColor" | "glow">[] = [
    {
      id: "match",
      title: "Match",
      Icon: HeartHandshake,
      iconBg: "#ECFDF5",
      iconColor: "#0A7C4E",
      glow: "rgba(16,185,129,0.16)",
    },
    {
      id: "socialise",
      title: "Socialise",
      Icon: Users,
      iconBg: "#F5F3FF",
      iconColor: "#6D28D9",
      glow: "rgba(109,40,217,0.16)",
    },
    {
      id: "share",
      title: "Share",
      Icon: Share2,
      iconBg: "#EFF6FF",
      iconColor: "#1D4ED8",
      glow: "rgba(37,99,235,0.14)",
    },
    {
      id: "participate",
      title: "Participate",
      Icon: Sparkles,
      iconBg: "#FEF3C7",
      iconColor: "#B45309",
      glow: "rgba(180,83,9,0.14)",
    },
  ];

  if (language === "es") {
    return {
      focusDescription: "VYVA puede usar intereses, sala y estilo de conversacion para sugerir un buen lugar por donde empezar.",
      fastHelpKicker: "Ayuda rapida",
      fastHelpTitle: "Donde quieres entrar ahora?",
      cards: baseCards.map((card) => ({
        ...card,
        description: {
          match: "Encuentra una conexion amable.",
          socialise: "Explora las salas abiertas.",
          share: "Comparte un recuerdo o una idea.",
          participate: "Unete a una actividad compartida.",
        }[card.id],
      })),
    };
  }

  if (language === "de") {
    return {
      focusDescription: "VYVA kann Interessen, Raumkontext und Gespraechsstil nutzen, um einen warmen Startpunkt vorzuschlagen.",
      fastHelpKicker: "Schnelle Hilfe",
      fastHelpTitle: "Wo moechtest du mitmachen?",
      cards: baseCards.map((card) => ({
        ...card,
        description: {
          match: "Finde eine freundliche Verbindung.",
          socialise: "Entdecke offene Raeume.",
          share: "Teile eine Erinnerung oder Idee.",
          participate: "Mach bei einer gemeinsamen Aktivitaet mit.",
        }[card.id],
      })),
    };
  }

  return {
    focusDescription: "VYVA can use interests, room context, and conversation style to suggest one warm place to start.",
    fastHelpKicker: "Fast help",
    fastHelpTitle: "Where would you like to join in?",
    cards: baseCards.map((card) => ({
      ...card,
      description: {
        match: "Find a kind connection.",
        socialise: "Browse open rooms.",
        share: "Share a memory, song, or thought.",
        participate: "Join a game, chat, or shared activity.",
      }[card.id],
    })),
  };
}

type FastHelpRoomCopy = {
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  border: string;
  shadow: string;
};

const FAST_HELP_THEMES = {
  green: {
    iconBg: "#ECFDF5",
    iconColor: "#0A7C4E",
    border: "#BDEBD8",
    shadow: "rgba(16,185,129,0.12)",
  },
  purple: {
    iconBg: "#F5F3FF",
    iconColor: "#6D28D9",
    border: "#D9C7F8",
    shadow: "rgba(109,40,217,0.13)",
  },
  amber: {
    iconBg: "#FEF3C7",
    iconColor: "#B45309",
    border: "#F8D97B",
    shadow: "rgba(217,119,6,0.12)",
  },
  blue: {
    iconBg: "#EFF6FF",
    iconColor: "#1D4ED8",
    border: "#BFDBFE",
    shadow: "rgba(37,99,235,0.11)",
  },
  rose: {
    iconBg: "#FFF1F2",
    iconColor: "#E11D48",
    border: "#FECDD3",
    shadow: "rgba(225,29,72,0.10)",
  },
  teal: {
    iconBg: "#CCFBF1",
    iconColor: "#0F766E",
    border: "#99F6E4",
    shadow: "rgba(13,148,136,0.11)",
  },
} as const;

function orderFastHelpRooms(rooms: SocialRoom[]) {
  const roomBySlug = new Map(rooms.map((room) => [room.slug, room]));
  const ordered: SocialRoom[] = [];
  const seen = new Set<string>();

  FAST_HELP_PRIORITY.forEach((slug) => {
    const room = roomBySlug.get(slug);
    if (room) {
      ordered.push(room);
      seen.add(room.slug);
    }
  });

  rooms.forEach((room) => {
    if (!seen.has(room.slug)) {
      ordered.push(room);
      seen.add(room.slug);
    }
  });

  return ordered;
}

function getFastHelpRoomCopy(room: SocialRoom, language: SocialLanguage): FastHelpRoomCopy {
  const fallbackName = isTogetherRoom(room.slug) ? room.name : getRoomPickerName(room.slug, language, room.name);
  const subtitle = room.contentTitle || room.topic;

  if (room.slug === "kitchen-table") {
    return {
      title: "Cook Something Simple",
      subtitle,
      Icon: ChefHat,
      ...FAST_HELP_THEMES.amber,
    };
  }

  if (room.slug === "music-room" || room.slug === "music-salon") {
    return {
      title: "Bring a Song",
      subtitle,
      Icon: Music2,
      ...FAST_HELP_THEMES.purple,
    };
  }

  if (room.slug === "garden-corner" || room.slug === "garden-chat") {
    return {
      title: "Grow Something Together",
      subtitle,
      Icon: Leaf,
      ...FAST_HELP_THEMES.green,
    };
  }

  if (room.slug === "reading-room" || room.slug === "book-club") {
    return {
      title: "Find a Reading Corner",
      subtitle,
      Icon: BookOpen,
      ...FAST_HELP_THEMES.blue,
    };
  }

  if (room.slug === "games-room" || room.slug === "chess-corner") {
    return {
      title: "Play a Light Game",
      subtitle,
      Icon: Gamepad2,
      ...FAST_HELP_THEMES.amber,
    };
  }

  if (room.slug === "morning-movement" || room.slug === "walking-companion" || room.slug === "walking-club") {
    return {
      title: "Move Gently Together",
      subtitle,
      Icon: Footprints,
      ...FAST_HELP_THEMES.teal,
    };
  }

  return {
    title: `Join ${fallbackName}`,
    subtitle,
    Icon: MessageCircleHeart,
    ...FAST_HELP_THEMES.rose,
  };
}

type SocialPrimaryCardViewProps = {
  card: SocialPrimaryCard;
};

function SocialPrimaryCardView({ card }: SocialPrimaryCardViewProps) {
  const Icon = card.Icon;

  return (
    <article
      data-testid={`card-social-primary-${card.id}`}
      className="min-h-[132px] rounded-[24px] border border-[#EDE2D1] bg-[#FFFCF8] px-5 py-5 shadow-[0_14px_30px_rgba(60,38,20,0.07)]"
      style={{ boxShadow: `0 16px 34px ${card.glow}, 0 2px 10px rgba(43,31,24,0.05)` }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-[18px]"
        style={{ background: card.iconBg, color: card.iconColor }}
      >
        <Icon size={25} strokeWidth={2.45} aria-hidden="true" />
      </div>
      <h2 className="mt-5 font-body text-[20px] font-black leading-tight text-vyva-text-1">
        {card.title}
      </h2>
      <p className="mt-1 max-w-[18rem] font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
        {card.description}
      </p>
    </article>
  );
}

type FastHelpRoomRowProps = {
  room: SocialRoom;
  language: SocialLanguage;
  onSelect: (room: SocialRoom) => void;
};

function FastHelpRoomRow({ room, language, onSelect }: FastHelpRoomRowProps) {
  const roomCopy = getFastHelpRoomCopy(room, language);
  const Icon = roomCopy.Icon;

  return (
    <button
      type="button"
      data-testid={`button-social-fast-help-${room.slug}`}
      onClick={() => onSelect(room)}
      className="vyva-tap flex min-h-[86px] w-full items-center gap-4 rounded-[22px] border bg-white px-4 py-4 text-left transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
      style={{
        borderColor: roomCopy.border,
        boxShadow: `0 10px 24px ${roomCopy.shadow}`,
      }}
    >
      <span
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px]"
        style={{ background: roomCopy.iconBg, color: roomCopy.iconColor }}
      >
        <Icon size={24} strokeWidth={2.4} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-[18px] font-black leading-tight text-vyva-text-1">
          {roomCopy.title}
        </span>
        <span className="mt-1 block max-w-[26rem] overflow-hidden break-words font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
          {roomCopy.subtitle}
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-1 rounded-full bg-[#FBF7F0] px-3 py-1.5 font-body text-[12px] font-bold text-vyva-text-2 sm:inline-flex">
        <Users size={14} strokeWidth={2.4} aria-hidden="true" />
        {formatLiveText(room, language)}
      </span>
      <ChevronRight size={22} strokeWidth={2.5} className="shrink-0 text-vyva-text-3" aria-hidden="true" />
    </button>
  );
}

type FastHelpDotsProps = {
  count: number;
  activeIndex: number;
};

function FastHelpDots({ count, activeIndex }: FastHelpDotsProps) {
  if (count <= 1) return null;

  return (
    <div className="flex gap-1" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className="h-1.5 rounded-full transition-all"
          style={{
            width: index === activeIndex ? 18 : 7,
            background: index === activeIndex ? "#6D28D9" : "#D9C7F8",
          }}
        />
      ))}
    </div>
  );
}

type RoomDetailSheetProps = {
  room: SocialRoom;
  language: SocialLanguage;
  togetherLanguage: SocialGameLanguage;
  onClose: () => void;
  onEnter: (slug: string) => void;
};

function RoomDetailSheet({ room, language, togetherLanguage, onClose, onEnter }: RoomDetailSheetProps) {
  const copy = getSocialCopy(language);
  const description = room.contentBody || room.opener || room.topic;
  const togetherCopy = isTogetherRoom(room.slug) ? getTogetherRoomCopy(togetherLanguage) : null;
  const togetherPlans = togetherCopy ? getTogetherPlans(togetherLanguage) : [];

  return (
    <BottomSheet
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      closeLabel={copy.closeDetails}
      footer={
        <button
          type="button"
          onClick={() => onEnter(room.slug)}
          data-testid="button-social-room-enter"
          className="min-h-[62px] w-full rounded-full bg-[#6D28D9] px-6 font-body text-[20px] font-bold text-white shadow-[0_14px_28px_rgba(109,40,217,0.22)]"
        >
          {togetherCopy ? room.ctaLabel : copy.enterSelectedRoom}
        </button>
      }
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <AgentAvatar
            agentSlug={room.agentSlug}
            fullName={room.agentFullName}
            colour={room.agentColour}
            size={76}
            title={room.agentFullName}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[#F2EBFF] px-4 py-2 font-body text-[17px] font-semibold text-[#6D28D9]">
            {togetherCopy ? room.name : getRoomBadge(room.slug, language)}
          </span>
          <span className="rounded-full bg-white px-4 py-2 font-body text-[17px] font-semibold text-[#6E5A8A]">
            {formatLiveText(room, language)}
          </span>
        </div>

        <h2 className="mt-5 font-display text-[34px] leading-[1.02] text-[#24172F] sm:text-[38px]">
          {room.name}
        </h2>
        <p className="mt-2 font-body text-[20px] font-semibold text-[#5D4777] sm:text-[22px]">
          {room.agentFullName}
        </p>
        <p className="mt-1 font-body text-[18px] text-[#7A677F]">
          {room.agentCredential}
        </p>

        <div className="mt-5 rounded-[26px] bg-white p-4 sm:p-5">
          <p className="font-body text-[16px] font-bold uppercase tracking-[0.16em] text-[#6D28D9]">
            {copy.topicLabel}
          </p>
          <p className="mt-2 font-body text-[21px] leading-[1.35] text-[#24172F] sm:text-[22px]">
            {room.topic}
          </p>
          <p className="mt-3 font-body text-[17px] leading-[1.45] text-[#7A677F] sm:text-[18px]">
            {description}
          </p>
        </div>

        {togetherCopy && (
          <>
            <section className="mt-5">
              <p className="font-body text-[16px] font-bold uppercase tracking-[0.14em] text-[#6D28D9]">
                {togetherCopy.planLabel}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {togetherPlans.map((plan) => {
                  const Icon = plan.icon;
                  return (
                    <div
                      key={plan.id}
                      className="rounded-[22px] border border-[#E8DDCF] bg-white px-4 py-4 shadow-[0_10px_22px_rgba(45,31,66,0.05)]"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] ${
                            plan.proximityMatters ? "bg-[#ECFDF5] text-[#0F766E]" : "bg-[#F7F2FF] text-[#6D28D9]"
                          }`}
                        >
                          <Icon size={22} strokeWidth={2.35} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-body text-[18px] font-bold leading-[1.16] text-[#24172F]">
                            {plan.label}
                          </p>
                          <p className="mt-1 font-body text-[15px] leading-[1.32] text-[#7A677F]">
                            {plan.detail}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FBF7F0] px-3 py-1.5 font-body text-[13px] font-bold text-[#6E5A8A]">
                        <TogetherProximityIcon size={14} strokeWidth={2.4} aria-hidden="true" />
                        {plan.proximity}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-5 rounded-[24px] border border-[#BDEBD8] bg-[#F0FDF7] px-4 py-4">
              <div className="flex items-start gap-3">
                <TogetherProximityIcon size={23} strokeWidth={2.5} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
                <div>
                  <p className="font-body text-[19px] font-bold text-[#124C3D]">{togetherCopy.proximityTitle}</p>
                  <p className="mt-1 font-body text-[16px] leading-[1.38] text-[#346B5D]">{togetherCopy.proximityBody}</p>
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-[24px] border border-[#E8DDCF] bg-[#FFFDFC] px-4 py-4">
              <div className="flex items-center gap-2">
                <TogetherSafetyIcon size={21} strokeWidth={2.4} className="text-[#6D28D9]" aria-hidden="true" />
                <p className="font-body text-[18px] font-bold text-[#24172F]">{togetherCopy.rulesLabel}</p>
              </div>
              <div className="mt-3 grid gap-2">
                {togetherCopy.rules.map((rule, index) => (
                  <div key={rule} className="flex items-center gap-3 font-body text-[16px] leading-[1.3] text-[#5D4777]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F2EBFF] text-[14px] font-bold text-[#6D28D9]">
                      {index + 1}
                    </span>
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

const SocialHub = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language: appLanguage } = useLanguage();
  const language = getSocialLanguage(appLanguage);
  const togetherLanguage = getSocialGameLanguage(appLanguage);
  const copy = getSocialCopy(language);
  const entryCopy = getSocialHubEntryCopy(language);
  const loadingRoomsLabel = getLoadingRoomsLabel(language);
  const autoStartVoice = useRouteVoiceAutoStart();
  const [selectedRoomSlug, setSelectedRoomSlug] = useState<string | null>(null);
  const [fastHelpWindowIndex, setFastHelpWindowIndex] = useState(0);

  const { data, isLoading, isError } = useQuery<SocialHubResponse>({
    queryKey: [`/api/social/hub?lang=${togetherLanguage}`],
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const hubRooms = useMemo(() => data?.listRooms ?? [], [data?.listRooms]);
  const fastHelpRooms = useMemo(() => orderFastHelpRooms(hubRooms), [hubRooms]);
  const selectedRoom = useMemo(
    () => hubRooms.find((room) => room.slug === selectedRoomSlug) ?? null,
    [hubRooms, selectedRoomSlug],
  );
  const fastHelpWindowCount = Math.max(1, Math.ceil(fastHelpRooms.length / FAST_HELP_WINDOW_SIZE));
  const visibleFastHelpRooms = useMemo(() => {
    if (fastHelpRooms.length <= FAST_HELP_WINDOW_SIZE) return fastHelpRooms;
    const start = (fastHelpWindowIndex * FAST_HELP_WINDOW_SIZE) % fastHelpRooms.length;
    return Array.from(
      { length: FAST_HELP_WINDOW_SIZE },
      (_, index) => fastHelpRooms[(start + index) % fastHelpRooms.length],
    );
  }, [fastHelpRooms, fastHelpWindowIndex]);
  const moreRoomsLabel = getMoreRoomsLabel(language);
  const canRotateRooms = fastHelpRooms.length > FAST_HELP_WINDOW_SIZE;

  const showNextRooms = useCallback(() => {
    setFastHelpWindowIndex((current) => (current + 1) % fastHelpWindowCount);
  }, [fastHelpWindowCount]);

  useEffect(() => {
    setFastHelpWindowIndex(0);
  }, [language, fastHelpRooms.length]);

  useEffect(() => {
    if (fastHelpWindowIndex >= fastHelpWindowCount) {
      setFastHelpWindowIndex(0);
    }
  }, [fastHelpWindowCount, fastHelpWindowIndex]);

  useEffect(() => {
    if (!canRotateRooms || selectedRoom) return undefined;
    const timer = window.setInterval(showNextRooms, ROOM_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [canRotateRooms, selectedRoom, showNextRooms]);

  return (
    <div className="vyva-page">
      <SocialStyles />

      <header>
        <VoiceHero
          heroSurface="social"
          sourceText={copy.dayLabel}
          headline={copy.chooseRoom}
          subtitle={copy.chooseRoomSubtitle}
          contextHint="social rooms"
          voiceAgentSlug="companion"
          autoStartVoice={autoStartVoice ? "companion" : false}
          showVoiceOverlay={false}
          activeLabel={t("voiceHero.endCall", "Pause listening")}
        />
      </header>

      <VoiceActionFulfillmentPanel
        domain="social"
        actionTypes={["social.rooms"]}
        title={copy.chooseRoom}
        description={entryCopy.focusDescription}
        highlights={[
          ...(fastHelpRooms.length > 0 ? [{ label: "Rooms", value: fastHelpRooms.length, tone: "good" as const }] : []),
        ]}
        className="mt-5"
      />

      <section className="mt-[22px]" data-testid="social-primary-cards">
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          {entryCopy.cards.map((card) => (
            <SocialPrimaryCardView key={card.id} card={card} />
          ))}
        </div>
      </section>

      <main
        id="social-rooms-list"
        className="mt-[18px] rounded-[28px] border border-[#EDE2D1] bg-[#FFFCF8] p-5 shadow-[0_14px_32px_rgba(60,38,20,0.07)]"
        data-testid="social-fast-help"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
              {entryCopy.fastHelpKicker}
            </p>
            <h2 className="mt-1 font-body text-[22px] font-black leading-tight text-vyva-text-1">
              {entryCopy.fastHelpTitle}
            </h2>
          </div>

          {canRotateRooms ? (
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <FastHelpDots count={fastHelpWindowCount} activeIndex={fastHelpWindowIndex} />
              <button
                type="button"
                onClick={showNextRooms}
                aria-label={moreRoomsLabel}
                title={moreRoomsLabel}
                data-testid="button-social-rooms-next"
                className="vyva-tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D8C8FB] bg-white text-[#6D28D9] shadow-[0_10px_22px_rgba(109,40,217,0.12)]"
              >
                <ChevronRight size={23} strokeWidth={2.6} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3">
          {isLoading && (
            <EmptyState title={loadingRoomsLabel} className="text-[#6E5A8A]" />
          )}

          {isError && !fastHelpRooms.length && (
            <EmptyState icon={Users} title={copy.noRooms} />
          )}

          {!isLoading && !isError && !fastHelpRooms.length && (
            <EmptyState icon={Users} title={copy.noRooms} />
          )}

          {!isLoading && visibleFastHelpRooms.map((room) => (
            <FastHelpRoomRow
              key={`${fastHelpWindowIndex}:${room.slug}`}
              room={room}
              language={language}
              onSelect={(nextRoom) => setSelectedRoomSlug(nextRoom.slug)}
            />
          ))}
        </div>
      </main>

      {selectedRoom && (
        <RoomDetailSheet
          room={selectedRoom}
          language={language}
          togetherLanguage={togetherLanguage}
          onClose={() => setSelectedRoomSlug(null)}
          onEnter={(slug) => navigate(`/social-rooms/${slug}`)}
        />
      )}
    </div>
  );
};

export default SocialHub;
