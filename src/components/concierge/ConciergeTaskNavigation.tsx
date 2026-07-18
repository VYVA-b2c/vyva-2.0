import { ArrowLeft, Check, ChevronRight, ClipboardCheck } from "lucide-react";
import type { ConciergeTaskStage } from "@/lib/conciergeTaskNavigation";

type HomeTask = {
  id: string;
  title: string;
  summary: string;
};

type CompletedTask = {
  id: string;
  title: string;
  summary: string;
};

export function ConciergeHomeTaskOverview({
  activeTask,
  queuedCount,
  completedTasks,
  isLoading,
  isSpanish,
  onContinue,
  onReviewHistory,
}: {
  activeTask: HomeTask | null;
  queuedCount: number;
  completedTasks: CompletedTask[];
  isLoading: boolean;
  isSpanish: boolean;
  onContinue: (task: HomeTask) => void;
  onReviewHistory: () => void;
}) {
  return (
    <section className="mt-5 border-t border-vyva-border pt-5" data-testid="concierge-home-task-overview">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-body text-[22px] font-black text-vyva-text-1">
          {isSpanish ? "Tus tareas" : "Your tasks"}
        </h2>
        {queuedCount > 0 ? (
          <span className="font-body text-[12px] font-bold text-vyva-text-2">
            {queuedCount} {isSpanish ? "en cola" : "queued"}
          </span>
        ) : null}
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
            {isSpanish ? "Continuar" : "Continue"}
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <p className="mt-3 border-y border-vyva-border py-4 font-body text-[14px] font-semibold text-vyva-text-2">
          {isSpanish ? "No tienes tareas pendientes." : "You have no pending tasks."}
        </p>
      )}

      {completedTasks.length > 0 ? (
        <div className="pt-4" data-testid="concierge-home-completed-tasks">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-body text-[14px] font-black text-vyva-text-1">
              {isSpanish ? "Hecho recientemente" : "Done recently"}
            </h3>
            <button type="button" onClick={onReviewHistory} className="vyva-tap font-body text-[13px] font-black text-vyva-purple">
              {isSpanish ? "Ver historial" : "View history"}
            </button>
          </div>
          <div className="mt-2 divide-y divide-vyva-border">
            {completedTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-3 py-3">
                <Check size={17} className="mt-0.5 flex-shrink-0 text-[#047857]" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-body text-[13px] font-black text-vyva-text-1">{task.title}</p>
                  <p className="mt-0.5 line-clamp-1 font-body text-[12px] font-semibold text-vyva-text-2">{task.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ConciergeTaskWorkspaceHeader({
  title,
  summary,
  stage,
  isSpanish,
  onBack,
}: {
  title: string;
  summary: string;
  stage: ConciergeTaskStage;
  isSpanish: boolean;
  onBack: () => void;
}) {
  const stages: Array<{ id: ConciergeTaskStage; label: string }> = [
    { id: "details", label: isSpanish ? "Detalles" : "Details" },
    { id: "review", label: isSpanish ? "Revisar" : "Review" },
    { id: "confirmation", label: isSpanish ? "Confirmar" : "Confirm" },
  ];
  const activeIndex = stages.findIndex((item) => item.id === stage);

  return (
    <section className="mt-4 border-b border-vyva-border pb-5" data-testid="concierge-task-workspace" data-task-stage={stage}>
      <button
        type="button"
        onClick={onBack}
        className="vyva-tap inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 font-body text-[14px] font-black text-vyva-text-2"
        data-testid="button-concierge-task-back"
      >
        <ArrowLeft size={19} aria-hidden="true" />
        {isSpanish ? "Volver a Concierge" : "Back to Concierge"}
      </button>
      <h1 className="mt-3 font-body text-[28px] font-black leading-tight text-vyva-text-1">{title}</h1>
      <p className="mt-2 max-w-2xl font-body text-[14px] font-semibold leading-relaxed text-vyva-text-2">{summary}</p>
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
