// MenuScreen is the visual source of truth for menu and submenu navigation.
export const MENU_GRID_CLASS = "grid w-full grid-cols-1 gap-4 md:grid-cols-2 md:gap-5";
export const MENU_TILE_CLASS = "vyva-tap group grid min-h-[84px] w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-4 rounded-[26px] border px-4 text-left transition-transform duration-150 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 md:min-h-[158px] md:grid-cols-[64px_minmax(0,1fr)_auto] md:grid-rows-[auto_1fr] md:items-start md:gap-y-3 md:p-5";
export const MENU_ICON_CLASS = "relative grid h-14 w-14 flex-shrink-0 place-items-center overflow-hidden rounded-[20px] transition-[background-color,transform] duration-200 group-hover:scale-[1.03] group-focus-visible:scale-[1.03] md:row-span-2 md:h-16 md:w-16 md:self-start";
export const menuTileTheme = (dark: boolean) => dark
  ? "border-white/[0.14] bg-[#2A2034] text-[#F9F4FF] shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
  : "border-[#EEE8F1] bg-white text-[#241C30] shadow-[0_10px_24px_rgba(36,28,48,0.05)]";
export const menuIconTheme = (dark: boolean) => dark
  ? "bg-[#3C2956] group-hover:bg-[#443061]"
  : "bg-[#F1E8FF] group-hover:bg-[#ECE0FF]";
