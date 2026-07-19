import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Inbox,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";
import { useLanguage } from "@/i18n";
import { listConciergeTaskDrafts } from "@/lib/conciergeTaskDrafts";
import {
  buildConciergeTaskInbox,
  conciergeTaskInboxItems,
  fetchConciergeTaskCompletedSessions,
  fetchConciergeTaskPendingItems,
  findConciergeTaskInboxItem,
  type ConciergeTaskInboxGroup,
  type ConciergeTaskInboxItem,
} from "@/lib/conciergeTaskInbox";
import {
  conciergeTaskInboxPath,
  parseConciergeTaskInboxKey,
} from "@/lib/conciergeTaskNavigation";

const GROUP_ORDER: ConciergeTaskInboxGroup[] = ["needs_you", "waiting", "completed"];

function formatDate(value: string | null, language: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language || "en", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function groupCopy(group: ConciergeTaskInboxGroup, isSpanish: boolean): {
  title: string;
  empty: string;
  icon: typeof CircleAlert;
  tone: string;
} {
  if (group === "needs_you") {
    return {
      title: isSpanish ? "Te necesita" : "Needs you",
      empty: isSpanish ? "Nada necesita tu atencion." : "Nothing needs your attention.",
      icon: CircleAlert,
      tone: "bg-[#FFF5E8] text-[#9A5800]",
    };
  }
  if (group === "waiting") {
    return {
      title: isSpanish ? "Esperando" : "Waiting",
      empty: isSpanish ? "No hay respuestas pendientes." : "No replies are pending.",
      icon: Clock3,
      tone: "bg-[#EEF5FF] text-[#2F66D0]",
    };
  }
  return {
    title: isSpanish ? "Completadas" : "Completed",
    empty: isSpanish ? "Aun no hay tareas completadas." : "No completed tasks yet.",
    icon: CheckCircle2,
    tone: "bg-[#ECFDF5] text-[#047857]",
  };
}

function TaskRow({
  item,
  language,
  onOpen,
}: {
  item: ConciergeTaskInboxItem;
  language: string;
  onOpen: () => void;
}) {
  const date = formatDate(item.updatedAt, language);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="vyva-tap flex min-h-[96px] w-full items-center gap-3 border-b border-vyva-border bg-white px-4 py-4 text-left last:border-b-0 hover:bg-[#FCFAF7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vyva-purple"
      data-testid={`concierge-inbox-task-${item.key}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-body text-[16px] font-black text-vyva-text-1">{item.title}</p>
          <span className="font-body text-[11px] font-black text-vyva-purple">{item.statusLabel}</span>
        </div>
        <p className="mt-1 line-clamp-2 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
          {item.summary}
        </p>
        {(item.providerName || date) ? (
          <p className="mt-2 truncate font-body text-[12px] font-semibold text-vyva-text-3">
            {[item.providerName, date].filter(Boolean).join(" | ")}
          </p>
        ) : null}
      </div>
      <ChevronRight size={20} className="flex-shrink-0 text-vyva-text-3" aria-hidden="true" />
    </button>
  );
}

function InboxList({
  inbox,
  language,
  isSpanish,
  onBack,
  onOpen,
}: {
  inbox: ReturnType<typeof buildConciergeTaskInbox>;
  language: string;
  isSpanish: boolean;
  onBack: () => void;
  onOpen: (item: ConciergeTaskInboxItem) => void;
}) {
  const total = conciergeTaskInboxItems(inbox).length;
  return (
    <div className="mx-auto min-h-screen w-full max-w-[720px] bg-vyva-background px-4 pb-10 pt-4 sm:px-6" data-testid="concierge-task-inbox">
      <header className="border-b border-vyva-border pb-4">
        <button
          type="button"
          onClick={onBack}
          className="vyva-tap inline-flex min-h-[44px] items-center gap-2 rounded-lg px-1 font-body text-[14px] font-black text-vyva-text-2"
        >
          <ArrowLeft size={19} aria-hidden="true" />
          {isSpanish ? "Concierge" : "Concierge"}
        </button>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#047857]">
            <Inbox size={22} aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-body text-[26px] font-black leading-tight text-vyva-text-1">
              {isSpanish ? "Mis tareas" : "My tasks"}
            </h1>
            <p className="font-body text-[13px] font-semibold text-vyva-text-2">
              {isSpanish ? `${total} en total` : `${total} total`}
            </p>
          </div>
        </div>
      </header>

      <div className="mt-5 space-y-6">
        {GROUP_ORDER.map((group) => {
          const copy = groupCopy(group, isSpanish);
          const Icon = copy.icon;
          const items = inbox[group];
          return (
            <section key={group} aria-labelledby={`concierge-inbox-${group}-title`} data-testid={`concierge-inbox-group-${group}`}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${copy.tone}`}>
                  <Icon size={17} aria-hidden="true" />
                </span>
                <h2 id={`concierge-inbox-${group}-title`} className="font-body text-[17px] font-black text-vyva-text-1">
                  {copy.title}
                </h2>
                <span className="font-body text-[12px] font-black text-vyva-text-3">{items.length}</span>
              </div>
              {items.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-vyva-border bg-white">
                  {items.map((item) => (
                    <TaskRow key={item.key} item={item} language={language} onOpen={() => onOpen(item)} />
                  ))}
                </div>
              ) : (
                <p className="border-y border-vyva-border px-4 py-4 font-body text-[13px] font-semibold text-vyva-text-3">
                  {copy.empty}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TaskDetail({
  item,
  language,
  isSpanish,
  onBack,
  onPrimaryAction,
}: {
  item: ConciergeTaskInboxItem;
  language: string;
  isSpanish: boolean;
  onBack: () => void;
  onPrimaryAction: () => void;
}) {
  const date = formatDate(item.updatedAt, language);
  const details = item.details.map((detail) => (
    detail.label === "Last updated" || detail.label === "Ultima actualizacion"
      ? { ...detail, value: date || detail.value }
      : detail
  ));

  return (
    <div className="mx-auto min-h-screen w-full max-w-[720px] bg-vyva-background px-4 pb-10 pt-4 sm:px-6" data-testid="concierge-task-detail">
      <button
        type="button"
        onClick={onBack}
        className="vyva-tap inline-flex min-h-[44px] items-center gap-2 rounded-lg px-1 font-body text-[14px] font-black text-vyva-text-2"
      >
        <ArrowLeft size={19} aria-hidden="true" />
        {isSpanish ? "Todas las tareas" : "All tasks"}
      </button>

      <header className="mt-2 border-b border-vyva-border pb-5">
        <p className="font-body text-[12px] font-black uppercase text-vyva-purple">{item.statusLabel}</p>
        <h1 className="mt-2 font-body text-[28px] font-black leading-tight text-vyva-text-1">{item.title}</h1>
        <p className="mt-2 font-body text-[15px] font-semibold leading-relaxed text-vyva-text-2">{item.summary}</p>
      </header>

      {item.reply ? (
        <section className="border-b border-vyva-border py-5" data-testid="concierge-task-provider-reply">
          <div className="flex items-center gap-2 text-[#047857]">
            <MessageSquareText size={19} aria-hidden="true" />
            <h2 className="font-body text-[16px] font-black">
              {isSpanish ? "Respuesta del proveedor" : "Provider reply"}
            </h2>
          </div>
          <p className="mt-2 whitespace-pre-wrap font-body text-[14px] font-semibold leading-relaxed text-vyva-text-1">
            {item.reply}
          </p>
        </section>
      ) : null}

      {item.missingInformation.length > 0 ? (
        <section className="border-b border-vyva-border py-5" data-testid="concierge-task-missing-information">
          <h2 className="font-body text-[16px] font-black text-vyva-text-1">
            {isSpanish ? "El proveedor necesita" : "The provider needs"}
          </h2>
          <ul className="mt-2 space-y-2">
            {item.missingInformation.map((value) => (
              <li key={value} className="flex gap-2 font-body text-[14px] font-semibold text-vyva-text-2">
                <span aria-hidden="true">-</span>
                <span>{value}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {item.decisionSummary ? (
        <section className="border-b border-vyva-border py-5" data-testid="concierge-task-decision">
          <h2 className="font-body text-[16px] font-black text-vyva-text-1">
            {isSpanish ? "Tu decision" : "Your decision"}
          </h2>
          <p className="mt-2 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-2">
            {item.decisionSummary}
          </p>
        </section>
      ) : null}

      {item.outcomeSummary ? (
        <section className="border-b border-vyva-border py-5" data-testid="concierge-task-outcome">
          <h2 className="font-body text-[16px] font-black text-vyva-text-1">
            {isSpanish ? "Resultado" : "Outcome"}
          </h2>
          <p className="mt-2 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-2">
            {item.outcomeSummary}
          </p>
        </section>
      ) : null}

      {details.length > 0 ? (
        <details className="border-b border-vyva-border py-4" data-testid="concierge-task-more-details">
          <summary className="vyva-tap cursor-pointer font-body text-[14px] font-black text-vyva-text-2">
            {isSpanish ? "Mas detalles" : "More details"}
          </summary>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {details.map((detail) => (
              <div key={`${detail.label}:${detail.value}`}>
                <dt className="font-body text-[11px] font-black uppercase text-vyva-text-3">{detail.label}</dt>
                <dd className="mt-1 break-words font-body text-[14px] font-semibold text-vyva-text-1">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}

      <button
        type="button"
        onClick={onPrimaryAction}
        className="vyva-tap mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#047857] px-5 font-body text-[16px] font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857] focus-visible:ring-offset-2"
        data-testid="button-concierge-task-primary-action"
      >
        {item.primaryActionLabel}
        <ChevronRight size={19} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function ConciergeTaskInboxPage() {
  const navigate = useNavigate();
  const { taskKey } = useParams<{ taskKey: string }>();
  const { language } = useLanguage();
  const isSpanish = language.split("-")[0].toLowerCase() === "es";
  const draftsQuery = useQuery({
    queryKey: ["/api/concierge/tasks"],
    queryFn: listConciergeTaskDrafts,
    staleTime: 10_000,
  });
  const pendingQuery = useQuery({
    queryKey: ["/api/concierge/actions/pending"],
    queryFn: fetchConciergeTaskPendingItems,
    refetchInterval: 8_000,
  });
  const completedQuery = useQuery({
    queryKey: ["/api/concierge/actions/sessions"],
    queryFn: fetchConciergeTaskCompletedSessions,
    staleTime: 30_000,
  });
  const inbox = useMemo(() => buildConciergeTaskInbox({
    drafts: draftsQuery.data ?? [],
    pending: pendingQuery.data ?? [],
    completed: completedQuery.data ?? [],
    isSpanish,
  }), [completedQuery.data, draftsQuery.data, isSpanish, pendingQuery.data]);
  const parsedKey = useMemo(() => parseConciergeTaskInboxKey(taskKey), [taskKey]);
  const selectedItem = parsedKey
    ? findConciergeTaskInboxItem(inbox, parsedKey.source, parsedKey.id)
    : null;
  const isLoading = draftsQuery.isLoading || pendingQuery.isLoading || completedQuery.isLoading;
  const hasError = draftsQuery.isError || pendingQuery.isError || completedQuery.isError;

  const refresh = () => {
    void Promise.all([draftsQuery.refetch(), pendingQuery.refetch(), completedQuery.refetch()]);
  };

  if (isLoading) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-[720px] bg-vyva-background px-5 pt-10" data-testid="concierge-task-inbox-loading">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-vyva-border" />
        <div className="mt-8 space-y-3">
          {[1, 2, 3].map((value) => <div key={value} className="h-24 animate-pulse rounded-lg bg-white" />)}
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-[520px] flex-col items-center justify-center px-5 text-center" data-testid="concierge-task-inbox-error">
        <CircleAlert size={30} className="text-[#B45309]" aria-hidden="true" />
        <h1 className="mt-3 font-body text-[21px] font-black text-vyva-text-1">
          {isSpanish ? "No se pudieron cargar tus tareas" : "Your tasks could not load"}
        </h1>
        <button
          type="button"
          onClick={refresh}
          className="vyva-tap mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-[#047857] px-5 font-body text-[15px] font-black text-white"
        >
          <RefreshCw size={18} aria-hidden="true" />
          {isSpanish ? "Intentar de nuevo" : "Try again"}
        </button>
      </div>
    );
  }

  if (taskKey && !selectedItem) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-[520px] flex-col items-center justify-center px-5 text-center" data-testid="concierge-task-not-found">
        <Inbox size={30} className="text-vyva-text-3" aria-hidden="true" />
        <h1 className="mt-3 font-body text-[21px] font-black text-vyva-text-1">
          {isSpanish ? "Esta tarea ya no esta disponible" : "This task is no longer available"}
        </h1>
        <button
          type="button"
          onClick={() => navigate(conciergeTaskInboxPath(), { replace: true })}
          className="vyva-tap mt-5 min-h-[48px] rounded-lg bg-[#047857] px-5 font-body text-[15px] font-black text-white"
        >
          {isSpanish ? "Ver mis tareas" : "View my tasks"}
        </button>
      </div>
    );
  }

  if (selectedItem) {
    return (
      <TaskDetail
        item={selectedItem}
        language={language}
        isSpanish={isSpanish}
        onBack={() => navigate(conciergeTaskInboxPath())}
        onPrimaryAction={() => {
          if (selectedItem.completedTemplate) {
            navigate("/concierge", {
              state: { conciergeCompletedTemplate: selectedItem.completedTemplate },
            });
            return;
          }
          navigate(selectedItem.resumePath, {
            state: selectedItem.pendingId ? {
              focusRightNow: true,
              conciergePendingId: selectedItem.pendingId,
            } : null,
          });
        }}
      />
    );
  }

  return (
    <InboxList
      inbox={inbox}
      language={language}
      isSpanish={isSpanish}
      onBack={() => navigate("/concierge")}
      onOpen={(item) => navigate(item.detailPath)}
    />
  );
}
