import type { CSSProperties } from "react";
import type { MovementStepMotion } from "./movementExercises";

type MotionPosture = "seated" | "standing" | "wall" | "hand";
type MotionSupport = "chair" | "counter" | "wall" | "none";

type MotionProfile = {
  posture: MotionPosture;
  support: MotionSupport;
};

type MovementStepAnimationProps = {
  motion: MovementStepMotion;
  accent: string;
  softBg: string;
  border: string;
  stepLabel: string;
  instruction: string;
};

const MOTION_PROFILES: Record<MovementStepMotion, MotionProfile> = {
  "seated-tall": { posture: "seated", support: "chair" },
  "shoulder-roll": { posture: "seated", support: "chair" },
  "overhead-reach": { posture: "seated", support: "chair" },
  "side-change": { posture: "seated", support: "chair" },
  "standing-support": { posture: "standing", support: "chair" },
  "soft-knees": { posture: "standing", support: "chair" },
  "weight-shift": { posture: "standing", support: "chair" },
  "hand-flow": { posture: "standing", support: "none" },
  "chair-front": { posture: "seated", support: "chair" },
  "chair-hold": { posture: "seated", support: "chair" },
  "knee-lift": { posture: "seated", support: "chair" },
  "leg-lower": { posture: "seated", support: "chair" },
  "calm-seat": { posture: "seated", support: "chair" },
  "hands-belly": { posture: "seated", support: "chair" },
  inhale: { posture: "seated", support: "chair" },
  exhale: { posture: "seated", support: "chair" },
  "sit-ready": { posture: "seated", support: "chair" },
  "feet-under": { posture: "seated", support: "chair" },
  "stand-up": { posture: "standing", support: "chair" },
  "sit-down": { posture: "standing", support: "chair" },
  "chair-behind": { posture: "standing", support: "chair" },
  "toe-rise": { posture: "standing", support: "chair" },
  "heel-lower": { posture: "standing", support: "chair" },
  "wall-ready": { posture: "wall", support: "wall" },
  "hands-wall": { posture: "wall", support: "wall" },
  "wall-lean": { posture: "wall", support: "wall" },
  "wall-press": { posture: "wall", support: "wall" },
  "ankle-seat": { posture: "seated", support: "chair" },
  "foot-lift": { posture: "seated", support: "chair" },
  "toe-flex": { posture: "seated", support: "chair" },
  "foot-change": { posture: "seated", support: "chair" },
  "arms-open": { posture: "seated", support: "chair" },
  "breathe-open": { posture: "seated", support: "chair" },
  "hands-return": { posture: "seated", support: "chair" },
  "side-support": { posture: "standing", support: "counter" },
  "side-step": { posture: "standing", support: "counter" },
  "feet-together": { posture: "standing", support: "counter" },
  "step-return": { posture: "standing", support: "counter" },
  "hand-open": { posture: "hand", support: "none" },
  "finger-up": { posture: "hand", support: "none" },
  "finger-down": { posture: "hand", support: "none" },
  "next-finger": { posture: "hand", support: "none" },
  "shoulders-rest": { posture: "seated", support: "chair" },
  "shoulders-lift": { posture: "seated", support: "chair" },
  "shoulders-back": { posture: "seated", support: "chair" },
  "shoulders-drop": { posture: "seated", support: "chair" },
};

const MOVEMENT_STEP_ANIMATION_STYLES = `
.movement-step-animation svg * {
  vector-effect: non-scaling-stroke;
}
.movement-step-animation .guide-person,
.movement-step-animation .guide-head,
.movement-step-animation .guide-torso,
.movement-step-animation .guide-shoulders,
.movement-step-animation .guide-left-arm,
.movement-step-animation .guide-right-arm,
.movement-step-animation .guide-left-leg,
.movement-step-animation .guide-right-leg,
.movement-step-animation .guide-left-foot,
.movement-step-animation .guide-right-foot,
.movement-step-animation .guide-hand,
.movement-step-animation .guide-trace-dot,
.movement-step-animation .guide-breath-ring {
  transform-box: fill-box;
  transform-origin: center;
}
.movement-step-animation .guide-left-arm {
  transform-origin: right top;
}
.movement-step-animation .guide-right-arm {
  transform-origin: left top;
}
.movement-step-animation .guide-left-leg {
  transform-origin: right top;
}
.movement-step-animation .guide-right-leg {
  transform-origin: left top;
}
.movement-step-animation .guide-breath-ring {
  opacity: 0;
}
.movement-step-animation .guide-trace-dot {
  opacity: 0.92;
}
.motion-seated-tall .guide-person,
.motion-calm-seat .guide-person,
.motion-shoulders-rest .guide-person,
.motion-chair-front .guide-person,
.motion-chair-behind .guide-person,
.motion-standing-support .guide-person,
.motion-wall-ready .guide-person,
.motion-side-support .guide-person {
  animation: guide-soft-breathe 3.2s ease-in-out infinite;
}
.motion-shoulder-roll .guide-shoulders,
.motion-shoulders-back .guide-shoulders {
  animation: guide-shoulder-roll 2.4s ease-in-out infinite;
}
.motion-shoulders-lift .guide-shoulders {
  animation: guide-shoulder-lift 2.2s ease-in-out infinite;
}
.motion-shoulders-drop .guide-shoulders {
  animation: guide-shoulder-drop 2.2s ease-in-out infinite;
}
.motion-overhead-reach .guide-left-arm {
  animation: guide-reach-up 2.5s ease-in-out infinite;
}
.motion-side-change .guide-person,
.motion-foot-change .guide-person,
.motion-step-return .guide-person {
  animation: guide-change-side 2.8s ease-in-out infinite;
}
.motion-soft-knees .guide-left-leg,
.motion-soft-knees .guide-right-leg,
.motion-feet-under .guide-left-leg,
.motion-feet-under .guide-right-leg {
  animation: guide-soft-knees 2.3s ease-in-out infinite;
}
.motion-weight-shift .guide-person {
  animation: guide-weight-shift 2.8s ease-in-out infinite;
}
.motion-hand-flow .guide-left-arm,
.motion-hand-flow .guide-right-arm {
  animation: guide-hand-flow 2.8s ease-in-out infinite;
}
.motion-chair-hold .guide-left-arm,
.motion-chair-hold .guide-right-arm,
.motion-hands-belly .guide-left-arm,
.motion-hands-belly .guide-right-arm,
.motion-hands-wall .guide-left-arm,
.motion-hands-wall .guide-right-arm {
  animation: guide-hands-settle 2.4s ease-in-out infinite;
}
.motion-knee-lift .guide-left-leg,
.motion-foot-lift .guide-left-leg {
  animation: guide-knee-lift 2.4s ease-in-out infinite;
}
.motion-leg-lower .guide-left-leg,
.motion-heel-lower .guide-person {
  animation: guide-lower-slowly 2.5s ease-in-out infinite;
}
.motion-inhale .guide-breath-ring,
.motion-breathe-open .guide-breath-ring {
  opacity: 0.85;
  animation: guide-inhale 2.8s ease-in-out infinite;
}
.motion-exhale .guide-breath-ring {
  opacity: 0.75;
  animation: guide-exhale 2.8s ease-in-out infinite;
}
.motion-stand-up .guide-person {
  animation: guide-stand-up 2.7s ease-in-out infinite;
}
.motion-sit-down .guide-person {
  animation: guide-sit-down 2.7s ease-in-out infinite;
}
.motion-toe-rise .guide-person {
  animation: guide-toe-rise 2.2s ease-in-out infinite;
}
.motion-wall-lean .guide-person {
  animation: guide-wall-lean 2.5s ease-in-out infinite;
}
.motion-wall-press .guide-person {
  animation: guide-wall-press 2.5s ease-in-out infinite;
}
.motion-toe-flex .guide-left-foot {
  animation: guide-toe-flex 2.3s ease-in-out infinite;
}
.motion-arms-open .guide-left-arm {
  animation: guide-arm-open-left 2.7s ease-in-out infinite;
}
.motion-arms-open .guide-right-arm {
  animation: guide-arm-open-right 2.7s ease-in-out infinite;
}
.motion-hands-return .guide-left-arm,
.motion-hands-return .guide-right-arm {
  animation: guide-hands-return 2.6s ease-in-out infinite;
}
.motion-side-step .guide-person {
  animation: guide-side-step 2.7s ease-in-out infinite;
}
.motion-feet-together .guide-left-foot {
  animation: guide-feet-together 2.4s ease-in-out infinite;
}
.motion-hand-open .guide-hand {
  animation: guide-hand-open 2.8s ease-in-out infinite;
}
.motion-finger-up .guide-trace-dot {
  animation: guide-finger-up 2.4s ease-in-out infinite;
}
.motion-finger-down .guide-trace-dot {
  animation: guide-finger-down 2.4s ease-in-out infinite;
}
.motion-next-finger .guide-trace-dot {
  animation: guide-next-finger 2.6s ease-in-out infinite;
}
@keyframes guide-soft-breathe {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes guide-shoulder-roll {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  50% { transform: translate(0, -7px) rotate(-4deg); }
}
@keyframes guide-shoulder-lift {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes guide-shoulder-drop {
  0% { transform: translateY(-8px); }
  55%, 100% { transform: translateY(5px); }
}
@keyframes guide-reach-up {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  50% { transform: rotate(-46deg) translate(-10px, -18px); }
}
@keyframes guide-change-side {
  0%, 100% { transform: translateX(-7px); }
  50% { transform: translateX(7px); }
}
@keyframes guide-soft-knees {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(8px) rotate(4deg); }
}
@keyframes guide-weight-shift {
  0%, 100% { transform: translateX(-12px); }
  50% { transform: translateX(12px); }
}
@keyframes guide-hand-flow {
  0%, 100% { transform: translateX(-8px) rotate(-5deg); }
  50% { transform: translateX(14px) rotate(5deg); }
}
@keyframes guide-hands-settle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(4px); }
}
@keyframes guide-knee-lift {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translate(-8px, -22px) rotate(-10deg); }
}
@keyframes guide-lower-slowly {
  0% { transform: translateY(-12px); }
  60%, 100% { transform: translateY(0); }
}
@keyframes guide-inhale {
  0% { transform: scale(0.55); opacity: 0.12; }
  65% { transform: scale(1.18); opacity: 0.9; }
  100% { transform: scale(1.18); opacity: 0.2; }
}
@keyframes guide-exhale {
  0% { transform: scale(1.15); opacity: 0.82; }
  70%, 100% { transform: scale(0.65); opacity: 0.18; }
}
@keyframes guide-stand-up {
  0% { transform: translateY(22px) scaleY(0.9); }
  58%, 100% { transform: translateY(0) scaleY(1); }
}
@keyframes guide-sit-down {
  0% { transform: translateY(0) scaleY(1); }
  60%, 100% { transform: translateY(22px) scaleY(0.9); }
}
@keyframes guide-toe-rise {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
@keyframes guide-wall-lean {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  50% { transform: translateX(15px) rotate(3deg); }
}
@keyframes guide-wall-press {
  0% { transform: translateX(15px) rotate(3deg); }
  60%, 100% { transform: translateX(0) rotate(0deg); }
}
@keyframes guide-toe-flex {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-16deg) translateY(-7px); }
}
@keyframes guide-arm-open-left {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-26deg) translate(-16px, -2px); }
}
@keyframes guide-arm-open-right {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(26deg) translate(16px, -2px); }
}
@keyframes guide-hands-return {
  0% { transform: translateX(14px); }
  65%, 100% { transform: translateX(0); }
}
@keyframes guide-side-step {
  0%, 100% { transform: translateX(0); }
  55% { transform: translateX(30px); }
}
@keyframes guide-feet-together {
  0%, 100% { transform: translateX(-22px); }
  55% { transform: translateX(0); }
}
@keyframes guide-hand-open {
  0%, 100% { transform: scale(0.96); }
  50% { transform: scale(1.03); }
}
@keyframes guide-finger-up {
  0%, 100% { transform: translate(0, 42px); }
  55% { transform: translate(0, -18px); }
}
@keyframes guide-finger-down {
  0%, 100% { transform: translate(0, -18px); }
  55% { transform: translate(0, 42px); }
}
@keyframes guide-next-finger {
  0%, 100% { transform: translate(-34px, 12px); }
  50% { transform: translate(34px, 12px); }
}
@media (prefers-reduced-motion: reduce) {
  .movement-step-animation * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

function SupportIllustration({ support }: { support: MotionSupport }) {
  if (support === "chair") {
    return (
      <g className="guide-support" stroke="#8AA6B3" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.76">
        <path d="M228 112v84" />
        <path d="M134 148h104" />
        <path d="M150 150v52" />
        <path d="M226 150v52" />
      </g>
    );
  }

  if (support === "counter") {
    return (
      <g className="guide-support" stroke="#8AA6B3" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.78">
        <path d="M218 118h88" />
        <path d="M238 120v82" />
        <path d="M292 120v82" />
      </g>
    );
  }

  if (support === "wall") {
    return (
      <g className="guide-support" fill="#D9E9EF">
        <rect x="292" y="32" width="12" height="172" rx="6" />
        <rect x="306" y="32" width="18" height="172" rx="8" opacity="0.55" />
      </g>
    );
  }

  return null;
}

function BodyMotionSvg({ profile }: { profile: MotionProfile }) {
  const isSeated = profile.posture === "seated";
  const isWall = profile.posture === "wall";
  const headX = isWall ? 154 : 178;
  const headY = isSeated ? 62 : 52;
  const shoulderY = isSeated ? 101 : 90;
  const hipY = isSeated ? 142 : 140;
  const floorY = 208;
  const leftFootX = isSeated ? 134 : isWall ? 132 : 158;
  const rightFootX = isSeated ? 212 : isWall ? 206 : 205;
  const handRightX = isWall ? 288 : 218;
  const handRightY = isWall ? 104 : 136;

  return (
    <svg viewBox="0 0 360 240" aria-hidden="true" className="h-full w-full">
      <rect x="18" y="18" width="324" height="204" rx="28" fill="white" opacity="0.72" />
      <path d="M64 208H304" stroke="#B8D3DD" strokeWidth="6" strokeLinecap="round" opacity="0.68" />
      <SupportIllustration support={profile.support} />
      <circle className="guide-breath-ring" cx={isWall ? 166 : 178} cy={isSeated ? 118 : 110} r="34" fill="none" stroke="var(--movement-accent)" strokeWidth="8" />
      <g className="guide-person" fill="none" stroke="var(--movement-accent)" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx={isWall ? 178 : 180} cy="210" rx="70" ry="10" fill="var(--movement-accent)" stroke="none" opacity="0.1" />
        <circle className="guide-head" cx={headX} cy={headY} r="20" fill="white" strokeWidth="8" />
        <path className="guide-torso" d={`M${headX} ${headY + 23} C${headX - 4} ${shoulderY + 20}, ${headX - 4} ${hipY - 20}, ${headX} ${hipY}`} strokeWidth="10" />
        <path className="guide-shoulders" d={`M${headX - 36} ${shoulderY} C${headX - 14} ${shoulderY - 8}, ${headX + 15} ${shoulderY - 8}, ${headX + 37} ${shoulderY}`} strokeWidth="9" />
        <path className="guide-left-arm" d={`M${headX - 28} ${shoulderY + 7} C${headX - 49} ${shoulderY + 25}, ${headX - 55} ${shoulderY + 47}, ${headX - 62} ${shoulderY + 62}`} strokeWidth="9" />
        <path className="guide-right-arm" d={`M${headX + 28} ${shoulderY + 7} C${headX + 48} ${shoulderY + 22}, ${handRightX - 22} ${handRightY - 8}, ${handRightX} ${handRightY}`} strokeWidth="9" />
        <path className="guide-left-leg" d={isSeated ? `M${headX - 5} ${hipY} C${headX - 32} ${hipY + 8}, ${leftFootX + 18} ${floorY - 40}, ${leftFootX} ${floorY - 18}` : `M${headX - 4} ${hipY} C${headX - 14} ${hipY + 36}, ${leftFootX + 6} ${floorY - 32}, ${leftFootX} ${floorY - 10}`} strokeWidth="10" />
        <path className="guide-right-leg" d={isSeated ? `M${headX + 8} ${hipY} C${headX + 38} ${hipY + 8}, ${rightFootX - 18} ${floorY - 40}, ${rightFootX} ${floorY - 18}` : `M${headX + 8} ${hipY} C${headX + 26} ${hipY + 38}, ${rightFootX - 5} ${floorY - 32}, ${rightFootX} ${floorY - 10}`} strokeWidth="10" />
        <path className="guide-left-foot" d={`M${leftFootX - 17} ${floorY - 8} H${leftFootX + 18}`} strokeWidth="9" />
        <path className="guide-right-foot" d={`M${rightFootX - 17} ${floorY - 8} H${rightFootX + 18}`} strokeWidth="9" />
        <circle cx={headX - 62} cy={shoulderY + 62} r="6" fill="white" strokeWidth="5" />
        <circle cx={handRightX} cy={handRightY} r="6" fill="white" strokeWidth="5" />
      </g>
    </svg>
  );
}

function HandMotionSvg() {
  return (
    <svg viewBox="0 0 360 240" aria-hidden="true" className="h-full w-full">
      <rect x="18" y="18" width="324" height="204" rx="28" fill="white" opacity="0.72" />
      <path d="M80 208H280" stroke="#B8D3DD" strokeWidth="6" strokeLinecap="round" opacity="0.56" />
      <g className="guide-hand" fill="none" stroke="var(--movement-accent)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M174 178 C152 160, 134 138, 119 116" strokeWidth="16" opacity="0.82" />
        <path d="M172 176 C165 144, 160 104, 162 67" strokeWidth="16" />
        <path d="M184 172 C190 137, 194 93, 195 54" strokeWidth="16" />
        <path d="M200 176 C218 144, 231 110, 240 76" strokeWidth="16" />
        <path d="M214 184 C239 166, 260 144, 278 118" strokeWidth="16" opacity="0.82" />
        <path d="M132 185 C158 202, 211 202, 250 186" strokeWidth="16" />
      </g>
      <path d="M194 178 C194 138, 195 99, 195 58" stroke="var(--movement-accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray="8 10" opacity="0.32" />
      <circle className="guide-trace-dot" cx="195" cy="108" r="12" fill="var(--movement-accent)" />
    </svg>
  );
}

export default function MovementStepAnimation({
  motion,
  accent,
  softBg,
  border,
  stepLabel,
  instruction,
}: MovementStepAnimationProps) {
  const profile = MOTION_PROFILES[motion];
  const style = {
    "--movement-accent": accent,
    "--movement-soft-bg": softBg,
    "--movement-border": border,
  } as CSSProperties;

  return (
    <div
      className={`movement-step-animation motion-${motion} posture-${profile.posture} overflow-hidden rounded-[24px] border`}
      style={{ ...style, background: softBg, borderColor: border }}
      data-testid="movement-exercise-step-visual"
      data-motion={motion}
      aria-label={`${stepLabel}: ${instruction}`}
    >
      <style>{MOVEMENT_STEP_ANIMATION_STYLES}</style>
      <div className="aspect-[16/9] min-h-[158px] w-full sm:min-h-[245px]">
        {profile.posture === "hand" ? <HandMotionSvg /> : <BodyMotionSvg profile={profile} />}
      </div>
      <div className="grid gap-2 border-t px-4 py-3 sm:grid-cols-[auto_1fr] sm:items-center" style={{ borderColor: border }}>
        <span
          className="inline-flex w-fit rounded-full px-3 py-1.5 font-body text-[13px] font-black leading-tight"
          style={{ background: "#FFFFFF", color: accent }}
        >
          {stepLabel}
        </span>
        <span className="font-body text-[15px] font-black leading-snug text-[#123047] sm:text-[16px]">
          {instruction}
        </span>
      </div>
    </div>
  );
}
