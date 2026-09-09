import type { VisualMemoryPatternShape, VisualMemoryVisual } from "./visualMemoryJourney";

type MemoryMatchVisualProps = {
  visual: VisualMemoryVisual;
  className?: string;
};

function shapePoints(shape: VisualMemoryPatternShape) {
  switch (shape) {
    case "triangle":
      return "50,18 82,76 18,76";
    case "diamond":
      return "50,14 84,50 50,86 16,50";
    case "hexagon":
      return "28,18 72,18 88,50 72,82 28,82 12,50";
    case "star":
      return "50,12 59,38 87,38 65,55 73,83 50,66 27,83 35,55 13,38 41,38";
    default:
      return "";
  }
}

export default function MemoryMatchVisual({ visual, className }: MemoryMatchVisualProps) {
  if (visual.kind === "emoji") {
    return <span aria-hidden="true" className={className}>{visual.glyph}</span>;
  }

  const polygonPoints = shapePoints(visual.shape);
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 100"
      className={className}
      data-testid="visual-memory-pattern"
    >
      <rect x="2" y="2" width="96" height="96" rx="22" fill={visual.background} />
      {visual.motif === "stripes" ? (
        <g stroke={visual.secondary} strokeWidth="8" opacity="0.9">
          <path d="M-10 25 L25 -10 M-5 55 L55 -5 M15 85 L85 15 M45 105 L105 45 M75 110 L110 75" />
        </g>
      ) : null}
      {visual.motif === "dots" ? (
        <g fill={visual.secondary} opacity="0.9">
          {[20, 50, 80].flatMap((x) => [20, 50, 80].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="5" />))}
        </g>
      ) : null}
      {visual.motif === "grid" ? (
        <g stroke={visual.secondary} strokeWidth="4" opacity="0.78">
          <path d="M25 5 V95 M50 5 V95 M75 5 V95 M5 25 H95 M5 50 H95 M5 75 H95" />
        </g>
      ) : null}
      {visual.motif === "waves" ? (
        <g fill="none" stroke={visual.secondary} strokeWidth="5" opacity="0.9">
          <path d="M4 25 C18 10 32 40 46 25 S74 10 96 25" />
          <path d="M4 50 C18 35 32 65 46 50 S74 35 96 50" />
          <path d="M4 75 C18 60 32 90 46 75 S74 60 96 75" />
        </g>
      ) : null}
      {visual.motif === "split" ? (
        <path d="M2 2 H98 V50 H2 Z" fill={visual.secondary} opacity="0.72" />
      ) : null}
      <g transform={`rotate(${visual.rotation} 50 50)`}>
        {visual.shape === "circle" ? <circle cx="50" cy="50" r="26" fill={visual.foreground} stroke={visual.secondary} strokeWidth="5" /> : null}
        {visual.shape === "square" ? <rect x="24" y="24" width="52" height="52" rx="8" fill={visual.foreground} stroke={visual.secondary} strokeWidth="5" /> : null}
        {polygonPoints ? <polygon points={polygonPoints} fill={visual.foreground} stroke={visual.secondary} strokeWidth="5" strokeLinejoin="round" /> : null}
      </g>
      {visual.motif === "solid" ? <circle cx="76" cy="24" r="7" fill={visual.secondary} /> : null}
    </svg>
  );
}
