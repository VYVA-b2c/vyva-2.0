import { ArrowLeft, BellRing, Brain, Heart, Users, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

type MenuTile = {
  id: "health" | "brain" | "community" | "concierge";
  title: string;
  detail: string;
  path: string;
  icon: LucideIcon;
  tone: {
    chip: string;
    icon: string;
    border: string;
  };
};

const MENU_TILES: MenuTile[] = [
  {
    id: "health",
    title: "Health",
    detail: "Check-ins, symptoms, vitals, and medicines",
    path: "/health",
    icon: Heart,
    tone: { chip: "#FCEBEA", icon: "#D9463E", border: "#F7C9C5" },
  },
  {
    id: "brain",
    title: "My Brain",
    detail: "Memory, focus, language, and calm practice",
    path: "/mind-memory",
    icon: Brain,
    tone: { chip: "#F2ECFF", icon: "#7C3AED", border: "#DDD6FE" },
  },
  {
    id: "community",
    title: "Community",
    detail: "Rooms, activities, stories, and people",
    path: "/social-rooms",
    icon: Users,
    tone: { chip: "#EAF3FF", icon: "#2563EB", border: "#BFDBFE" },
  },
  {
    id: "concierge",
    title: "Concierge",
    detail: "Help with services, rides, and everyday tasks",
    path: "/concierge",
    icon: BellRing,
    tone: { chip: "#EAFBF1", icon: "#0F7A50", border: "#BBF7D0" },
  },
];

export { MENU_TILES };

export default function MenuScreen() {
  const navigate = useNavigate();

  return (
    <main
      className="min-h-full bg-[linear-gradient(180deg,var(--vyva-sky-a)_0%,var(--vyva-sky-b)_100%)] px-5 pb-[calc(120px+env(safe-area-inset-bottom))] pt-1 text-[var(--vyva-ink)]"
      data-testid="menu-screen"
    >
      <div className="mx-auto w-full max-w-[430px] sm:max-w-[560px]">
        <header className="mb-5 grid grid-cols-[44px_1fr_44px] items-center gap-3 sm:mb-7 sm:grid-cols-[48px_1fr_48px]">
          <button
            type="button"
            className="vyva-tap flex h-11 w-11 items-center justify-center rounded-full bg-white text-[var(--vyva-ink)] shadow-[0_12px_26px_rgba(36,28,48,0.08)] sm:h-12 sm:w-12"
            aria-label="Back to Home"
            data-testid="button-menu-back"
            onClick={() => navigate("/")}
          >
            <ArrowLeft size={22} strokeWidth={2.3} />
          </button>
          <h1 className="text-center font-display text-[28px] font-semibold leading-tight text-[var(--vyva-ink)] min-[390px]:text-[31px]">
            Menu
          </h1>
          <span aria-hidden="true" />
        </header>

        <section className="grid gap-3 min-[390px]:gap-3.5 sm:gap-4" aria-label="VYVA main menu" data-testid="menu-tile-grid">
          {MENU_TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.id}
                type="button"
                className="vyva-tap group flex min-h-[88px] items-center gap-3.5 rounded-[22px] border bg-white px-4 py-3 text-left shadow-[0_10px_24px_rgba(36,28,48,0.07)] transition-transform hover:-translate-y-0.5 min-[390px]:min-h-[96px] min-[390px]:gap-4 min-[390px]:rounded-[24px] min-[390px]:p-4 sm:min-h-[108px] sm:rounded-[28px]"
                style={{ borderColor: tile.tone.border }}
                data-testid={`menu-tile-${tile.id}`}
                onClick={() => navigate(tile.path)}
              >
                <span
                  className="flex h-[56px] w-[56px] flex-shrink-0 items-center justify-center rounded-[17px] min-[390px]:h-[58px] min-[390px]:w-[58px] sm:h-[66px] sm:w-[66px] sm:rounded-[24px]"
                  style={{ background: tile.tone.chip, color: tile.tone.icon }}
                >
                  <Icon size={28} strokeWidth={2.25} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[20px] font-semibold leading-tight text-[var(--vyva-ink)] min-[390px]:text-[22px] sm:text-[25px]">
                    {tile.title}
                  </span>
                  <span className="mt-0.5 block font-body text-[14.5px] font-semibold leading-snug text-[var(--vyva-ink-soft)] min-[390px]:mt-1 min-[390px]:text-[15.5px] sm:text-[17px]">
                    {tile.detail}
                  </span>
                </span>
              </button>
            );
          })}
        </section>
      </div>
    </main>
  );
}
