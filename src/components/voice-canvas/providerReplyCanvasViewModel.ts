import {
  AlertTriangle,
  BadgeCheck,
  ClipboardCheck,
  FileText,
  MessageCircle,
  PenLine,
  RotateCcw,
  Send,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type {
  VoiceCanvasAgentPresenceCopy,
  VoiceCanvasOptionCardDetail,
  VoiceCanvasSummaryRow,
  VoiceCanvasViewModel,
} from "./types";
import {
  isValidProviderReplyScheduledFor,
  type ProviderReplyIntent,
  type ProviderReplyCanvasState,
} from "./providerReplyCanvasMachine";

export interface ProviderReplyCanvasContext {
  providerName?: string;
  providerType?: string;
  actionLabel?: string;
  waitingSinceLabel?: string;
  requiresScheduledFor?: boolean;
  replyIntents?: ProviderReplyIntent[];
  rows?: VoiceCanvasSummaryRow[];
}

export interface ProviderReplyCanvasCopy {
  agentPresence: VoiceCanvasAgentPresenceCopy;
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
    providerType: string;
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
    intent: string;
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
    urgentBoundaryHelper: string;
    retry: string;
    cancel: string;
  };
  cancelled: {
    status: string;
    title: string;
    helper: string;
    restart: string;
  };
  detailLabels: {
    messagePurpose: string;
    providerType: string;
    confidence: string;
    reviewNeeded: string;
    draftOnly: string;
    noMessageSent: string;
    reviewBeforeSend: string;
    recommended: string;
    urgentBoundary: string;
    outgoingDraft: string;
    editBeforeSend: string;
  };
  progress: (current: number, total: number) => string;
}

const totalSteps = 5;
const progress = (copy: ProviderReplyCanvasCopy, current: number) => ({
  current,
  total: totalSteps,
  label: copy.progress(current, totalSteps),
});

const detail = (
  id: string,
  label: string,
  value?: string,
  tone?: "good" | "neutral" | "caution",
): VoiceCanvasOptionCardDetail[] => value ? [{ id, label, value, tone }] : [];

function intentIcon(intent: ProviderReplyIntent): LucideIcon {
  const id = intent.id.toLocaleLowerCase();
  if (intent.urgent) return AlertTriangle;
  if (id.includes("reschedule")) return RotateCcw;
  if (id.includes("question")) return MessageCircle;
  if (id.includes("document") || id.includes("info")) return FileText;
  if (id.includes("decline") || id.includes("cancel")) return AlertTriangle;
  if (id.includes("confirm")) return BadgeCheck;
  return Send;
}

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
  if (context.providerType?.trim()) {
    rows.push({
      id: "provider-type",
      label: copy.context.providerType,
      value: context.providerType.trim(),
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
        kind: context.replyIntents?.length ? "choice" : "review",
        title: copy.context.title,
        helperText: copy.context.helper,
        agentPresenceCopy: copy.agentPresence,
        progress: progress(copy, 1),
        blocks: context.replyIntents?.map((intent) => ({
          kind: "option-card" as const,
          id: `intent:${intent.id}`,
          title: intent.label,
          subtitle: intent.subtitle || (intent.urgent ? copy.detailLabels.urgentBoundary : copy.detailLabels.draftOnly),
          description: intent.description,
          badge: intent.recommended ? copy.detailLabels.recommended : undefined,
          recommended: intent.recommended,
          selected: (state.draft.replyIntentId ?? "") === intent.id,
          icon: intentIcon(intent),
          accessibleLabel: [
            intent.label,
            intent.subtitle,
            intent.description,
            intent.urgent ? copy.detailLabels.urgentBoundary : copy.detailLabels.noMessageSent,
          ].filter(Boolean).join(". "),
          voiceAliases: intent.voiceAliases,
          details: [
            ...detail("purpose", copy.detailLabels.messagePurpose, intent.purposeLabel || intent.label),
            ...detail("provider-type", copy.detailLabels.providerType, intent.providerType || context.providerType),
            ...detail("confidence", copy.detailLabels.confidence, intent.confidenceLabel || copy.detailLabels.reviewNeeded, intent.urgent ? "caution" : "neutral"),
            ...detail("draft-only", copy.detailLabels.draftOnly, intent.draftOnlyLabel || copy.detailLabels.noMessageSent, intent.urgent ? "caution" : "good"),
            ...detail("review", copy.detailLabels.reviewBeforeSend, intent.reviewReminder || copy.detailLabels.reviewBeforeSend),
            ...detail("boundary", copy.detailLabels.urgentBoundary, intent.boundaryLabel, intent.urgent ? "caution" : "neutral"),
          ],
        })),
        summaryRows: contextRows(context, copy),
        primaryAction: {
          label: copy.context.continue,
          disabled: Boolean(context.replyIntents?.length) && !(state.draft.replyIntentId ?? "").trim(),
        },
        secondaryAction: { label: copy.context.back },
      };
    case "reply":
      return {
        sceneId: "provider-reply-compose",
        kind: "text-entry",
        title: copy.reply.title,
        helperText: copy.reply.helper,
        progress: progress(copy, 2),
        blocks: [{
          kind: "option-card",
          id: "reply-draft-guidance",
          title: state.draft.replyIntentLabel || copy.detailLabels.outgoingDraft,
          subtitle: copy.detailLabels.draftOnly,
          description: copy.detailLabels.editBeforeSend,
          icon: PenLine,
          disabled: true,
          details: [
            ...detail("provider", copy.context.provider, context.providerName),
            ...detail("purpose", copy.detailLabels.messagePurpose, state.draft.replyIntentLabel || context.actionLabel),
            ...detail("boundary", copy.detailLabels.noMessageSent, copy.detailLabels.noMessageSent, "good"),
          ],
        }],
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
        (state.draft.replyIntentLabel ?? "").trim()
          ? {
              id: "intent",
              label: copy.review.intent,
              value: (state.draft.replyIntentLabel ?? "").trim(),
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
        blocks: [{
          kind: "option-card",
          id: "review-before-send",
          title: copy.detailLabels.reviewBeforeSend,
          subtitle: copy.detailLabels.noMessageSent,
          description: copy.detailLabels.editBeforeSend,
          icon: ClipboardCheck,
          disabled: true,
          details: [
            ...detail("draft", copy.detailLabels.outgoingDraft, copy.detailLabels.draftOnly, "good"),
            ...detail("confidence", copy.detailLabels.confidence, copy.detailLabels.reviewNeeded),
          ],
        }],
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
