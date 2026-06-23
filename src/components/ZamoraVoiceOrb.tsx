import { useEffect, useMemo, useRef, type CSSProperties } from "react";

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
  testId?: string;
};

const BASE_CANVAS_SIZE = 112;
const BASE_CONTAINER_SIZE = 188;
const BASE_RING_SIZES = [188, 158, 128] as const;
const IDLE_RING_OPACITY = {
  dark: [0.18, 0.35, 0.55],
  light: [0.12, 0.22, 0.38],
};

const ORB_STATES: Record<ZamoraOrbState, OrbConfig> = {
  idle: {
    blobs: [
      { r: 54, spd: 0.00055, ox: 22, oy: 16, ph: 0, c: [107, 33, 168], po: 0, a: 0.55 },
      { r: 44, spd: 0.00085, ox: 28, oy: 20, ph: 2.1, c: [139, 92, 246], po: 1.2, a: 0.5 },
      { r: 38, spd: 0.0007, ox: 18, oy: 22, ph: 4.2, c: [192, 132, 252], po: 2.4, a: 0.45 },
      { r: 30, spd: 0.001, ox: 30, oy: 18, ph: 1, c: [245, 158, 11], po: 0.6, a: 0.5 },
      { r: 24, spd: 0.00115, ox: 24, oy: 26, ph: 3.5, c: [139, 92, 246], po: 1.8, a: 0.4 },
      { r: 36, spd: 0.00065, ox: 16, oy: 14, ph: 5.1, c: [107, 33, 168], po: 3, a: 0.55 },
      { r: 20, spd: 0.0016, ox: 26, oy: 22, ph: 1.2, c: [245, 158, 11], po: 0.3, a: 0.45 },
      { r: 80, spd: 0.00025, ox: 8, oy: 6, ph: 2.4, c: [40, 10, 90], po: 4, a: 0.6 },
    ],
    bgi: [18, 6, 38],
    bgo: [6, 2, 16],
    rim: [139, 92, 246],
    rim2: [245, 158, 11],
    rimA: 0.38,
    pAmt: 0.14,
    pSpd: 0.0018,
    shA: 0.15,
    ringCol: "#7C3AED",
    ringDur: 3.2,
    ringOp: [0.18, 0.35, 0.55],
    scale: 1,
  },
  listening: {
    blobs: [
      { r: 62, spd: 0.0013, ox: 10, oy: 8, ph: 0, c: [107, 33, 168], po: 0, a: 0.55 },
      { r: 50, spd: 0.0019, ox: 16, oy: 14, ph: 1.2, c: [168, 85, 247], po: 0.8, a: 0.5 },
      { r: 42, spd: 0.0015, ox: 24, oy: 18, ph: 2.8, c: [124, 58, 237], po: 1.6, a: 0.48 },
      { r: 32, spd: 0.0021, ox: 30, oy: 22, ph: 4, c: [216, 180, 254], po: 2.4, a: 0.44 },
      { r: 26, spd: 0.0017, ox: 20, oy: 26, ph: 5.2, c: [245, 158, 11], po: 3.2, a: 0.36 },
      { r: 48, spd: 0.00105, ox: 12, oy: 10, ph: 3.6, c: [139, 92, 246], po: 0.4, a: 0.5 },
      { r: 18, spd: 0.0024, ox: 30, oy: 14, ph: 1, c: [251, 191, 36], po: 1.2, a: 0.46 },
      { r: 62, spd: 0.0007, ox: 6, oy: 8, ph: 5.2, c: [62, 18, 118], po: 4.4, a: 0.52 },
    ],
    bgi: [24, 8, 48],
    bgo: [8, 4, 20],
    rim: [168, 85, 247],
    rim2: [245, 158, 11],
    rimA: 0.48,
    pAmt: 0.2,
    pSpd: 0.003,
    shA: 0.22,
    ringCol: "#A855F7",
    ringDur: 1.1,
    ringOp: [0.24, 0.42, 0.62],
    scale: 1.02,
  },
  speaking: {
    blobs: [
      { r: 70, spd: 0.00095, ox: 8, oy: 6, ph: 0, c: [245, 158, 11], po: 0, a: 0.6 },
      { r: 56, spd: 0.00145, ox: 18, oy: 12, ph: 1.5, c: [251, 191, 36], po: 0.7, a: 0.55 },
      { r: 46, spd: 0.00115, ox: 26, oy: 20, ph: 3, c: [180, 83, 9], po: 1.4, a: 0.52 },
      { r: 36, spd: 0.00175, ox: 32, oy: 16, ph: 4.5, c: [252, 211, 77], po: 2.1, a: 0.5 },
      { r: 28, spd: 0.00135, ox: 22, oy: 28, ph: 6, c: [245, 158, 11], po: 2.8, a: 0.48 },
      { r: 52, spd: 0.00085, ox: 14, oy: 10, ph: 2, c: [251, 191, 36], po: 0.3, a: 0.55 },
      { r: 22, spd: 0.002, ox: 26, oy: 22, ph: 1, c: [255, 220, 80], po: 1, a: 0.65 },
      { r: 84, spd: 0.00022, ox: 6, oy: 4, ph: 3, c: [120, 40, 0], po: 5, a: 0.58 },
    ],
    bgi: [22, 10, 2],
    bgo: [8, 4, 1],
    rim: [245, 158, 11],
    rim2: [255, 220, 80],
    rimA: 0.52,
    pAmt: 0.3,
    pSpd: 0.0048,
    shA: 0.26,
    ringCol: "#B45309",
    ringDur: 0.75,
    ringOp: [0.3, 0.52, 0.76],
    scale: 1.08,
  },
};

const LIGHT_BG: Record<ZamoraOrbState, Pick<OrbConfig, "bgi" | "bgo">> = {
  idle: { bgi: [226, 205, 255], bgo: [184, 148, 238] },
  listening: { bgi: [232, 213, 255], bgo: [190, 151, 244] },
  speaking: { bgi: [255, 229, 183], bgo: [224, 164, 62] },
};

function drawFrame(ts: number, b: OrbConfig, ctx: CanvasRenderingContext2D, width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = width / 2;
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

  const bg = ctx.createRadialGradient(cx, cy - 20, 4, cx, cy, radius);
  bg.addColorStop(0, rgba(b.bgi, 1));
  bg.addColorStop(0.45, rgba(b.bgi.map((v, i) => (v * 1.3 + b.bgo[i]) / 2), 1));
  bg.addColorStop(1, rgba(b.bgo, 1));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const body = ctx.createRadialGradient(cx - radius * 0.16, cy - radius * 0.2, 3, cx, cy, radius);
  body.addColorStop(0, rgba([255, 255, 255], Math.max(0.24, b.shA)));
  body.addColorStop(0.22, rgba(b.bgi, 0.98));
  body.addColorStop(0.68, rgba(mix(b.bgi, b.rim, 0.3), 0.98));
  body.addColorStop(1, rgba(mix(b.bgo, b.rim2, 0.18), 1));
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  const anchor = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.78);
  anchor.addColorStop(0, rgba(mix(b.bgi, b.rim, 0.45), 0.34));
  anchor.addColorStop(0.42, rgba(mix(b.bgi, b.rim, 0.28), 0.22));
  anchor.addColorStop(1, rgba(b.bgo, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = anchor;
  ctx.fill();

  b.blobs.forEach((blob) => {
    const angle = ts * blob.spd + blob.ph;
    const angle2 = ts * blob.spd * 0.61 + blob.ph * 1.3;
    const pulse = 1 + b.pAmt * Math.sin(ts * b.pSpd + blob.po);
    const blobRadius = blob.r * pulse;
    const rawBx = cx + (Math.cos(angle) * blob.ox + Math.cos(angle2) * blob.ox * 0.3) * 0.58;
    const rawBy = cy + (Math.sin(angle * 0.71) * blob.oy + Math.sin(angle2 * 0.5) * blob.oy * 0.3) * 0.58;
    const dx = rawBx - cx;
    const dy = rawBy - cy;
    const distance = Math.hypot(dx, dy);
    const safeDistance = Math.min(Math.max(0, radius - blobRadius * 0.68 - 3), radius * 0.3);
    const safeScale = distance > safeDistance && distance > 0 ? safeDistance / distance : 1;
    const bx = cx + dx * safeScale;
    const by = cy + dy * safeScale;
    const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, blobRadius);
    gradient.addColorStop(0, rgba(blob.c, blob.a));
    gradient.addColorStop(0.25, rgba(blob.c, blob.a * 0.7));
    gradient.addColorStop(0.6, rgba(blob.c, blob.a * 0.25));
    gradient.addColorStop(1, rgba(blob.c, 0));
    ctx.beginPath();
    ctx.arc(bx, by, blobRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  });

  const shineX = cx + Math.cos(ts * 0.00045) * 20;
  const shineY = cy - 30 + Math.sin(ts * 0.00032) * 14;
  const shine = ctx.createRadialGradient(shineX, shineY, 0, shineX, shineY, 42);
  shine.addColorStop(0, rgba([255, 255, 255], b.shA));
  shine.addColorStop(1, rgba([255, 255, 255], 0));
  ctx.beginPath();
  ctx.arc(shineX, shineY, 42, 0, Math.PI * 2);
  ctx.fillStyle = shine;
  ctx.fill();

  const rim = ctx.createRadialGradient(cx, cy, radius * 0.52, cx, cy, radius);
  rim.addColorStop(0, rgba(b.rim, 0));
  rim.addColorStop(0.7, rgba(b.rim, b.rimA * 0.15));
  rim.addColorStop(0.88, rgba(b.rim, b.rimA * 0.5));
  rim.addColorStop(1, rgba(b.rim2, b.rimA * 0.8));
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();

  const vignette = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
  vignette.addColorStop(0, rgba([0, 0, 0], 0));
  vignette.addColorStop(0.75, rgba([0, 0, 0], 0));
  vignette.addColorStop(1, rgba([0, 0, 0], 0.35));
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
  testId = "zamora-voice-orb",
}: ZamoraVoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const canvasSizeRef = useRef<number>(BASE_CANVAS_SIZE);
  const currentRef = useRef<OrbConfig>(resolveConfig(state, isDark));
  const fromRef = useRef<OrbConfig>(resolveConfig(state, isDark));
  const toRef = useRef<OrbConfig>(resolveConfig(state, isDark));
  const transitionStartRef = useRef<number>(0);
  const visualConfig = useMemo(() => resolveConfig(state, isDark), [isDark, state]);

  const canvasDisplaySize = Math.round(size * (BASE_CANVAS_SIZE / BASE_CONTAINER_SIZE));
  const ringSizes = BASE_RING_SIZES.map((ringSize) => Math.round(size * (ringSize / BASE_CONTAINER_SIZE)));

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

    const render = (ts: number) => {
      const progress = Math.min((ts - transitionStartRef.current) / 700, 1);
      const eased = easeInOut(Math.max(progress, 0));
      const blended = blendConfig(fromRef.current, toRef.current, eased);
      currentRef.current = blended;
      const currentSize = canvasSizeRef.current || BASE_CANVAS_SIZE;
      drawFrame(ts, blended, ctx, currentSize, currentSize);
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
      aria-hidden="true"
      style={
        {
          position: "relative",
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          "--orb-scale": visualConfig.scale,
        } as CSSProperties
      }
    >
      {ringSizes.map((ringSize, index) => (
        <span
          key={`${ringSize}-${index}`}
          style={
            {
              position: "absolute",
              width: ringSize,
              height: ringSize,
              borderRadius: 999,
              border: `1px solid ${visualConfig.ringCol}`,
              opacity: visualConfig.ringOp[index],
              animation: `zamoraRingPulse ${visualConfig.ringDur}s ease-in-out infinite`,
              animationDelay: `${index * 0.35}s`,
              "--base-opacity": visualConfig.ringOp[index],
              pointerEvents: "none",
            } as CSSProperties
          }
        />
      ))}
      <canvas
        ref={canvasRef}
        data-testid={`${testId}-canvas`}
        style={{
          position: "relative",
          zIndex: 1,
          width: canvasDisplaySize,
          height: canvasDisplaySize,
          borderRadius: 999,
          boxShadow: "0 22px 56px -18px rgba(124,58,237,0.7)",
          animation: "zamoraOrbFloat 4s ease-in-out infinite",
          transformOrigin: "center",
        }}
      />
      <style>
        {`
          @keyframes zamoraRingPulse {
            0%, 100% { transform: scale(1); opacity: var(--base-opacity); }
            50% { transform: scale(1.025); opacity: calc(var(--base-opacity) * 1.8); }
          }
          @keyframes zamoraOrbFloat {
            0%, 100% { transform: scale(var(--orb-scale)) translateY(0px); }
            50% { transform: scale(var(--orb-scale)) translateY(-4px); }
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
