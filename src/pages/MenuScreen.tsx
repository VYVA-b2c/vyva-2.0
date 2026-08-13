import { ArrowLeft, Brain, ConciergeBell, Heart, Users, type LucideIcon } from "lucide-react";
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
    icon: ConciergeBell,
    tone: { chip: "#EAFBF1", icon: "#0F7A50", border: "#BBF7D0" },
  },
];

export { MENU_TILES };

export default function MenuScreen() {
  const navigate = useNavigate();

  return (
    <main
      className="min-h-full bg-[linear-gradient(180deg,var(--vyva-sky-a)_0%,var(--vyva-sky-b)_100%)] px-5 pb-32 pt-4 text-[var(--vyva-ink)]"
      data-testid="menu-screen"
    >
      <div className="mx-auto w-full max-w-[560px]">
        <header className="mb-8 grid grid-cols-[48px_1fr_48px] items-center gap-3">
          <button
            type="button"
            className="vyva-tap flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--vyva-ink)] shadow-[0_12px_26px_rgba(36,28,48,0.08)]"
            aria-label="Back to Home"
            data-testid="button-menu-back"
            onClick={() => navigate("/")}
          >
            <ArrowLeft size={22} strokeWidth={2.3} />
          </button>
          <h1 className="text-center font-display text-[31px] font-semibold leading-tight text-[var(--vyva-ink)]">
            Menu
          </h1>
          <span aria-hidden="true" />
        </header>

        <section className="grid gap-4" aria-label="VYVA main menu" data-testid="menu-tile-grid">
          {MENU_TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.id}
                type="button"
                className="vyva-tap group flex min-h-[118px] items-center gap-4 rounded-[30px] border bg-white p-4 text-left shadow-[0_18px_36px_rgba(36,28,48,0.08)] transition-transform hover:-translate-y-0.5"
                style={{ borderColor: tile.tone.border }}
                data-testid={`menu-tile-${tile.id}`}
                onClick={() => navigate(tile.path)}
              >
                <span
                  className="flex h-[66px] w-[66px] flex-shrink-0 items-center justify-center rounded-[24px]"
                  style={{ background: tile.tone.chip, color: tile.tone.icon }}
                >
                  <Icon size={32} strokeWidth={2.25} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[25px] font-semibold leading-tight text-[var(--vyva-ink)]">
                    {tile.title}
                  </span>
                  <span className="mt-1 block font-body text-[17px] font-semibold leading-snug text-[var(--vyva-ink-soft)]">
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
