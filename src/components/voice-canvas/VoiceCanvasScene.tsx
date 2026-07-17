import { Check, CircleAlert, LoaderCircle, MapPin, type LucideIcon } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";
import ZamoraVoiceOrb from "@/components/ZamoraVoiceOrb";
import type { VoiceCanvasChoice, VoiceCanvasViewModel } from "./types";
import "./voice-canvas.css";

export interface VoiceCanvasSceneProps {
  viewModel: VoiceCanvasViewModel;
  onChoice?: (choiceId: string) => void;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onTextChange?: (value: string) => void;
  className?: string;
}

const statusIcons: Partial<Record<VoiceCanvasViewModel["kind"], LucideIcon>> = {
  completed: Check,
  blocked: CircleAlert,
  waiting: LoaderCircle,
};

function ChoiceButton({ choice, onChoice }: { choice: VoiceCanvasChoice; onChoice?: (id: string) => void }) {
  const Icon = choice.icon ?? MapPin;
  return (
    <button
      type="button"
      className="vc-choice"
      data-selected={choice.selected || undefined}
      aria-pressed={choice.selected}
      aria-label={choice.accessibleLabel}
      disabled={choice.disabled}
      onClick={() => onChoice?.(choice.id)}
    >
      <span className="vc-choice-icon" aria-hidden="true"><Icon size={24} strokeWidth={1.8} /></span>
      <span className="vc-choice-copy">
        <span className="vc-choice-label">{choice.label}</span>
        {choice.description && <span className="vc-choice-description">{choice.description}</span>}
      </span>
      {choice.selected && <Check className="vc-choice-check" size={24} aria-hidden="true" />}
    </button>
  );
}

export function VoiceCanvasScene({ viewModel, onChoice, onPrimary, onSecondary, onTextChange, className = "" }: VoiceCanvasSceneProps) {
  const { kind, title, helperText, progress, choices = [], summaryRows = [], textEntry, statusLabel } = viewModel;
  const StatusIcon = statusIcons[kind];
  const isWaiting = kind === "waiting" || viewModel.status === "loading";
  const titleId = `voice-canvas-title-${viewModel.sceneId}`;
  const helperId = helperText ? `voice-canvas-helper-${viewModel.sceneId}` : undefined;

  const handleChoiceKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowRight" && event.key !== "ArrowUp" && event.key !== "ArrowLeft") return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0 || buttons.length < 2) return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    buttons[(current + direction + buttons.length) % buttons.length].focus();
  };

  const handleTextChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onTextChange?.(event.target.value);

  return (
    <section
      className={`voice-canvas ${className}`.trim()}
      data-kind={kind}
      data-status={viewModel.status ?? "idle"}
      aria-labelledby={titleId}
      aria-describedby={helperId}
      aria-busy={isWaiting}
    >
      {progress && (
        <div className="vc-progress" aria-label={progress.label} role="progressbar" aria-valuemin={1} aria-valuemax={progress.total} aria-valuenow={progress.current}>
          <span className="vc-progress-label">{progress.label}</span>
          <span className="vc-progress-track" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, progress.current / progress.total * 100))}%` }} /></span>
        </div>
      )}

      <div className="vc-content">
        {kind === "listening" && (
          <div className="vc-orb-wrap" aria-hidden="true"><ZamoraVoiceOrb state="listening" size={92} isDark={false} testId={`voice-canvas-orb-${viewModel.sceneId}`} /></div>
        )}
        {StatusIcon && (
          <span className="vc-status-icon" data-icon={kind} aria-hidden="true"><StatusIcon size={32} strokeWidth={1.8} /></span>
        )}
        {statusLabel && <p className="vc-eyebrow" role={isWaiting ? "status" : undefined}>{statusLabel}</p>}
        <h2 id={titleId} tabIndex={-1}>{title}</h2>
        {helperText && <p id={helperId} className="vc-helper">{helperText}</p>}

        {choices.length > 0 && <div className="vc-choices" role="group" aria-label={title} onKeyDown={handleChoiceKeyDown}>{choices.map((choice) => <ChoiceButton key={choice.id} choice={choice} onChoice={onChoice} />)}</div>}

        {textEntry && (
          <label className="vc-field">
            <span>{textEntry.label}</span>
            {textEntry.multiline ? (
              <textarea value={textEntry.value} placeholder={textEntry.placeholder} maxLength={textEntry.maxLength} disabled={textEntry.disabled} aria-label={textEntry.accessibleLabel} onChange={handleTextChange} rows={4} />
            ) : (
              <input value={textEntry.value} placeholder={textEntry.placeholder} maxLength={textEntry.maxLength} disabled={textEntry.disabled} aria-label={textEntry.accessibleLabel} inputMode={textEntry.inputMode} type={textEntry.type ?? "text"} onChange={handleTextChange} />
            )}
          </label>
        )}

        {summaryRows.length > 0 && <dl className="vc-summary">{summaryRows.map((row) => <div key={row.id}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>}

        {(viewModel.primaryAction || viewModel.secondaryAction) && (
          <div className="vc-actions">
            {viewModel.primaryAction && <button type="button" className="vc-primary" disabled={viewModel.primaryAction.disabled || viewModel.primaryAction.loading} aria-label={viewModel.primaryAction.accessibleLabel} onClick={onPrimary}>{viewModel.primaryAction.loading && <LoaderCircle className="vc-spin" size={22} aria-hidden="true" />}<span>{viewModel.primaryAction.label}</span></button>}
            {viewModel.secondaryAction && <button type="button" className="vc-secondary" disabled={viewModel.secondaryAction.disabled || viewModel.secondaryAction.loading} aria-label={viewModel.secondaryAction.accessibleLabel} onClick={onSecondary}>{viewModel.secondaryAction.label}</button>}
          </div>
        )}
      </div>
    </section>
  );
}

export default VoiceCanvasScene;
