import { useId } from "react";
import type { LucideIcon } from "lucide-react";

export type VyvaBrandGlyph = "doctor" | "longevity" | "vitals" | "medication";
export type VyvaIconAccent =
  | "pulse"
  | "bridge"
  | "link"
  | "clapper"
  | "scope"
  | "check"
  | "divider"
  | "id"
  | "smile"
  | "bookmark"
  | "path"
  | "spark"
  | "pin"
  | "signal"
  | "step"
  | "trend"
  | "dot"
  | "calendar"
  | "knobs";
export type VyvaIconTone = "brand" | "inverse" | "muted" | "danger" | "success" | "warning";

type VyvaIconProps = {
  icon?: LucideIcon;
  glyph?: VyvaBrandGlyph;
  accent?: VyvaIconAccent;
  size?: number;
  strokeWidth?: number;
  tone?: VyvaIconTone;
  className?: string;
  testId?: string;
};

const gold = "#F8AE1B";

function VyvaGoldAccent({ accent }: { accent: VyvaIconAccent }) {
  const strokeProps = {
    stroke: gold,
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  switch (accent) {
    case "pulse":
      return <path d="M3.5 12h4l1.8-4 2.5 9 2.5-6 2 1h4.2" {...strokeProps} />;
    case "bridge":
      return <path d="M12 5v14M9 12h6" {...strokeProps} />;
    case "link":
      return (
        <>
          <path d="M10 15c2-2.5 4-3.5 7-3.5" {...strokeProps} />
          <circle cx="18" cy="11.5" r="1.55" fill={gold} />
        </>
      );
    case "clapper":
      return (
        <>
          <path d="M9.5 18c.7 1.5 1.5 2 2.5 2s1.8-.5 2.5-2" {...strokeProps} />
          <circle cx="18" cy="6" r="1.55" fill={gold} />
        </>
      );
    case "scope":
      return <circle cx="18" cy="17" r="2" fill={gold} />;
    case "check":
      return <path d="m8 12 2.5 2.5 5.5-6" {...strokeProps} />;
    case "divider":
      return (
        <>
          <path d="m9 16 7-7" {...strokeProps} />
          <circle cx="18" cy="6" r="1.55" fill={gold} />
        </>
      );
    case "id":
      return (
        <>
          <circle cx="17" cy="8" r="1.55" fill={gold} />
          <path d="M14 15h5" {...strokeProps} />
        </>
      );
    case "smile":
      return <path d="M8 14c1.5 2 5 2 6.5 0" {...strokeProps} />;
    case "bookmark":
      return <path d="M14 5v8l-2.5-1.7L9 13V5" {...strokeProps} />;
    case "path":
      return (
        <>
          <path d="M7 17c3-4 6.5-5 10.5-3.5" {...strokeProps} />
          <circle cx="18" cy="13.5" r="1.45" fill={gold} />
        </>
      );
    case "spark":
      return <path d="m17 4 .8 2.2L20 7l-2.2.8L17 10l-.8-2.2L14 7l2.2-.8Z" fill={gold} stroke="none" />;
    case "pin":
      return (
        <>
          <path d="M18 10s2.5-2.5 2.5-4.5a2.5 2.5 0 0 0-5 0C15.5 7.5 18 10 18 10Z" fill={gold} stroke="none" />
          <circle cx="18" cy="5.5" r=".75" fill="#6A2CC7" />
        </>
      );
    case "signal":
      return <path d="M15 9c1.5 0 2.8 1.2 2.8 2.8M15 5.5c3.5 0 6.3 2.8 6.3 6.3" {...strokeProps} />;
    case "step":
      return (
        <>
          <circle cx="16.5" cy="7" r="1.55" fill={gold} />
          <path d="m14 11 3 5" {...strokeProps} />
        </>
      );
    case "trend":
      return <path d="m8 16 3-3 2.5 2.5L19 9" {...strokeProps} />;
    case "dot":
      return <circle cx="17.5" cy="7" r="1.7" fill={gold} />;
    case "calendar":
      return <path d="m8.5 13 2.2 2.2 4.8-5" {...strokeProps} />;
    case "knobs":
      return (
        <>
          <circle cx="8" cy="8" r="1.65" fill={gold} />
          <circle cx="16" cy="16" r="1.65" fill={gold} />
        </>
      );
  }
}

const toneColors: Record<VyvaIconTone, string> = {
  brand: "currentColor",
  inverse: "#FFFFFF",
  muted: "#9B8EA5",
  danger: "#D92020",
  success: "#0F8A5F",
  warning: "#C47A05",
};

function VyvaGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="4" y1="3" x2="21" y2="22" gradientUnits="userSpaceOnUse">
      <stop stopColor="#9D4FE0" />
      <stop offset="1" stopColor="#5C22B9" />
    </linearGradient>
  );
}

function VyvaBrandGlyphIcon({
  glyph,
  gradientId,
  size,
  className,
  testId,
}: {
  glyph: VyvaBrandGlyph;
  gradientId: string;
  size: number;
  className?: string;
  testId?: string;
}) {
  const ribbonStroke = `url(#${gradientId})`;

  return (
    <svg
      viewBox="0 0 56 56"
      width={size}
      height={size}
      className={className}
      fill="none"
      data-brand-icon={glyph}
      data-vyva-icon={glyph}
      data-testid={testId}
      focusable="false"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="9" y1="7" x2="47" y2="49" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9D4FE0" />
          <stop offset="1" stopColor="#5C22B9" />
        </linearGradient>
      </defs>
      {glyph === "doctor" ? (
        <>
          <path d="M15 11v14c0 9 6 15 13 15s13-6 13-15V11" stroke={ribbonStroke} strokeWidth="6.5" strokeLinecap="round" />
          <path d="M28 40v2.5c0 5 3.6 8.5 8.5 8.5S45 47.5 45 43" stroke={ribbonStroke} strokeWidth="6.5" strokeLinecap="round" />
          <circle cx="45" cy="39" r="5.3" fill="#F8AE1B" stroke="#F1E8FF" strokeWidth="2.4" />
        </>
      ) : null}
      {glyph === "longevity" ? (
        <>
          <path
            d="M28 8 43 14v12c0 10-5.8 17.2-15 22-9.2-4.8-15-12-15-22V14Z"
            stroke={ribbonStroke}
            strokeWidth="6.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="m20.5 27 5.2 5.2 10-11" stroke="#F8AE1B" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {glyph === "vitals" ? (
        <>
          <path
            d="M28 47S10 36.4 10 22c0-7 4.6-11.2 10.6-11.2 3.3 0 5.8 1.7 7.4 4.5 1.6-2.8 4.1-4.5 7.4-4.5C41.4 10.8 46 15 46 22c0 14.4-18 25-18 25Z"
            stroke={ribbonStroke}
            strokeWidth="6.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M14.5 28h7l3.2-7 4.1 14 4-9.2 2.7 2.2h6" stroke="#F8AE1B" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {glyph === "medication" ? (
        <>
          <g transform="translate(28 29) rotate(-42)">
            <rect x="-20" y="-10" width="40" height="20" rx="10" stroke={ribbonStroke} strokeWidth="6.2" />
            <path d="M0-8v16" stroke="#F8AE1B" strokeWidth="4" strokeLinecap="round" />
          </g>
          <circle cx="43" cy="13" r="4.5" fill="#F8AE1B" />
        </>
      ) : null}
    </svg>
  );
}

export function VyvaIcon({
  icon: Icon,
  glyph,
  accent,
  size = 24,
  strokeWidth = 2.4,
  tone = "brand",
  className,
  testId,
}: VyvaIconProps) {
  const reactId = useId();
  const gradientId = `vyva-icon-${reactId.replace(/:/g, "")}`;

  if (glyph) {
    return <VyvaBrandGlyphIcon glyph={glyph} gradientId={gradientId} size={size} className={className} testId={testId} />;
  }

  if (!Icon) return null;

  const color = tone === "brand" ? `url(#${gradientId})` : toneColors[tone];

  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      className={className}
      data-vyva-icon="utility"
      data-vyva-accent={accent}
      data-testid={testId}
      focusable="false"
      aria-hidden="true"
    >
      {tone === "brand" ? (
        <defs>
          <VyvaGradient id={gradientId} />
        </defs>
      ) : null}
      {tone === "brand" && accent ? <VyvaGoldAccent accent={accent} /> : null}
    </Icon>
  );
}
