import { ArrowLeft, ChevronRight, ClipboardCheck, ListTodo, Trash2 } from "lucide-react";
import type { ConciergeTaskStage } from "@/lib/conciergeTaskNavigation";
import type { ConciergeProviderTaskStatus } from "../../../shared/conciergeProviderReplies";

type HomeTask = {
  id: string;
  detailPath: string;
  title: string;
  summary: string;
  providerStatus?: ConciergeProviderTaskStatus | null;
};

function providerStatusLabel(status: ConciergeProviderTaskStatus, isSpanish: boolean): string {
  const labels: Record<ConciergeProviderTaskStatus, [string, string]> = {
    waiting: ["Waiting", "Esperando"],
    reply_received: ["Reply received", "Respuesta recibida"],
    action_needed: ["Action needed", "Accion necesaria"],
    done: ["Done", "Hecho"],
  };
  return labels[status][isSpanish ? 1 : 0];
}

function taskActionLabel(status: ConciergeProviderTaskStatus | null | undefined, isSpanish: boolean): string {
  if (status === "action_needed") return isSpanish ? "Responder" : "Respond";
  if (status === "reply_received") return isSpanish ? "Revisar respuesta" : "Review reply";
  if (status === "waiting") return isSpanish ? "Ver estado" : "View status";
  return isSpanish ? "Continuar" : "Continue";
}

export function ConciergeHomeTaskOverview({
  activeTask,
  isLoading,
  isSpanish,
  onContinue,
  onOpenInbox,
}: {
  activeTask: HomeTask | null;
  isLoading: boolean;
  isSpanish: boolean;
  onContinue: (task: HomeTask) => void;
  onOpenInbox: () => void;
}) {
  return (
    <section className="mt-5 border-t border-vyva-border pt-5" data-testid="concierge-home-task-overview">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-body text-[22px] font-black text-vyva-text-1">
          {isSpanish ? "Siguiente paso" : "Next step"}
        </h2>
        <button
          type="button"
          onClick={onOpenInbox}
          className="vyva-tap inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 font-body text-[13px] font-black text-vyva-purple"
          data-testid="button-concierge-open-task-inbox"
        >
          <ListTodo size={17} aria-hidden="true" />
          {isSpanish ? "Todas las tareas" : "All tasks"}
        </button>
      </div>

      {isLoading ? (
        <p className="mt-3 font-body text-[14px] font-semibold text-vyva-text-2">
          {isSpanish ? "Cargando tareas..." : "Loading tasks..."}
        </p>
      ) : activeTask ? (
        <div className="mt-3 border-y border-vyva-border py-4" data-testid="concierge-home-active-task">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#047857]">
              <ClipboardCheck size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              {activeTask.providerStatus ? (
                <p className="mb-1 font-body text-[11px] font-black uppercase text-[#047857]" data-testid="concierge-home-task-status">
                  {providerStatusLabel(activeTask.providerStatus, isSpanish)}
                </p>
              ) : null}
              <p className="font-body text-[16px] font-black text-vyva-text-1">{activeTask.title}</p>
              <p className="mt-1 line-clamp-2 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
                {activeTask.summary}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onContinue(activeTask)}
            className="vyva-tap mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#047857] px-4 font-body text-[15px] font-black text-white"
            data-testid="button-concierge-continue-task"
          >
            {taskActionLabel(activeTask.providerStatus, isSpanish)}
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <p className="mt-3 border-y border-vyva-border py-4 font-body text-[14px] font-semibold text-vyva-text-2">
          {isSpanish ? "No tienes tareas pendientes." : "You have no pending tasks."}
        </p>
      )}

    </section>
  );
}

export function ConciergeTaskWorkspaceHeader({
  title,
  summary,
  stage,
  isSpanish,
  onBack,
  onDelete,
  isDeleting = false,
  providerUpdate,
}: {
  title: string;
  summary: string;
  stage: ConciergeTaskStage;
  isSpanish: boolean;
  onBack: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  providerUpdate?: {
    status: ConciergeProviderTaskStatus;
    summary: string;
  } | null;
}) {
  const stages: Array<{ id: ConciergeTaskStage; label: string }> = [
    { id: "details", label: isSpanish ? "Detalles" : "Details" },
    { id: "review", label: isSpanish ? "Revisar" : "Review" },
    { id: "confirmation", label: isSpanish ? "Confirmar" : "Confirm" },
  ];
  const activeIndex = stages.findIndex((item) => item.id === stage);

  return (
    <section className="mt-4 border-b border-vyva-border pb-5" data-testid="concierge-task-workspace" data-task-stage={stage}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="vyva-tap inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 font-body text-[14px] font-black text-vyva-text-2"
          data-testid="button-concierge-task-back"
        >
          <ArrowLeft size={19} aria-hidden="true" />
          {isSpanish ? "Volver a tareas" : "Back to tasks"}
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="vyva-tap inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 font-body text-[13px] font-black text-vyva-text-2 disabled:opacity-50"
            data-testid="button-concierge-task-delete"
          >
            <Trash2 size={17} aria-hidden="true" />
            {isSpanish ? "Eliminar" : "Remove"}
          </button>
        ) : null}
      </div>
      <h1 className="mt-3 font-body text-[28px] font-black leading-tight text-vyva-text-1">{title}</h1>
      <p className="mt-2 max-w-2xl font-body text-[14px] font-semibold leading-relaxed text-vyva-text-2">{summary}</p>
      {providerUpdate ? (
        <div className="mt-4 border-l-4 border-[#10B981] pl-3" data-testid="concierge-task-provider-update">
          <p className="font-body text-[12px] font-black uppercase text-[#047857]">
            {providerStatusLabel(providerUpdate.status, isSpanish)}
          </p>
          {providerUpdate.summary ? (
            <p className="mt-1 font-body text-[14px] font-semibold text-vyva-text-1">{providerUpdate.summary}</p>
          ) : null}
        </div>
      ) : null}
      <ol className="mt-4 grid grid-cols-3 gap-2" aria-label={isSpanish ? "Progreso de la tarea" : "Task progress"}>
        {stages.map((item, index) => {
          const isCurrent = item.id === stage;
          const isComplete = index < activeIndex;
          return (
            <li
              key={item.id}
              className={`border-t-2 pt-2 font-body text-[11px] font-black ${isCurrent ? "border-vyva-purple text-vyva-purple" : isComplete ? "border-[#047857] text-[#047857]" : "border-vyva-border text-vyva-text-3"}`}
              aria-current={isCurrent ? "step" : undefined}
            >
              {item.label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
