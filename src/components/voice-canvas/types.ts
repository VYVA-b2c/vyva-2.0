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

export interface VoiceCanvasViewModel {
  sceneId: string;
  kind: VoiceCanvasSceneKind;
  title: string;
  helperText?: string;
  progress?: VoiceCanvasProgress;
  choices?: VoiceCanvasChoice[];
  summaryRows?: VoiceCanvasSummaryRow[];
  textEntry?: VoiceCanvasTextEntry;
  fileEntry?: VoiceCanvasFileEntry;
  status?: VoiceCanvasStatus;
  statusLabel?: string;
  primaryAction?: VoiceCanvasAction;
  secondaryAction?: VoiceCanvasAction;
}
