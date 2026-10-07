import type { ReactNode } from "react";
import { ArrowUpRight, ChevronRight, type LucideIcon } from "lucide-react";
import { VyvaIcon, type VyvaBrandGlyph, type VyvaIconAccent } from "./brand/VyvaIcon";
import { MENU_TILE_CLASS, MENU_ICON_CLASS, menuTileTheme, menuIconTheme } from "@/design/canonicalMenuLayout";
import { CANONICAL_MENU_ITEM_TITLE_CLASS } from "@/design/canonicalMenuTypography";

export function CanonicalMenuTile({ title, detail, icon, glyph, accent, isDark, onClick, testId, disabled, status, ariaLabel }: {
  title: string; detail?: string; icon: LucideIcon; glyph?: VyvaBrandGlyph;
  accent?: VyvaIconAccent; isDark: boolean; onClick: () => void;
  testId?: string; disabled?: boolean; status?: ReactNode; ariaLabel?: string;
}) {
  return <button type="button" onClick={onClick} disabled={disabled} data-testid={testId}
    data-vyva-card-layout="canonical-menu" aria-label={ariaLabel ?? (detail ? `${title}. ${detail}` : title)}
    className={`${MENU_TILE_CLASS} ${menuTileTheme(isDark)} disabled:opacity-50 disabled:cursor-not-allowed`}>
    <span className={`${MENU_ICON_CLASS} ${menuIconTheme(isDark)}`} data-testid={testId ? `${testId}-icon` : undefined} data-vyva-icon-tile={glyph ?? accent ?? "utility"}>
      <VyvaIcon icon={icon} glyph={glyph} accent={accent} size={glyph ? 44 : 29} strokeWidth={2.55} tone="brand" />
    </span>
    <span className="vyva-home-master-fixed-type min-w-0 self-center md:self-start">
      <span data-testid={testId ? `${testId}-title` : undefined} className={`block whitespace-normal break-words ${CANONICAL_MENU_ITEM_TITLE_CLASS}`}>{title}</span>
      <span data-testid={testId ? `${testId}-detail` : undefined} className="sr-only">{detail}</span>
      {status}
    </span>
    <ArrowUpRight size={20} strokeWidth={2.35} aria-hidden="true" className={`hidden opacity-70 md:col-start-3 md:row-start-2 md:block md:self-end md:justify-self-end ${isDark ? "text-[#DCCFEF]" : "text-[#B6AAB8]"}`} />
    <ChevronRight size={20} strokeWidth={2.5} aria-hidden="true" className={`shrink-0 md:hidden ${isDark ? "text-[#DCCFEF]" : "text-vyva-purple"}`} />
  </button>;
}
