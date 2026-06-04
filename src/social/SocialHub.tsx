import { RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n";
import VoiceHero from "@/components/VoiceHero";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import { BottomSheet, EmptyState, ResponsiveGrid, SectionTitle } from "@/components/vyva-ui";
import { useRouteVoiceAutoStart } from "@/hooks/useRouteVoiceAutoStart";
import AgentAvatar from "./AgentAvatar";
import SocialStyles from "./SocialStyles";
import {
  filterRoomsByCategory,
  formatLiveText,
  getRoomBadge,
  getRoomPickerName,
  getSocialCopy,
  getSocialLanguage,
} from "./roomUtils";
import {
  TogetherProximityIcon,
  TogetherSafetyIcon,
  getTogetherPlans,
  getTogetherRoomCopy,
  isTogetherRoom,
} from "./togetherRoom";
import type { SocialHubResponse, SocialLanguage, SocialRoom, SocialRoomCategory } from "./types";

const ROOM_WINDOW_SIZE = 4;
const ROOM_ROTATION_MS = 9000;

function getMoreRoomsLabel(language: SocialLanguage) {
  if (language === "es") return "Mostrar más salas";
  if (language === "de") return "Mehr Räume zeigen";
  return "Show more rooms";
}

type RoomPickerTileProps = {
  room: SocialRoom;
  language: SocialLanguage;
  onSelect: (room: SocialRoom) => void;
};

function RoomPickerTile({ room, language, onSelect }: RoomPickerTileProps) {
  const topic = room.contentTitle || room.topic;
  const pickerName = getRoomPickerName(room.slug, language, room.name);
  const participantLabel = room.participantCount.toLocaleString(language);
  const togetherCopy = isTogetherRoom(room.slug) ? getTogetherRoomCopy(language) : null;
  const togetherPlans = togetherCopy ? getTogetherPlans(language).slice(1, 4) : [];

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(room)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(room);
        }
      }}
      className={`min-h-[188px] cursor-pointer overflow-hidden rounded-[28px] border p-4 shadow-[0_18px_42px_rgba(45,31,66,0.08)] transition-transform active:scale-[0.99] ${
        togetherCopy
          ? "border-[#D9C7F8] bg-[linear-gradient(135deg,#FFFDFC_0%,#F7F2FF_48%,#ECFDF5_100%)]"
          : "border-[#E6DCCF] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <AgentAvatar
          agentSlug={room.agentSlug}
          fullName={room.agentFullName}
          colour={room.agentColour}
          size={54}
          title={room.agentFullName}
        />
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F7F2FF] px-2.5 py-1.5 font-body text-[14px] font-bold text-[#6D28D9]">
          <Users size={17} />
          {participantLabel}
        </span>
      </div>

      <h2
        className="mt-5 min-w-0 overflow-hidden break-words font-body text-[21px] font-bold leading-[1.12] text-[#24172F]"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
        }}
      >
        {pickerName}
      </h2>
      <p
        className="mt-2 min-w-0 overflow-hidden break-words font-body text-[16px] leading-[1.3] text-[#7A677F]"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
        }}
      >
        {topic}
      </p>

      {togetherCopy && (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-2">
            {togetherPlans.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.id}
                  className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-[18px] bg-white/82 px-2 py-2 text-center shadow-[0_8px_18px_rgba(45,31,66,0.06)]"
                >
                  <Icon size={18} strokeWidth={2.4} className="text-[#6D28D9]" aria-hidden="true" />
                  <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-body text-[12px] font-bold text-[#45325B]">
                    {plan.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-[18px] bg-[#ECFDF5] px-3 py-2 font-body text-[13px] font-bold text-[#0F766E]">
            <TogetherProximityIcon size={15} strokeWidth={2.5} aria-hidden="true" />
            <span>{togetherCopy.proximityTitle}</span>
          </div>
        </div>
      )}
    </article>
  );
}

type RoomDetailSheetProps = {
  room: SocialRoom;
  language: SocialLanguage;
  onClose: () => void;
  onEnter: (slug: string) => void;
};

function RoomDetailSheet({ room, language, onClose, onEnter }: RoomDetailSheetProps) {
  const copy = getSocialCopy(language);
  const description = room.contentBody || room.opener || room.topic;
  const togetherCopy = isTogetherRoom(room.slug) ? getTogetherRoomCopy(language) : null;
  const togetherPlans = togetherCopy ? getTogetherPlans(language) : [];

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
            {getRoomBadge(room.slug, language)}
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
  const copy = getSocialCopy(language);
  const autoStartVoice = useRouteVoiceAutoStart();
  const [category, setCategory] = useState<"all" | SocialRoomCategory>("all");
  const [selectedRoomSlug, setSelectedRoomSlug] = useState<string | null>(null);
  const [roomWindowIndex, setRoomWindowIndex] = useState(0);

  const { data, isLoading, isError } = useQuery<SocialHubResponse>({
    queryKey: [`/api/social/hub?lang=${language}`],
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const hubRooms = useMemo(() => data?.listRooms ?? [], [data?.listRooms]);
  const filteredRooms = useMemo(
    () => filterRoomsByCategory(hubRooms, category),
    [category, hubRooms],
  );
  const selectedRoom = useMemo(
    () => hubRooms.find((room) => room.slug === selectedRoomSlug) ?? null,
    [hubRooms, selectedRoomSlug],
  );
  const roomWindowCount = Math.max(1, Math.ceil(filteredRooms.length / ROOM_WINDOW_SIZE));
  const visibleRooms = useMemo(() => {
    if (filteredRooms.length <= ROOM_WINDOW_SIZE) return filteredRooms;
    const start = (roomWindowIndex * ROOM_WINDOW_SIZE) % filteredRooms.length;
    return Array.from(
      { length: ROOM_WINDOW_SIZE },
      (_, index) => filteredRooms[(start + index) % filteredRooms.length],
    );
  }, [filteredRooms, roomWindowIndex]);
  const moreRoomsLabel = getMoreRoomsLabel(language);
  const canRotateRooms = filteredRooms.length > ROOM_WINDOW_SIZE;

  const filters: Array<"all" | SocialRoomCategory> = ["all", "activity", "social", "useful", "connection"];

  const showNextRooms = useCallback(() => {
    setRoomWindowIndex((current) => (current + 1) % roomWindowCount);
  }, [roomWindowCount]);

  useEffect(() => {
    setRoomWindowIndex(0);
  }, [category, language, filteredRooms.length]);

  useEffect(() => {
    if (roomWindowIndex >= roomWindowCount) {
      setRoomWindowIndex(0);
    }
  }, [roomWindowCount, roomWindowIndex]);

  useEffect(() => {
    if (!canRotateRooms || selectedRoom) return undefined;
    const timer = window.setInterval(showNextRooms, ROOM_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [canRotateRooms, selectedRoom, showNextRooms]);

  return (
    <div className="px-5 pb-10">
      <SocialStyles />

      <header className="pt-4">
        <VoiceHero
          heroSurface="social"
          sourceText={copy.dayLabel}
          headline={copy.chooseRoom}
          subtitle={copy.chooseRoomSubtitle}
          contextHint="social rooms"
          autoStartVoice={autoStartVoice ? "social" : false}
          showVoiceOverlay={false}
          activeLabel={t("voiceHero.endCall", "Pause listening")}
        />
      </header>

      <VoiceActionFulfillmentPanel
        domain="social"
        actionTypes={["social.rooms"]}
        title={copy.chooseRoom}
        description="VYVA can use interests, room context, and conversation style to suggest one warm place to start."
        highlights={[
          ...(filteredRooms.length > 0 ? [{ label: "Rooms", value: filteredRooms.length, tone: "good" as const }] : []),
        ]}
        className="mt-5"
      />

      <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
        {filters.map((value) => {
          const active = value === category;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className="min-h-[58px] whitespace-nowrap rounded-full px-5 font-body text-[19px] font-semibold"
              style={
                active
                  ? { background: "#5B21B6", color: "#FFFFFF" }
                  : { background: "#FFFFFF", color: "#5B21B6", border: "1px solid #D8C8FB" }
              }
            >
              {copy.filters[value]}
            </button>
          );
        })}
      </div>

      <main className="mt-6">
        {isLoading && (
          <EmptyState title="..." className="text-[#6E5A8A]" />
        )}

        {isError && !filteredRooms.length && (
          <EmptyState icon={Users} title={copy.noRooms} />
        )}

        {!isLoading && !isError && !filteredRooms.length && (
          <EmptyState icon={Users} title={copy.noRooms} />
        )}

        {filteredRooms.length > 0 && (
          <SectionTitle
            className="mb-3"
            title={copy.allRooms}
            titleClassName="font-body text-[18px] font-bold not-italic text-[#24172F]"
            action={canRotateRooms && (
              <div className="flex items-center gap-2">
                <div className="flex gap-1" aria-hidden="true">
                  {Array.from({ length: roomWindowCount }, (_, index) => (
                    <span
                      key={index}
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: index === roomWindowIndex ? 18 : 7,
                        background: index === roomWindowIndex ? "#6D28D9" : "#D9C7F8",
                      }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={showNextRooms}
                  aria-label={moreRoomsLabel}
                  title={moreRoomsLabel}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D8C8FB] bg-white text-[#6D28D9] shadow-[0_10px_22px_rgba(109,40,217,0.12)] transition-transform active:scale-95"
                >
                  <RefreshCw size={19} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>
            )}
          />
        )}

        <ResponsiveGrid columns="two">
          {visibleRooms.map((room) => (
            <RoomPickerTile
              key={room.slug}
              room={room}
              language={language}
              onSelect={(nextRoom) => setSelectedRoomSlug(nextRoom.slug)}
            />
          ))}
        </ResponsiveGrid>
      </main>

      {selectedRoom && (
        <RoomDetailSheet
          room={selectedRoom}
          language={language}
          onClose={() => setSelectedRoomSlug(null)}
          onEnter={(slug) => navigate(`/social-rooms/${slug}`)}
        />
      )}
    </div>
  );
};

export default SocialHub;
