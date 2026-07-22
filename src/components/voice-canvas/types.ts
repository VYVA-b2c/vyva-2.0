import type { LucideIcon } from "lucide-react";

export type VoiceCanvasSceneKind =
  | "listening"
  | "choice"
  | "place"
  | "date-time"
  | "text-entry"
  | "review"
  | "waiting"
  | "completed"
  | "blocked";

export type VoiceCanvasStatus = "idle" | "listening" | "loading" | "success" | "blocked";
export type VoiceCanvasAgentPresenceState = "idle" | "listening" | "speaking" | "thinking";

export interface VoiceCanvasChoice {
  id: string;
  label: string;
  description?: string;
  selected?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  accessibleLabel?: string;
}

export interface VoiceCanvasSummaryRow {
  id: string;
  label: string;
  value: string;
}

export interface VoiceCanvasOptionCardDetail {
  id?: string;
  label: string;
  value: string;
  tone?: "good" | "neutral" | "caution";
}

export interface VoiceCanvasOptionCardBlock {
  kind: "option-card";
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  recommended?: boolean;
  selected?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  details?: VoiceCanvasOptionCardDetail[];
  accessibleLabel?: string;
  voiceAliases?: string[];
}

export type VoiceCanvasBlock = VoiceCanvasOptionCardBlock;

export interface VoiceCanvasAction {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  accessibleLabel?: string;
}

export interface VoiceCanvasTextEntry {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: "text" | "email" | "tel" | "numeric" | "decimal" | "search" | "url";
  type?: "text" | "email" | "tel" | "date" | "time" | "datetime-local";
  multiline?: boolean;
  maxLength?: number;
  disabled?: boolean;
  accessibleLabel?: string;
}

export interface VoiceCanvasFileEntry {
  label: string;
  accept?: string;
  capture?: "user" | "environment";
  fileName?: string;
  statusLabel?: string;
  removeLabel?: string;
  disabled?: boolean;
  accessibleLabel?: string;
}

export interface VoiceCanvasProgress {
  current: number;
  total: number;
  label: string;
}

export interface VoiceCanvasAgentPresence {
  state: VoiceCanvasAgentPresenceState;
  label: string;
  description?: string;
  accessibleLabel?: string;
  ariaLive?: "off" | "polite" | "assertive";
}

export interface VoiceCanvasAgentPresenceCopy {
  idleLabel: string;
  idleDescription?: string;
  listeningLabel: string;
  listeningDescription?: string;
  speakingLabel: string;
  speakingDescription?: string;
  thinkingLabel: string;
  thinkingDescription?: string;
  accessibleLabel: string;
  ariaLive?: "off" | "polite" | "assertive";
}

export interface VoiceCanvasViewModel {
  sceneId: string;
  kind: VoiceCanvasSceneKind;
  title: string;
  helperText?: string;
  agentPresence?: VoiceCanvasAgentPresence;
  agentPresenceCopy?: VoiceCanvasAgentPresenceCopy;
  progress?: VoiceCanvasProgress;
  choices?: VoiceCanvasChoice[];
  blocks?: VoiceCanvasBlock[];
  summaryRows?: VoiceCanvasSummaryRow[];
  textEntry?: VoiceCanvasTextEntry;
  fileEntry?: VoiceCanvasFileEntry;
  status?: VoiceCanvasStatus;
  statusLabel?: string;
  primaryAction?: VoiceCanvasAction;
  secondaryAction?: VoiceCanvasAction;
}
