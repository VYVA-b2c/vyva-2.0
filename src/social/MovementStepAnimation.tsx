import { useEffect, useRef, type CSSProperties } from "react";
import type { MovementStepMotion } from "./movementExercises";

type MovementStepAnimationProps = {
  motion: MovementStepMotion;
  image: string;
  imageAlt: string;
  video?: string;
  accent: string;
  softBg: string;
  border: string;
  stepLabel: string;
  instruction: string;
  isGuiding?: boolean;
  playbackMode?: "silent-loop" | "narrated-once";
};

function requestVideoPlayback(videoElement: HTMLVideoElement | null, playbackMode: "silent-loop" | "narrated-once") {
  if (!videoElement) return;
  videoElement.muted = playbackMode === "silent-loop";
  videoElement.playsInline = true;
  try {
    const playResult = videoElement.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => {
        // The poster remains visible if the browser blocks autoplay.
      });
    }
  } catch {
    // Some test/browser environments expose play() but do not implement it.
  }
}

export default function MovementStepAnimation({
  motion,
  image,
  imageAlt,
  video,
  accent,
  softBg,
  border,
  stepLabel,
  instruction,
  isGuiding = false,
  playbackMode = "silent-loop",
}: MovementStepAnimationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const style = {
    "--movement-accent": accent,
    "--movement-soft-bg": softBg,
    "--movement-border": border,
  } as CSSProperties;

  useEffect(() => {
    if (!video) return;
    requestVideoPlayback(videoRef.current, playbackMode);
  }, [playbackMode, video]);

  useEffect(() => {
    if (playbackMode !== "narrated-once" || !videoRef.current) return;
    if (isGuiding) {
      requestVideoPlayback(videoRef.current, playbackMode);
    } else {
      videoRef.current.pause();
    }
  }, [isGuiding, playbackMode]);

  return (
    <div
      className={`movement-step-animation motion-${motion} overflow-hidden rounded-[22px] border bg-white shadow-[0_16px_34px_rgba(18,48,71,0.08)] ${isGuiding ? "movement-guide-portrait-live" : ""}`}
      style={{ ...style, borderColor: border }}
      data-testid="movement-exercise-step-visual"
      data-motion={motion}
      aria-label={`${stepLabel}: ${instruction}`}
    >
      <div
        className="relative aspect-video w-full overflow-hidden bg-[#EEF7F9] sm:aspect-auto sm:h-[460px] lg:h-[500px]"
        data-testid="movement-exercise-step-media-frame"
      >
        {video ? (
          <video
            ref={videoRef}
            key={video}
            src={video}
            poster={image}
            aria-label={imageAlt}
            className="movement-guide-portrait-image movement-guide-step-video absolute inset-0 h-full w-full object-contain"
            data-testid="movement-exercise-step-video"
            autoPlay
            loop={playbackMode === "silent-loop"}
            muted={playbackMode === "silent-loop"}
            playsInline
            preload="metadata"
            disablePictureInPicture
            data-playback-mode={playbackMode}
            onCanPlay={() => requestVideoPlayback(videoRef.current, playbackMode)}
          />
        ) : (
          <img
            key={image}
            src={image}
            alt={imageAlt}
            className="movement-guide-portrait-image movement-guide-step-image absolute inset-0 h-full w-full object-contain"
            data-testid="movement-exercise-step-image"
            data-animated={isGuiding ? "true" : undefined}
            draggable={false}
          />
        )}
      </div>
      <div className="border-t px-4 py-4 sm:px-6 sm:py-5" style={{ background: softBg, borderColor: border }}>
        <div className="grid gap-3">
          <span
            className="inline-flex w-fit rounded-full bg-white px-3 py-1.5 font-body text-[13px] font-black leading-tight"
            style={{ color: accent }}
          >
            {stepLabel}
          </span>
          <span
            className="font-body text-[24px] font-black leading-tight text-[#123047] sm:text-[32px]"
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
