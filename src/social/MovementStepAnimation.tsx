import type { CSSProperties } from "react";
import type { MovementStepMotion } from "./movementExercises";

type MovementStepAnimationProps = {
  motion: MovementStepMotion;
  image: string;
  imageAlt: string;
  accent: string;
  softBg: string;
  border: string;
  stepLabel: string;
  instruction: string;
};

export default function MovementStepAnimation({
  motion,
  image,
  imageAlt,
  accent,
  softBg,
  border,
  stepLabel,
  instruction,
}: MovementStepAnimationProps) {
  const style = {
    "--movement-accent": accent,
    "--movement-soft-bg": softBg,
    "--movement-border": border,
  } as CSSProperties;

  return (
    <div
      className={`movement-step-animation motion-${motion} overflow-hidden rounded-[24px] border bg-white`}
      style={{ ...style, borderColor: border }}
      data-testid="movement-exercise-step-visual"
      data-motion={motion}
      aria-label={`${stepLabel}: ${instruction}`}
    >
      <div className="relative h-[250px] w-full overflow-hidden bg-[#EEF7F9] sm:h-[360px] lg:h-[420px]">
        <img
          key={image}
          src={image}
          alt={imageAlt}
          className="absolute inset-0 h-full w-full object-contain"
          data-testid="movement-exercise-step-image"
          draggable={false}
        />
      </div>
      <div className="border-t px-4 py-3" style={{ background: softBg, borderColor: border }}>
        <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
          <span
            className="inline-flex w-fit rounded-full bg-white px-3 py-1.5 font-body text-[13px] font-black leading-tight"
            style={{ color: accent }}
          >
            {stepLabel}
          </span>
          <span
            className="font-body text-[15px] font-black leading-snug text-[#123047] sm:text-[16px]"
            data-testid="movement-exercise-guide-step"
            aria-live="polite"
          >
            <span className="sr-only">{stepLabel}: </span>
            {instruction}
          </span>
        </div>
      </div>
    </div>
  );
}
