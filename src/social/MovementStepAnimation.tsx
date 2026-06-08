import type { CSSProperties } from "react";
import type { MovementStepMotion } from "./movementExercises";

type MotionCueKind =
  | "steady"
  | "soften"
  | "reach"
  | "side"
  | "flow"
  | "lift"
  | "lower"
  | "breathe"
  | "open"
  | "wall"
  | "foot"
  | "trace";

type MovementStepAnimationProps = {
  motion: MovementStepMotion;
  image: string;
  accent: string;
  softBg: string;
  border: string;
  stepLabel: string;
  instruction: string;
};

const MOTION_CUE_KIND: Record<MovementStepMotion, MotionCueKind> = {
  "seated-tall": "steady",
  "shoulder-roll": "open",
  "overhead-reach": "reach",
  "side-change": "side",
  "standing-support": "steady",
  "soft-knees": "soften",
  "weight-shift": "side",
  "hand-flow": "flow",
  "chair-front": "steady",
  "chair-hold": "steady",
  "knee-lift": "lift",
  "leg-lower": "lower",
  "calm-seat": "steady",
  "hands-belly": "breathe",
  inhale: "breathe",
  exhale: "breathe",
  "sit-ready": "steady",
  "feet-under": "foot",
  "stand-up": "lift",
  "sit-down": "lower",
  "chair-behind": "steady",
  "toe-rise": "lift",
  "heel-lower": "lower",
  "wall-ready": "wall",
  "hands-wall": "wall",
  "wall-lean": "wall",
  "wall-press": "wall",
  "ankle-seat": "steady",
  "foot-lift": "foot",
  "toe-flex": "foot",
  "foot-change": "side",
  "arms-open": "open",
  "breathe-open": "breathe",
  "hands-return": "flow",
  "side-support": "steady",
  "side-step": "side",
  "feet-together": "side",
  "step-return": "side",
  "hand-open": "trace",
  "finger-up": "trace",
  "finger-down": "trace",
  "next-finger": "trace",
  "shoulders-rest": "steady",
  "shoulders-lift": "lift",
  "shoulders-back": "open",
  "shoulders-drop": "lower",
};

const MOVEMENT_STEP_ANIMATION_STYLES = `
.movement-step-animation .photo-motion-image {
  transform-origin: center;
  transition: transform 350ms ease;
}
.movement-step-animation .photo-motion-cue {
  color: var(--movement-accent);
}
.movement-step-animation .photo-motion-dot {
  animation: cue-side-dot 2.8s ease-in-out infinite;
  background: var(--movement-accent);
  box-shadow: 0 0 0 7px color-mix(in srgb, var(--movement-accent) 18%, transparent);
}
.motion-kind-steady .photo-motion-image {
  animation: photo-steady 5s ease-in-out infinite;
}
.motion-kind-soften .photo-motion-image,
.motion-kind-lower .photo-motion-image {
  animation: photo-soften 4s ease-in-out infinite;
}
.motion-kind-lift .photo-motion-image,
.motion-kind-reach .photo-motion-image {
  animation: photo-lift 4s ease-in-out infinite;
}
.motion-kind-side .photo-motion-image,
.motion-kind-flow .photo-motion-image {
  animation: photo-side 4.5s ease-in-out infinite;
}
.motion-kind-breathe .photo-motion-image,
.motion-kind-open .photo-motion-image,
.motion-kind-trace .photo-motion-image {
  animation: photo-breathe 5s ease-in-out infinite;
}
.motion-kind-steady .photo-motion-dot,
.motion-kind-breathe .photo-motion-dot,
.motion-kind-open .photo-motion-dot,
.motion-kind-trace .photo-motion-dot {
  animation: cue-soft-pulse 3.2s ease-in-out infinite;
}
.motion-kind-soften .photo-motion-dot,
.motion-kind-lower .photo-motion-dot {
  animation: cue-lower-dot 2.5s ease-in-out infinite;
}
.motion-kind-reach .photo-motion-dot,
.motion-kind-lift .photo-motion-dot,
.motion-kind-foot .photo-motion-dot,
.motion-kind-wall .photo-motion-dot {
  animation: cue-up-dot 2.6s ease-in-out infinite;
}
@keyframes photo-steady {
  0%, 100% { transform: scale(1.02); }
  50% { transform: scale(1.045); }
}
@keyframes photo-soften {
  0%, 100% { transform: scale(1.035) translateY(-2px); }
  50% { transform: scale(1.045) translateY(7px); }
}
@keyframes photo-lift {
  0%, 100% { transform: scale(1.03) translateY(5px); }
  55% { transform: scale(1.045) translateY(-7px); }
}
@keyframes photo-side {
  0%, 100% { transform: scale(1.06) translateX(-7px); }
  50% { transform: scale(1.06) translateX(7px); }
}
@keyframes photo-breathe {
  0%, 100% { transform: scale(1.025); }
  55% { transform: scale(1.055); }
}
@keyframes cue-soft-pulse {
  0%, 100% { transform: translateX(0) scale(0.86); opacity: 0.44; }
  50% { transform: translateX(0) scale(1.18); opacity: 0.92; }
}
@keyframes cue-side-dot {
  0%, 100% { transform: translateX(-58px); opacity: 0.46; }
  50% { transform: translateX(58px); opacity: 0.94; }
}
@keyframes cue-lower-dot {
  0%, 100% { transform: translateY(-7px); opacity: 0.88; }
  65% { transform: translateY(8px); opacity: 0.44; }
}
@keyframes cue-up-dot {
  0%, 100% { transform: translateY(8px); opacity: 0.46; }
  55% { transform: translateY(-8px); opacity: 0.94; }
}
@media (prefers-reduced-motion: reduce) {
  .movement-step-animation * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

export default function MovementStepAnimation({
  motion,
  image,
  accent,
  softBg,
  border,
  stepLabel,
  instruction,
}: MovementStepAnimationProps) {
  const cueKind = MOTION_CUE_KIND[motion];
  const style = {
    "--movement-accent": accent,
    "--movement-soft-bg": softBg,
    "--movement-border": border,
  } as CSSProperties;

  return (
    <div
      className={`movement-step-animation motion-${motion} motion-kind-${cueKind} overflow-hidden rounded-[24px] border bg-white`}
      style={{ ...style, borderColor: border }}
      data-testid="movement-exercise-step-visual"
      data-motion={motion}
      aria-label={`${stepLabel}: ${instruction}`}
    >
      <style>{MOVEMENT_STEP_ANIMATION_STYLES}</style>
      <div className="relative aspect-[16/9] min-h-[176px] w-full overflow-hidden bg-[#EEF7F9] sm:min-h-[270px]">
        <img
          src={image}
          alt=""
          className="photo-motion-image absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#123047]/26 via-transparent to-white/6" />
      </div>
      <div className="border-t px-4 py-3" style={{ background: softBg, borderColor: border }}>
        <div className="photo-motion-cue relative mb-3 h-2.5 w-[132px] rounded-full bg-white/88 shadow-[0_8px_18px_rgba(18,48,71,0.1)] sm:w-[168px]">
          <span className="photo-motion-dot absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        </div>
        <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
          <span
            className="inline-flex w-fit rounded-full bg-white px-3 py-1.5 font-body text-[13px] font-black leading-tight"
            style={{ color: accent }}
          >
            {stepLabel}
          </span>
          <span className="font-body text-[15px] font-black leading-snug text-[#123047] sm:text-[16px]">
            {instruction}
          </span>
        </div>
      </div>
    </div>
  );
}
