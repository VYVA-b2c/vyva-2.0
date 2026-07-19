import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { apiFetch } from "@/lib/queryClient";
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
import {
  buildConciergeProviderReplyCompletionPayload,
  buildConciergeProviderReplyDecisionPatch,
  parseConciergeProviderReplyResolution,
  type ConciergeProviderReplyPrimaryAction,
  type ConciergeProviderReplyResolution,
} from "../../shared/conciergeProviderReplyResolution";

const GROUP_ORDER: ConciergeTaskInboxGroup[] = ["needs_you", "waiting", "completed"];

function payloadText(payload: Record<string, unknown> | null, keys: string[]): string {
  if (!payload) return "";
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function updateProviderReplyTask(pendingId: string, actionPayload: Record<string, unknown>) {
  const response = await apiFetch(`/api/concierge/actions/${pendingId}/details`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action_payload: actionPayload }),
  });
  if (!response.ok) throw new Error("Could not save your reply.");
  return response.json();
}

async function sendProviderReplyTask(pendingId: string) {
  const response = await apiFetch(`/api/concierge/actions/${pendingId}/review-confirm`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Could not send your reply.");
  return response.json();
}

async function completeProviderReplyTask(input: {
  pendingId: string;
  outcomeSummary: string;
  outcomePayload: Record<string, unknown>;
}) {
  const response = await apiFetch(`/api/concierge/actions/${input.pendingId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      outcome_summary: input.outcomeSummary,
      outcome_payload: input.outcomePayload,
    }),
  });
  if (!response.ok) throw new Error("Could not close this task.");
  return response.json();
}

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
      aria-label={`${item.title}. ${item.continuation.stateLabel}. ${item.summary}`}
      className="vyva-tap flex min-h-[104px] w-full items-center gap-3 border-b border-vyva-border bg-white px-4 py-4 text-left last:border-b-0 hover:bg-[#FCFAF7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vyva-purple"
      data-testid={`concierge-inbox-task-${item.key}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 break-words font-body text-[16px] font-black text-vyva-text-1">{item.title}</p>
          <span
            className="rounded-full bg-[#F4F0FF] px-2 py-0.5 font-body text-[11px] font-black text-vyva-purple"
            data-testid={`concierge-inbox-task-state-${item.key}`}
          >
            {item.continuation.stateLabel}
          </span>
          <span className="font-body text-[11px] font-black text-vyva-text-3">{item.continuation.flowLabel}</span>
        </div>
        <p className="mt-1 line-clamp-2 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
          {item.summary}
        </p>
        <p
          className="mt-2 break-words font-body text-[12px] font-black text-vyva-text-2"
          data-testid={`concierge-inbox-task-scene-${item.key}`}
        >
          {item.continuation.sceneLabel}
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

function ProviderReplyTaskActions({
  item,
  resolution,
  isSpanish,
}: {
  item: ConciergeTaskInboxItem;
  resolution: ConciergeProviderReplyResolution;
  isSpanish: boolean;
}) {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const payload = item.actionPayload ?? {};
  const pendingId = item.pendingId;
  const missingRequests = resolution.requestedInformation.filter((request) => request.missing);
  const answersComplete = missingRequests.every((request) => Boolean(answers[request.key]?.trim()));
  const draftReady = resolution.decision?.status === "draft_ready" && Boolean(resolution.draftFollowUp);
  const recipient = resolution.channel === "whatsapp"
    ? payloadText(payload, ["recipient_whatsapp", "provider_whatsapp", "provider_inbound_sender"])
    : payloadText(payload, ["recipient_email", "provider_email", "provider_inbound_sender"]);
  const executionAdapter = payload.execution_adapter && typeof payload.execution_adapter === "object"
    ? payload.execution_adapter as Record<string, unknown>
    : {};
  const followUpSent = payload.provider_follow_up_confirmed === true
    || executionAdapter.status === "sent"
    || payload.email_outcome === "sent";

  useEffect(() => {
    setAnswers({});
    setReviewing(false);
    setNotice(null);
  }, [item.key, resolution.decision?.recordedAt]);

  const refreshTask = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
    ]);
  };

  const prepareMutation = useMutation({
    mutationFn: ({ action }: { action: ConciergeProviderReplyPrimaryAction }) => {
      if (!pendingId) throw new Error("This task is no longer active.");
      return updateProviderReplyTask(pendingId, buildConciergeProviderReplyDecisionPatch({
        payload,
        resolution,
        action,
        answers,
      }));
    },
    onSuccess: async () => {
      setNotice(isSpanish ? "Mensaje preparado. Revisalo antes de enviarlo." : "Message prepared. Review it before sending.");
      await refreshTask();
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => {
      if (!pendingId) throw new Error("This task is no longer active.");
      return sendProviderReplyTask(pendingId);
    },
    onSuccess: async () => {
      setReviewing(false);
      setNotice(isSpanish ? "Mensaje enviado. Esperando al proveedor." : "Message sent. Waiting for the provider.");
      await refreshTask();
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => {
      if (!pendingId) throw new Error("This task is no longer active.");
      const outcomeSummary = resolution.summary || (isSpanish ? "Tarea completada." : "Task completed.");
      return completeProviderReplyTask({
        pendingId,
        outcomeSummary,
        outcomePayload: buildConciergeProviderReplyCompletionPayload({
          payload,
          resolution,
          outcomeSummary,
        }),
      });
    },
    onSuccess: refreshTask,
  });

  const busy = prepareMutation.isPending || sendMutation.isPending || completeMutation.isPending;
  const error = prepareMutation.error || sendMutation.error || completeMutation.error;

  if (followUpSent) {
    return (
      <section className="border-b border-vyva-border py-5" data-testid="concierge-task-provider-reply-actions">
        <p className="font-body text-[15px] font-black text-[#047857]">
          {isSpanish ? "Mensaje enviado. Esperando al proveedor." : "Message sent. Waiting for the provider."}
        </p>
      </section>
    );
  }

  return (
    <section className="border-b border-vyva-border py-5" data-testid="concierge-task-provider-reply-actions">
      <h2 className="font-body text-[16px] font-black text-vyva-text-1">
        {isSpanish ? "Que quieres hacer?" : "What would you like to do?"}
      </h2>

      {resolution.primaryAction === "answer_provider" && !draftReady ? (
        <div className="mt-3 grid gap-3">
          {missingRequests.map((request) => (
            <label key={request.key} className="grid gap-1 font-body text-[13px] font-black text-vyva-text-2">
              {request.label}
              <input
                value={answers[request.key] ?? ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [request.key]: event.target.value }))}
                className="min-h-[46px] rounded-lg border border-vyva-border bg-white px-3 font-body text-[14px] font-semibold text-vyva-text-1"
                data-testid={`concierge-task-reply-answer-${request.key}`}
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => prepareMutation.mutate({ action: "answer_provider" })}
            disabled={busy || !answersComplete}
            className="vyva-tap min-h-[50px] rounded-lg bg-[#047857] px-4 font-body text-[15px] font-black text-white disabled:opacity-50"
            data-testid="button-concierge-task-prepare-reply"
          >
            {isSpanish ? "Preparar respuesta" : "Prepare reply"}
          </button>
        </div>
      ) : draftReady && resolution.draftFollowUp ? (
        <div className="mt-3" data-testid="concierge-task-reply-draft">
          <dl className="grid gap-2 border-y border-vyva-border py-3">
            <div>
              <dt className="font-body text-[11px] font-black uppercase text-vyva-text-3">{isSpanish ? "Para" : "To"}</dt>
              <dd className="mt-1 break-words font-body text-[14px] font-bold text-vyva-text-1" data-testid="concierge-task-reply-recipient">
                {recipient || (isSpanish ? "Falta el contacto" : "Contact missing")}
              </dd>
            </div>
            {resolution.channel === "email" ? (
              <div>
                <dt className="font-body text-[11px] font-black uppercase text-vyva-text-3">{isSpanish ? "Asunto" : "Subject"}</dt>
                <dd className="mt-1 font-body text-[14px] font-bold text-vyva-text-1">{resolution.draftFollowUp.subject}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-body text-[11px] font-black uppercase text-vyva-text-3">{isSpanish ? "Mensaje" : "Message"}</dt>
              <dd className="mt-1 whitespace-pre-wrap font-body text-[14px] font-semibold leading-relaxed text-vyva-text-1">
                {resolution.draftFollowUp.body}
              </dd>
            </div>
          </dl>
          {reviewing ? (
            <div className="mt-3" data-testid="concierge-task-reply-final-confirmation">
              <p className="font-body text-[14px] font-black text-vyva-text-1">
                {isSpanish ? "Enviar este mensaje?" : "Send this message?"}
              </p>
              <p className="mt-1 font-body text-[12px] font-semibold text-vyva-text-2">
                {isSpanish ? "Esta es la confirmacion final." : "This is the final confirmation."}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReviewing(false)}
                  disabled={busy}
                  className="vyva-tap min-h-[48px] rounded-lg border border-vyva-border bg-white px-3 font-body text-[14px] font-black text-vyva-text-2"
                >
                  {isSpanish ? "Volver" : "Back"}
                </button>
                <button
                  type="button"
                  onClick={() => sendMutation.mutate()}
                  disabled={busy || !recipient}
                  className="vyva-tap min-h-[48px] rounded-lg bg-[#047857] px-3 font-body text-[14px] font-black text-white disabled:opacity-50"
                  data-testid="button-concierge-task-send-reply"
                >
                  {resolution.channel === "whatsapp"
                    ? (isSpanish ? "Enviar WhatsApp" : "Send WhatsApp")
                    : (isSpanish ? "Enviar email" : "Send email")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setReviewing(true)}
              disabled={busy || !recipient}
              className="vyva-tap mt-3 min-h-[50px] w-full rounded-lg bg-[#047857] px-4 font-body text-[15px] font-black text-white disabled:opacity-50"
              data-testid="button-concierge-task-review-reply"
            >
              {isSpanish ? "Revisar y enviar" : "Review and send"}
            </button>
          )}
        </div>
      ) : resolution.primaryAction === "mark_complete" ? (
        <button
          type="button"
          onClick={() => completeMutation.mutate()}
          disabled={busy}
          className="vyva-tap mt-3 min-h-[50px] w-full rounded-lg bg-[#047857] px-4 font-body text-[15px] font-black text-white"
          data-testid="button-concierge-task-complete-reply"
        >
          {isSpanish ? "Marcar como hecho" : "Mark complete"}
        </button>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3" data-testid="concierge-task-reply-choices">
          {resolution.primaryAction !== "request_alternatives" ? (
            <button
              type="button"
              onClick={() => prepareMutation.mutate({ action: "confirm" })}
              disabled={busy}
              className="vyva-tap min-h-[48px] rounded-lg bg-[#047857] px-3 font-body text-[14px] font-black text-white"
              data-testid="button-concierge-task-accept-offer"
            >
              {isSpanish ? "Aceptar" : "Accept"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => prepareMutation.mutate({ action: "request_alternatives" })}
            disabled={busy}
            className="vyva-tap min-h-[48px] rounded-lg border border-vyva-border bg-white px-3 font-body text-[14px] font-black text-vyva-text-1"
            data-testid="button-concierge-task-request-alternatives"
          >
            {isSpanish ? "Pedir otra opcion" : "Ask for another option"}
          </button>
          <button
            type="button"
            onClick={() => prepareMutation.mutate({ action: "decline" })}
            disabled={busy}
            className="vyva-tap min-h-[48px] rounded-lg border border-vyva-border bg-white px-3 font-body text-[14px] font-black text-vyva-text-1"
            data-testid="button-concierge-task-decline-offer"
          >
            {isSpanish ? "Rechazar" : "Decline"}
          </button>
          {resolution.primaryAction === "request_alternatives" ? (
            <button
              type="button"
              onClick={() => completeMutation.mutate()}
              disabled={busy}
              className="vyva-tap min-h-[48px] rounded-lg border border-vyva-border bg-white px-3 font-body text-[14px] font-black text-vyva-text-1"
              data-testid="button-concierge-task-close-unavailable"
            >
              {isSpanish ? "Cerrar tarea" : "Close task"}
            </button>
          ) : null}
        </div>
      )}

      {!draftReady && resolution.primaryAction !== "mark_complete" ? (
        <p className="mt-2 font-body text-[12px] font-semibold text-vyva-text-2">
          {isSpanish ? "Primero prepararemos el mensaje. Nada se enviara todavia." : "We will prepare the message first. Nothing is sent yet."}
        </p>
      ) : null}
      {notice ? <p className="mt-3 font-body text-[13px] font-black text-[#047857]">{notice}</p> : null}
      {error ? (
        <p className="mt-3 font-body text-[13px] font-black text-[#B91C1C]" role="alert">
          {error instanceof Error ? error.message : (isSpanish ? "Algo salio mal." : "Something went wrong.")}
        </p>
      ) : null}
    </section>
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
  const providerReplyResolution = parseConciergeProviderReplyResolution(
    item.actionPayload?.provider_reply_resolution,
  );
  const hasDirectReplyActions = Boolean(
    item.pendingId
      && item.group === "needs_you"
      && item.reply
      && providerReplyResolution,
  );
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

      <section
        className="border-b border-vyva-border py-5"
        data-testid="concierge-task-continuation"
        aria-label={isSpanish ? "Progreso del Canvas" : "Canvas progress"}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-body text-[16px] font-black text-vyva-text-1">
            {isSpanish ? "Continuar Canvas" : "Continue Canvas"}
          </h2>
          <span className="rounded-full bg-[#F4F0FF] px-2 py-1 font-body text-[11px] font-black text-vyva-purple">
            {item.continuation.stateLabel}
          </span>
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="font-body text-[11px] font-black uppercase text-vyva-text-3">
              {isSpanish ? "Flujo" : "Flow"}
            </dt>
            <dd className="mt-1 break-words font-body text-[14px] font-bold text-vyva-text-1">
              {item.continuation.flowLabel}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-body text-[11px] font-black uppercase text-vyva-text-3">
              {isSpanish ? "Estado" : "State"}
            </dt>
            <dd className="mt-1 break-words font-body text-[14px] font-bold text-vyva-text-1">
              {item.continuation.stateLabel}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-body text-[11px] font-black uppercase text-vyva-text-3">
              {isSpanish ? "Escena" : "Scene"}
            </dt>
            <dd className="mt-1 break-words font-body text-[14px] font-bold text-vyva-text-1">
              {item.continuation.sceneLabel}
            </dd>
          </div>
        </dl>
        <p className="mt-3 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
          {item.continuation.helperText}
        </p>
      </section>

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

      {item.missingInformation.length > 0 && !hasDirectReplyActions ? (
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

      {hasDirectReplyActions && providerReplyResolution ? (
        <ProviderReplyTaskActions
          item={item}
          resolution={providerReplyResolution}
          isSpanish={isSpanish}
        />
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

      {!hasDirectReplyActions ? (
        <button
          type="button"
          onClick={onPrimaryAction}
          className="vyva-tap mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#047857] px-5 font-body text-[16px] font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857] focus-visible:ring-offset-2"
          data-testid="button-concierge-task-primary-action"
        >
          {item.primaryActionLabel}
          <ChevronRight size={19} aria-hidden="true" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onBack}
        className="vyva-tap mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-lg border border-vyva-border bg-white px-5 font-body text-[15px] font-black text-vyva-text-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vyva-purple focus-visible:ring-offset-2"
        data-testid="button-concierge-task-exit"
      >
        {isSpanish ? "Volver a tareas" : "Back to tasks"}
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
