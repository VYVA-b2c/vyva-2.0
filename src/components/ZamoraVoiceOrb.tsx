import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { VoiceSessionPhase } from "@/lib/voiceSessionState";

export type ZamoraOrbState = "idle" | "listening" | "speaking";

type BlobConfig = {
  r: number;
  spd: number;
  ox: number;
  oy: number;
  ph: number;
  c: number[];
  po: number;
  a: number;
};

type OrbConfig = {
  blobs: BlobConfig[];
  bgi: number[];
  bgo: number[];
  rim: number[];
  rim2: number[];
  rimA: number;
  pAmt: number;
  pSpd: number;
  shA: number;
  ringCol: string;
  ringDur: number;
  ringOp: number[];
  scale: number;
};

type ZamoraVoiceOrbProps = {
  state: ZamoraOrbState;
  size?: number;
  isDark?: boolean;
  audioLevel?: number;
  testId?: string;
};

type VoiceOrbAudioLevelOptions = {
  enabled: boolean;
  phase?: VoiceSessionPhase;
  isSpeaking?: boolean;
  isMicMuted?: boolean;
  isConnecting?: boolean;
  preferLiveMic?: boolean;
};

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

const BASE_CANVAS_SIZE = 112;
const BASE_CONTAINER_SIZE = 188;
const BASE_RING_SIZES = [188, 158, 128] as const;
const IDLE_RING_OPACITY = {
  dark: [0.08, 0.13, 0.2],
  light: [0.07, 0.11, 0.17],
};

const ORB_STATES: Record<ZamoraOrbState, OrbConfig> = {
  idle: {
    blobs: [
      { r: 58, spd: 0.00045, ox: 18, oy: 14, ph: 0, c: [183, 148, 246], po: 0, a: 0.46 },
      { r: 48, spd: 0.00068, ox: 22, oy: 16, ph: 2.1, c: [244, 114, 182], po: 1.2, a: 0.3 },
      { r: 42, spd: 0.00058, ox: 16, oy: 18, ph: 4.2, c: [221, 214, 254], po: 2.4, a: 0.38 },
      { r: 30, spd: 0.00076, ox: 22, oy: 16, ph: 1, c: [125, 211, 252], po: 0.6, a: 0.22 },
      { r: 26, spd: 0.00088, ox: 18, oy: 20, ph: 3.5, c: [253, 186, 116], po: 1.8, a: 0.2 },
      { r: 38, spd: 0.0005, ox: 14, oy: 12, ph: 5.1, c: [167, 139, 250], po: 3, a: 0.38 },
      { r: 24, spd: 0.00092, ox: 20, oy: 18, ph: 1.2, c: [251, 207, 232], po: 0.3, a: 0.26 },
      { r: 82, spd: 0.00018, ox: 6, oy: 5, ph: 2.4, c: [88, 28, 135], po: 4, a: 0.24 },
    ],
    bgi: [128, 92, 224],
    bgo: [62, 31, 118],
    rim: [221, 214, 254],
    rim2: [251, 207, 232],
    rimA: 0.2,
    pAmt: 0.09,
    pSpd: 0.0013,
    shA: 0.34,
    ringCol: "#DDD6FE",
    ringDur: 3.8,
    ringOp: [0.08, 0.13, 0.2],
    scale: 1,
  },
  listening: {
    blobs: [
      { r: 64, spd: 0.00085, ox: 9, oy: 8, ph: 0, c: [183, 148, 246], po: 0, a: 0.46 },
      { r: 52, spd: 0.00108, ox: 13, oy: 12, ph: 1.2, c: [216, 180, 254], po: 0.8, a: 0.38 },
      { r: 44, spd: 0.00095, ox: 18, oy: 14, ph: 2.8, c: [244, 114, 182], po: 1.6, a: 0.28 },
      { r: 34, spd: 0.00118, ox: 22, oy: 17, ph: 4, c: [221, 214, 254], po: 2.4, a: 0.36 },
      { r: 28, spd: 0.00102, ox: 16, oy: 20, ph: 5.2, c: [253, 186, 116], po: 3.2, a: 0.2 },
      { r: 50, spd: 0.0007, ox: 10, oy: 9, ph: 3.6, c: [167, 139, 250], po: 0.4, a: 0.36 },
      { r: 22, spd: 0.00135, ox: 22, oy: 12, ph: 1, c: [125, 211, 252], po: 1.2, a: 0.22 },
      { r: 68, spd: 0.00042, ox: 5, oy: 6, ph: 5.2, c: [96, 52, 160], po: 4.4, a: 0.24 },
    ],
    bgi: [148, 108, 232],
    bgo: [76, 38, 146],
    rim: [221, 214, 254],
    rim2: [244, 114, 182],
    rimA: 0.24,
    pAmt: 0.12,
    pSpd: 0.002,
    shA: 0.36,
    ringCol: "#DDD6FE",
    ringDur: 1.9,
    ringOp: [0.1, 0.16, 0.24],
    scale: 1.01,
  },
  speaking: {
    blobs: [
      { r: 70, spd: 0.00072, ox: 8, oy: 6, ph: 0, c: [244, 114, 182], po: 0, a: 0.42 },
      { r: 56, spd: 0.00098, ox: 14, oy: 11, ph: 1.5, c: [251, 207, 232], po: 0.7, a: 0.34 },
      { r: 46, spd: 0.00088, ox: 20, oy: 15, ph: 3, c: [253, 186, 116], po: 1.4, a: 0.22 },
      { r: 38, spd: 0.00108, ox: 23, oy: 14, ph: 4.5, c: [221, 214, 254], po: 2.1, a: 0.36 },
      { r: 30, spd: 0.00094, ox: 17, oy: 21, ph: 6, c: [216, 180, 254], po: 2.8, a: 0.34 },
      { r: 52, spd: 0.00062, ox: 12, oy: 9, ph: 2, c: [192, 132, 252], po: 0.3, a: 0.34 },
      { r: 24, spd: 0.0012, ox: 20, oy: 17, ph: 1, c: [255, 228, 230], po: 1, a: 0.34 },
      { r: 82, spd: 0.0002, ox: 5, oy: 4, ph: 3, c: [96, 52, 160], po: 5, a: 0.22 },
    ],
    bgi: [170, 106, 226],
    bgo: [86, 38, 154],
    rim: [251, 207, 232],
    rim2: [253, 186, 116],
    rimA: 0.28,
    pAmt: 0.16,
    pSpd: 0.0028,
    shA: 0.4,
    ringCol: "#F0ABFC",
    ringDur: 1.45,
    ringOp: [0.14, 0.23, 0.34],
    scale: 1.035,
  },
};

const LIGHT_BG: Record<ZamoraOrbState, Pick<OrbConfig, "bgi" | "bgo">> = {
  idle: { bgi: [226, 205, 255], bgo: [184, 148, 238] },
  listening: { bgi: [232, 213, 255], bgo: [190, 151, 244] },
  speaking: { bgi: [255, 229, 183], bgo: [224, 164, 62] },
};

function clampLevel(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function useLiveMicrophoneLevel(enabled: boolean) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLevel(0);
      return;
    }

    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setLevel(0);
      return;
    }

    let didCancel = false;
    let frameId = 0;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    const samples = new Uint8Array(128);

    const stop = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((track) => track.stop());
      void audioContext?.close().catch(() => {});
      stream = null;
      audioContext = null;
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (didCancel) {
          stop();
          return;
        }

        const AudioContextCtor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
        if (!AudioContextCtor) {
          setLevel(0);
          return;
        }

        audioContext = new AudioContextCtor();
        await audioContext.resume().catch(() => {});
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.78;
        source.connect(analyser);

        const tick = () => {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (let index = 0; index < samples.length; index += 1) {
            const centered = (samples[index] - 128) / 128;
            sum += centered * centered;
          }

          const rms = Math.sqrt(sum / samples.length);
          const normalized = clampLevel((rms - 0.012) * 8.5);
          setLevel((current) => current * 0.7 + normalized * 0.3);
          frameId = window.requestAnimationFrame(tick);
        };

        tick();
      } catch {
        setLevel(0);
      }
    };

    void start();

    return () => {
      didCancel = true;
      stop();
    };
  }, [enabled]);

  return level;
}

function useSyntheticSpeechLevel(enabled: boolean, phase: VoiceSessionPhase | undefined) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLevel(0);
      return;
    }

    let frameId = 0;
    const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

    const tick = (time: number) => {
      const elapsed = time - startTime;
      const syllable =
        Math.max(0, Math.sin(elapsed * 0.012)) * 0.5 +
        Math.max(0, Math.sin(elapsed * 0.021 + 1.8)) * 0.32 +
        Math.max(0, Math.sin(elapsed * 0.034 + 0.6)) * 0.18;
      const breath = (Math.sin(elapsed * 0.0034) + 1) * 0.5;
      const isConnecting = phase === "connecting" || phase === "transferring";
      const base = isConnecting ? 0.08 : 0.14;
      const intensity = isConnecting ? 0.2 : 0.48;
      setLevel(clampLevel(base + syllable * intensity + breath * 0.12));
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [enabled, phase]);

  return level;
}

export function useVoiceOrbAudioLevel({
  enabled,
  phase,
  isSpeaking = false,
  isMicMuted = false,
  isConnecting = false,
  preferLiveMic = true,
}: VoiceOrbAudioLevelOptions) {
  const shouldUseLiveMic = enabled && preferLiveMic && phase === "listening" && !isSpeaking && !isMicMuted;
  const shouldUseSynthetic = enabled && (
    isSpeaking ||
    isConnecting ||
    phase === "speaking" ||
    phase === "connecting" ||
    phase === "transferring"
  );
  const liveLevel = useLiveMicrophoneLevel(shouldUseLiveMic);
  const syntheticLevel = useSyntheticSpeechLevel(shouldUseSynthetic, phase);

  if (!enabled || isMicMuted || phase === "idle" || phase === "ended" || phase === "error") return 0;
  if (shouldUseLiveMic) return liveLevel;
  if (shouldUseSynthetic) return syntheticLevel;
  return 0.08;
}

function drawFrame(ts: number, b: OrbConfig, ctx: CanvasRenderingContext2D, width: number, height: number, audioLevel = 0) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = width / 2;
  const level = clampLevel(audioLevel);
  const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const mix = (a: number[], c: number[], t: number) => [
    a[0] * (1 - t) + c[0] * t,
    a[1] * (1 - t) + c[1] * t,
    a[2] * (1 - t) + c[2] * t,
  ];

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  const bg = ctx.createRadialGradient(cx - radius * 0.12, cy - radius * 0.18, 4, cx, cy, radius);
  bg.addColorStop(0, rgba(b.bgi, 1));
  bg.addColorStop(0.48, rgba(b.bgi.map((v, i) => (v * (1.35 + level * 0.28) + b.bgo[i]) / (2.35 + level * 0.28)), 1));
  bg.addColorStop(1, rgba(b.bgo, 1));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const body = ctx.createRadialGradient(cx - radius * 0.16, cy - radius * 0.2, 3, cx, cy, radius);
  body.addColorStop(0, rgba([255, 255, 255], Math.min(0.72, Math.max(0.26, b.shA * 0.85 + level * 0.16))));
  body.addColorStop(0.28, rgba(b.bgi, 0.96));
  body.addColorStop(0.72, rgba(mix(b.bgi, b.rim, 0.2), 0.96));
  body.addColorStop(1, rgba(mix(b.bgo, b.rim2, 0.1), 0.98));
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  const anchor = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.78);
  anchor.addColorStop(0, rgba(mix(b.bgi, b.rim, 0.45), 0.18 + level * 0.1));
  anchor.addColorStop(0.42, rgba(mix(b.bgi, b.rim, 0.28), 0.12 + level * 0.08));
  anchor.addColorStop(1, rgba(b.bgo, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = anchor;
  ctx.fill();

  b.blobs.forEach((blob) => {
    const angle = ts * blob.spd + blob.ph;
    const angle2 = ts * blob.spd * 0.61 + blob.ph * 1.3;
    const speechBeat = Math.sin(ts * (b.pSpd * 3.2 + 0.006) + blob.po * 1.7);
    const pulse = 1 + (b.pAmt + level * 0.12) * Math.sin(ts * b.pSpd + blob.po) + Math.max(0, speechBeat) * level * 0.045;
    const blobRadius = blob.r * pulse * (1 + level * (blob.po % 2 > 1 ? 0.045 : 0.075));
    const rawBx = cx + (Math.cos(angle) * blob.ox + Math.cos(angle2) * blob.ox * 0.3) * 0.42;
    const rawBy = cy + (Math.sin(angle * 0.71) * blob.oy + Math.sin(angle2 * 0.5) * blob.oy * 0.3) * 0.42;
    const dx = rawBx - cx;
    const dy = rawBy - cy;
    const distance = Math.hypot(dx, dy);
    const safeDistance = Math.min(Math.max(0, radius - blobRadius * 0.72 - 3), radius * 0.24);
    const safeScale = distance > safeDistance && distance > 0 ? safeDistance / distance : 1;
    const bx = cx + dx * safeScale;
    const by = cy + dy * safeScale;
    const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, blobRadius);
    const activeAlpha = Math.min(0.92, blob.a * (1 + level * 0.28));
    gradient.addColorStop(0, rgba(blob.c, activeAlpha * 0.82));
    gradient.addColorStop(0.35, rgba(blob.c, activeAlpha * 0.45));
    gradient.addColorStop(0.72, rgba(blob.c, activeAlpha * 0.14));
    gradient.addColorStop(1, rgba(blob.c, 0));
    ctx.beginPath();
    ctx.arc(bx, by, blobRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  });

  const shineX = cx - radius * 0.22 + Math.cos(ts * 0.00028) * 6;
  const shineY = cy - radius * 0.24 + Math.sin(ts * 0.00022) * 5;
  const shine = ctx.createRadialGradient(shineX, shineY, 0, shineX, shineY, radius * 0.4);
  shine.addColorStop(0, rgba([255, 255, 255], Math.min(0.72, b.shA * 0.75 + level * 0.16)));
  shine.addColorStop(1, rgba([255, 255, 255], 0));
  ctx.beginPath();
  ctx.arc(shineX, shineY, radius * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = shine;
  ctx.fill();

  if (level > 0.02) {
    const liveAura = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
    liveAura.addColorStop(0, rgba(mix(b.rim, b.rim2, 0.36), 0));
    liveAura.addColorStop(0.42, rgba(mix(b.rim, b.rim2, 0.48), level * 0.08));
    liveAura.addColorStop(0.82, rgba(mix(b.rim2, [125, 211, 252], 0.35), level * 0.18));
    liveAura.addColorStop(1, rgba(mix(b.rim2, [125, 211, 252], 0.45), level * 0.1));
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = liveAura;
    ctx.fill();
  }

  const rim = ctx.createRadialGradient(cx, cy, radius * 0.52, cx, cy, radius);
  rim.addColorStop(0, rgba(b.rim, 0));
  rim.addColorStop(0.72, rgba(b.rim, b.rimA * (0.08 + level * 0.04)));
  rim.addColorStop(0.9, rgba(b.rim, b.rimA * (0.18 + level * 0.06)));
  rim.addColorStop(1, rgba(b.rim2, b.rimA * (0.28 + level * 0.08)));
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();

  const vignette = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
  vignette.addColorStop(0, rgba([0, 0, 0], 0));
  vignette.addColorStop(0.75, rgba([0, 0, 0], 0));
  vignette.addColorStop(1, rgba([0, 0, 0], 0.14));
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = vignette;
  ctx.fill();
  ctx.restore();
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpColor(a: number[], b: number[], t: number) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function blendBlob(a: BlobConfig, b: BlobConfig, t: number): BlobConfig {
  return {
    r: lerp(a.r, b.r, t),
    spd: lerp(a.spd, b.spd, t),
    ox: lerp(a.ox, b.ox, t),
    oy: lerp(a.oy, b.oy, t),
    ph: lerp(a.ph, b.ph, t),
    c: lerpColor(a.c, b.c, t),
    po: lerp(a.po, b.po, t),
    a: lerp(a.a, b.a, t),
  };
}

function blendConfig(a: OrbConfig, b: OrbConfig, t: number): OrbConfig {
  return {
    blobs: a.blobs.map((blob, index) => blendBlob(blob, b.blobs[index], t)),
    bgi: lerpColor(a.bgi, b.bgi, t),
    bgo: lerpColor(a.bgo, b.bgo, t),
    rim: lerpColor(a.rim, b.rim, t),
    rim2: lerpColor(a.rim2, b.rim2, t),
    rimA: lerp(a.rimA, b.rimA, t),
    pAmt: lerp(a.pAmt, b.pAmt, t),
    pSpd: lerp(a.pSpd, b.pSpd, t),
    shA: lerp(a.shA, b.shA, t),
    ringCol: b.ringCol,
    ringDur: lerp(a.ringDur, b.ringDur, t),
    ringOp: a.ringOp.map((op, index) => lerp(op, b.ringOp[index], t)),
    scale: lerp(a.scale, b.scale, t),
  };
}

function cloneConfig(config: OrbConfig): OrbConfig {
  return {
    ...config,
    blobs: config.blobs.map((blob) => ({ ...blob, c: [...blob.c] })),
    bgi: [...config.bgi],
    bgo: [...config.bgo],
    rim: [...config.rim],
    rim2: [...config.rim2],
    ringOp: [...config.ringOp],
  };
}

function resolveConfig(state: ZamoraOrbState, isDark: boolean) {
  const base = cloneConfig(ORB_STATES[state]);
  if (state === "idle") {
    base.ringCol = isDark ? "#7C3AED" : "#9333EA";
    base.ringOp = [...IDLE_RING_OPACITY[isDark ? "dark" : "light"]];
  }
  if (!isDark) {
    base.bgi = [...LIGHT_BG[state].bgi];
    base.bgo = [...LIGHT_BG[state].bgo];
    base.rimA = Math.min(base.rimA + 0.1, 0.72);
    base.shA = Math.max(base.shA, 0.24);
  }
  return base;
}

export default function ZamoraVoiceOrb({
  state,
  size = BASE_CONTAINER_SIZE,
  isDark = true,
  audioLevel = 0,
  testId = "zamora-voice-orb",
}: ZamoraVoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const canvasSizeRef = useRef<number>(BASE_CANVAS_SIZE);
  const audioLevelRef = useRef(clampLevel(audioLevel));
  const currentRef = useRef<OrbConfig>(resolveConfig(state, isDark));
  const fromRef = useRef<OrbConfig>(resolveConfig(state, isDark));
  const toRef = useRef<OrbConfig>(resolveConfig(state, isDark));
  const transitionStartRef = useRef<number>(0);
  const visualConfig = useMemo(() => resolveConfig(state, isDark), [isDark, state]);
  const safeAudioLevel = clampLevel(audioLevel);
  const liveScale = visualConfig.scale + safeAudioLevel * (state === "idle" ? 0.025 : state === "listening" ? 0.075 : 0.095);
  const ringDuration = Math.max(0.92, visualConfig.ringDur - safeAudioLevel * 0.46);

  const canvasDisplaySize = Math.round(size * (BASE_CANVAS_SIZE / BASE_CONTAINER_SIZE));
  const ringSizes = BASE_RING_SIZES.map((ringSize) => Math.round(size * (ringSize / BASE_CONTAINER_SIZE)));
  const ringOpacities = visualConfig.ringOp.map((opacity, index) => Math.min(0.58, opacity + safeAudioLevel * (0.06 + index * 0.045)));

  useEffect(() => {
    audioLevelRef.current = safeAudioLevel;
  }, [safeAudioLevel]);

  useEffect(() => {
    fromRef.current = cloneConfig(currentRef.current);
    toRef.current = visualConfig;
    transitionStartRef.current = performance.now();
  }, [visualConfig]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const nextSize = Math.max(1, Math.round(Math.min(rect.width, rect.height) || BASE_CANVAS_SIZE));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = nextSize * dpr;
      canvas.height = nextSize * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvasSizeRef.current = nextSize;
    };

    resizeCanvas();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(resizeCanvas);
      observer.observe(canvas);
    } else {
      window.addEventListener("resize", resizeCanvas);
    }

    const prefersReducedMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const render = (ts: number) => {
      const frameTime = prefersReducedMotion ? 1200 : ts;
      const progress = prefersReducedMotion ? 1 : Math.min((ts - transitionStartRef.current) / 700, 1);
      const eased = easeInOut(Math.max(progress, 0));
      const blended = blendConfig(fromRef.current, toRef.current, eased);
      currentRef.current = blended;
      const currentSize = canvasSizeRef.current || BASE_CANVAS_SIZE;
      drawFrame(frameTime, blended, ctx, currentSize, currentSize, audioLevelRef.current);
      frameRef.current = window.requestAnimationFrame(render);
    };

    frameRef.current = window.requestAnimationFrame(render);

    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <div
      data-testid={testId}
      data-orb-state={state}
      data-audio-reactive={safeAudioLevel > 0.02 ? "true" : "false"}
      aria-hidden="true"
      style={
        {
          position: "relative",
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          "--orb-scale": liveScale,
        } as CSSProperties
      }
    >
      {ringSizes.map((ringSize, index) => {
        const ringOpacity = ringOpacities[index];
        return (
        <span
          key={`${ringSize}-${index}`}
          style={
            {
              position: "absolute",
              width: ringSize,
              height: ringSize,
              borderRadius: 999,
              border: `1px solid ${visualConfig.ringCol}`,
              opacity: ringOpacity,
              animationName: "zamoraRingPulse",
              animationDuration: `${ringDuration}s`,
              animationTimingFunction: "ease-in-out",
              animationIterationCount: "infinite",
              animationDelay: `${index * 0.35}s`,
              "--base-opacity": ringOpacity,
              pointerEvents: "none",
            } as CSSProperties
          }
        />
        );
      })}
      <canvas
        ref={canvasRef}
        data-testid={`${testId}-canvas`}
        style={{
          position: "relative",
          zIndex: 1,
          width: canvasDisplaySize,
          height: canvasDisplaySize,
          borderRadius: 999,
          boxShadow: `0 18px 48px -18px rgba(221,214,254,0.76), 0 0 ${30 + safeAudioLevel * 26}px rgba(244,114,182,${0.14 + safeAudioLevel * 0.12}), 0 0 ${18 + safeAudioLevel * 28}px rgba(20,184,166,${safeAudioLevel * 0.14})`,
          animation: "zamoraOrbFloat 5.6s ease-in-out infinite",
          transformOrigin: "center",
        }}
      />
      <style>
        {`
          @keyframes zamoraRingPulse {
            0%, 100% { transform: scale(1); opacity: var(--base-opacity); }
            50% { transform: scale(1.015); opacity: calc(var(--base-opacity) * 1.35); }
          }
          @keyframes zamoraOrbFloat {
            0%, 100% { transform: scale(var(--orb-scale)) translateY(0px); }
            50% { transform: scale(var(--orb-scale)) translateY(-2px); }
          }
          @media (prefers-reduced-motion: reduce) {
            [data-testid="${testId}"] span,
            [data-testid="${testId}-canvas"] {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
            }
          }
        `}
      </style>
    </div>
  );
}
