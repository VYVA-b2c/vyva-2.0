import type { VoiceCanvasSummaryRow, VoiceCanvasViewModel } from "./types";
import {
  isValidProviderReplyScheduledFor,
  type ProviderReplyCanvasState,
} from "./providerReplyCanvasMachine";

export interface ProviderReplyCanvasContext {
  providerName?: string;
  actionLabel?: string;
  waitingSinceLabel?: string;
  requiresScheduledFor?: boolean;
  rows?: VoiceCanvasSummaryRow[];
}

export interface ProviderReplyCanvasCopy {
  listening: {
    status: string;
    title: string;
    helper: string;
    start: string;
    cancel: string;
  };
  context: {
    title: string;
    helper: string;
    provider: string;
    action: string;
    waiting: string;
    continue: string;
    back: string;
  };
  reply: {
    title: string;
    helper: string;
    label: string;
    placeholder: string;
    continue: string;
    back: string;
  };
  scheduledFor: {
    title: string;
    helper: string;
    label: string;
    continue: string;
    back: string;
  };
  details: {
    title: string;
    helper: string;
    label: string;
    placeholder: string;
    continue: string;
    back: string;
  };
  review: {
    title: string;
    helper: string;
    provider: string;
    action: string;
    reply: string;
    scheduledFor: string;
    notes: string;
    noNotes: string;
    save: string;
    back: string;
  };
  saving: {
    status: string;
    title: string;
    helper: string;
    action: string;
  };
  saved: {
    status: string;
    title: string;
    helper: string;
    reference: string;
    markComplete: string;
    edit: string;
  };
  completing: {
    status: string;
    title: string;
    helper: string;
    action: string;
  };
  completed: {
    status: string;
    title: string;
    helper: string;
    reference: string;
    done: string;
  };
  blocked: {
    status: string;
    title: string;
    helper: string;
    missingContextHelper: string;
    incompleteReplyHelper: string;
    incompleteScheduledForHelper: string;
    retry: string;
    cancel: string;
  };
  cancelled: {
    status: string;
    title: string;
    helper: string;
    restart: string;
  };
  progress: (current: number, total: number) => string;
}

const totalSteps = 5;
const progress = (copy: ProviderReplyCanvasCopy, current: number) => ({
  current,
  total: totalSteps,
  label: copy.progress(current, totalSteps),
});

function contextRows(
  context: ProviderReplyCanvasContext,
  copy: ProviderReplyCanvasCopy,
): VoiceCanvasSummaryRow[] {
  const rows: VoiceCanvasSummaryRow[] = [...(context.rows ?? [])];
  if (context.providerName?.trim()) {
    rows.unshift({
      id: "provider",
      label: copy.context.provider,
      value: context.providerName.trim(),
    });
  }
  if (context.actionLabel?.trim()) {
    rows.push({
      id: "action",
      label: copy.context.action,
      value: context.actionLabel.trim(),
    });
  }
  if (context.waitingSinceLabel?.trim()) {
    rows.push({
      id: "waiting",
      label: copy.context.waiting,
      value: context.waitingSinceLabel.trim(),
    });
  }
  return rows.filter((row, index, all) => (
    all.findIndex((candidate) => candidate.id === row.id) === index
  ));
}

function hasContext(context: ProviderReplyCanvasContext) {
  return Boolean(
    context.providerName?.trim() ||
      context.actionLabel?.trim() ||
      context.rows?.some((row) => row.value.trim()),
  );
}

export function providerReplyCanvasViewModel(
  state: ProviderReplyCanvasState,
  copy: ProviderReplyCanvasCopy,
  context: ProviderReplyCanvasContext,
): VoiceCanvasViewModel {
  if (!hasContext(context) && state.step !== "completed") {
    return {
      sceneId: "provider-reply-missing-context",
      kind: "blocked",
      title: copy.blocked.title,
      helperText: copy.blocked.missingContextHelper,
      status: "blocked",
      statusLabel: copy.blocked.status,
      primaryAction: { label: copy.blocked.retry },
      secondaryAction: { label: copy.blocked.cancel },
    };
  }

  switch (state.step) {
    case "listening":
      return {
        sceneId: "provider-reply-listening",
        kind: "listening",
        title: copy.listening.title,
        helperText: copy.listening.helper,
        status: "listening",
        statusLabel: copy.listening.status,
        primaryAction: { label: copy.listening.start },
        secondaryAction: { label: copy.listening.cancel },
      };
    case "context":
      return {
        sceneId: "provider-reply-context",
        kind: "review",
        title: copy.context.title,
        helperText: copy.context.helper,
        progress: progress(copy, 1),
        summaryRows: contextRows(context, copy),
        primaryAction: { label: copy.context.continue },
        secondaryAction: { label: copy.context.back },
      };
    case "reply":
      return {
        sceneId: "provider-reply-compose",
        kind: "text-entry",
        title: copy.reply.title,
        helperText: copy.reply.helper,
        progress: progress(copy, 2),
        textEntry: {
          label: copy.reply.label,
          value: state.draft.providerReply,
          placeholder: copy.reply.placeholder,
          accessibleLabel: copy.reply.label,
          multiline: true,
        },
        primaryAction: {
          label: copy.reply.continue,
          disabled: !state.draft.providerReply.trim(),
        },
        secondaryAction: { label: copy.reply.back },
      };
    case "scheduledFor":
      return {
        sceneId: "provider-reply-scheduled-for",
        kind: "date-time",
        title: copy.scheduledFor.title,
        helperText: copy.scheduledFor.helper,
        progress: progress(copy, 3),
        textEntry: {
          label: copy.scheduledFor.label,
          value: state.draft.scheduledFor,
          type: "datetime-local",
          accessibleLabel: copy.scheduledFor.label,
        },
        primaryAction: {
          label: copy.scheduledFor.continue,
          disabled: !isValidProviderReplyScheduledFor(state.draft.scheduledFor),
        },
        secondaryAction: { label: copy.scheduledFor.back },
      };
    case "details":
      return {
        sceneId: "provider-reply-details",
        kind: "text-entry",
        title: copy.details.title,
        helperText: copy.details.helper,
        progress: progress(copy, context.requiresScheduledFor ? 4 : 3),
        textEntry: {
          label: copy.details.label,
          value: state.draft.notes,
          placeholder: copy.details.placeholder,
          accessibleLabel: copy.details.label,
          multiline: true,
        },
        primaryAction: { label: copy.details.continue },
        secondaryAction: { label: copy.details.back },
      };
    case "review": {
      const rows: VoiceCanvasSummaryRow[] = [
        context.providerName?.trim()
          ? {
              id: "provider",
              label: copy.review.provider,
              value: context.providerName.trim(),
            }
          : null,
        context.actionLabel?.trim()
          ? {
              id: "action",
              label: copy.review.action,
              value: context.actionLabel.trim(),
            }
          : null,
        {
          id: "reply",
          label: copy.review.reply,
          value: state.draft.providerReply,
        },
        context.requiresScheduledFor
          ? {
              id: "scheduled-for",
              label: copy.review.scheduledFor,
              value: state.draft.scheduledFor,
            }
          : null,
        {
          id: "notes",
          label: copy.review.notes,
          value: state.draft.notes.trim() || copy.review.noNotes,
        },
      ].filter((row): row is VoiceCanvasSummaryRow => Boolean(row));
      return {
        sceneId: "provider-reply-review",
        kind: "review",
        title: copy.review.title,
        helperText: copy.review.helper,
        progress: progress(copy, 5),
        summaryRows: rows,
        primaryAction: { label: copy.review.save },
        secondaryAction: { label: copy.review.back },
      };
    }
    case "saving":
      return {
        sceneId: "provider-reply-saving",
        kind: "waiting",
        title: copy.saving.title,
        helperText: copy.saving.helper,
        status: "loading",
        statusLabel: copy.saving.status,
        primaryAction: { label: copy.saving.action, loading: true, disabled: true },
      };
    case "saved":
      return {
        sceneId: "provider-reply-saved",
        kind: "completed",
        title: copy.saved.title,
        helperText: state.savedSummary || copy.saved.helper,
        status: "success",
        statusLabel: copy.saved.status,
        summaryRows: state.resultReference
          ? [{ id: "reference", label: copy.saved.reference, value: state.resultReference }]
          : [],
        primaryAction: { label: copy.saved.markComplete },
        secondaryAction: { label: copy.saved.edit },
      };
    case "completing":
      return {
        sceneId: "provider-reply-completing",
        kind: "waiting",
        title: copy.completing.title,
        helperText: copy.completing.helper,
        status: "loading",
        statusLabel: copy.completing.status,
        primaryAction: { label: copy.completing.action, loading: true, disabled: true },
      };
    case "completed":
      return {
        sceneId: "provider-reply-completed",
        kind: "completed",
        title: copy.completed.title,
        helperText: copy.completed.helper,
        status: "success",
        statusLabel: copy.completed.status,
        summaryRows: state.resultReference
          ? [{ id: "reference", label: copy.completed.reference, value: state.resultReference }]
          : [],
        primaryAction: { label: copy.completed.done },
      };
    case "blocked":
      return {
        sceneId: "provider-reply-blocked",
        kind: "blocked",
        title: copy.blocked.title,
        helperText: state.errorMessage || copy.blocked.helper,
        status: "blocked",
        statusLabel: copy.blocked.status,
        primaryAction: { label: copy.blocked.retry },
        secondaryAction: { label: copy.blocked.cancel },
      };
    case "cancelled":
      return {
        sceneId: "provider-reply-cancelled",
        kind: "blocked",
        title: copy.cancelled.title,
        helperText: copy.cancelled.helper,
        status: "idle",
        statusLabel: copy.cancelled.status,
        primaryAction: { label: copy.cancelled.restart },
      };
  }
}
