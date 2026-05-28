import { useEffect, useState, type ReactNode } from "react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";

type HomePlanCardAdmin = {
  id?: string;
  card_id: string;
  is_enabled: boolean;
  emoji: string;
  bg: string;
  badge_bg: string;
  badge_text: string;
  route: string;
  base_priority: number;
  condition_keywords: string[];
  hobby_keywords: string[];
  avoid_condition_keywords: string[];
  admin_notes?: string | null;
  updated_at?: string;
};

const emptyCard: HomePlanCardAdmin = {
  card_id: "",
  is_enabled: true,
  emoji: "*",
  bg: "#ECFDF3",
  badge_bg: "#D1FAE5",
  badge_text: "#047857",
  route: "/",
  base_priority: 50,
  condition_keywords: [],
  hobby_keywords: [],
  avoid_condition_keywords: [],
  admin_notes: "",
};

function keywordsToText(values?: string[]) {
  return (values ?? []).join(", ");
}

function textToKeywords(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm font-bold text-[#4d4351]">
        <span>{label}</span>
        {optional && <span className="font-normal text-purple-700">Optional</span>}
      </span>
      {children}
    </label>
  );
}

export default function HomeCardsAdminPage() {
  const [cards, setCards] = useState<HomePlanCardAdmin[]>([]);
  const [draft, setDraft] = useState<HomePlanCardAdmin>(emptyCard);
  const [message, setMessage] = useState("");

  async function api(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/lifecycle${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Admin request failed");
    return data;
  }

  async function refresh(options: { announce?: boolean } = {}) {
    setMessage("");
    const data = await api("/home-plan-cards");
    const nextCards = data.cards ?? [];
    setCards(nextCards);
    if (options.announce) setMessage(`Loaded: ${nextCards.length} home card${nextCards.length === 1 ? "" : "s"}.`);
  }

  function updateCard(cardId: string, patch: Partial<HomePlanCardAdmin>) {
    setCards((current) => current.map((card) => (card.card_id === cardId ? { ...card, ...patch } : card)));
  }

  async function saveCard(card: HomePlanCardAdmin) {
    try {
      await api(`/home-plan-cards/${card.card_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          is_enabled: card.is_enabled,
          emoji: card.emoji,
          bg: card.bg,
          badge_bg: card.badge_bg,
          badge_text: card.badge_text,
          route: card.route,
          base_priority: Number(card.base_priority),
          condition_keywords: card.condition_keywords,
          hobby_keywords: card.hobby_keywords,
          avoid_condition_keywords: card.avoid_condition_keywords,
          admin_notes: card.admin_notes ?? "",
        }),
      });
      await refresh();
      setMessage(`Saved: ${card.card_id} is ${card.is_enabled ? "enabled" : "disabled"} at priority ${Number(card.base_priority)}.`);
    } catch (err) {
      setMessage(`Failed to save ${card.card_id}: ${err instanceof Error ? err.message : "home card update failed"}.`);
    }
  }

  async function addCard() {
    if (!draft.card_id.trim()) {
      setMessage("Card ID is required.");
      return;
    }

    try {
      const data = await api("/home-plan-cards", {
        method: "POST",
        body: JSON.stringify({ ...draft, card_id: draft.card_id.trim(), base_priority: Number(draft.base_priority) }),
      });
      const cardId = typeof data.card?.card_id === "string" ? data.card.card_id : draft.card_id.trim();
      setDraft(emptyCard);
      await refresh();
      setMessage(`Saved: ${cardId} was added to the home card library.`);
    } catch (err) {
      setMessage(`Failed to add home card: ${err instanceof Error ? err.message : "home card creation failed"}.`);
    }
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Home card library"
          subtitle="Admins add and tune the pool behind Today for you. VYVA still chooses which cards each user sees based on profile signals."
        >
          <button className="rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => refresh({ announce: true }).catch((err) => setMessage(`Failed to load home cards: ${err.message}.`))}>Refresh</button>
          {message && <span className="rounded-2xl bg-purple-50 px-4 py-3 text-purple-800">{message}</span>}
        </AdminPageHeader>

        <AdminMenu />

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">Add a card</h2>
              <p className="mt-2 max-w-3xl text-sm text-[#7d6b65]">
                Use this for day-to-day card creation. The SQL file is only a one-time setup that creates the table and seeds starter cards.
              </p>
            </div>
            <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">{cards.length} cards</span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_8rem]">
            <Field label="Card ID"><input className="w-full rounded-2xl border px-4 py-3" value={draft.card_id} onChange={(e) => setDraft((prev) => ({ ...prev, card_id: e.target.value }))} placeholder="music_hour" /></Field>
            <Field label="Route"><input className="w-full rounded-2xl border px-4 py-3" value={draft.route} onChange={(e) => setDraft((prev) => ({ ...prev, route: e.target.value }))} placeholder="/social-rooms/music-salon" /></Field>
            <Field label="Icon"><input className="w-full rounded-2xl border px-4 py-3" value={draft.emoji} onChange={(e) => setDraft((prev) => ({ ...prev, emoji: e.target.value }))} /></Field>
            <Field label="Priority"><input className="w-full rounded-2xl border px-4 py-3" type="number" value={draft.base_priority} onChange={(e) => setDraft((prev) => ({ ...prev, base_priority: Number(e.target.value) }))} /></Field>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            <Field label="Condition keywords" optional>
              <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(draft.condition_keywords)} onChange={(e) => setDraft((prev) => ({ ...prev, condition_keywords: textToKeywords(e.target.value) }))} placeholder="lonely, low_mood" />
            </Field>
            <Field label="Hobby keywords" optional>
              <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(draft.hobby_keywords)} onChange={(e) => setDraft((prev) => ({ ...prev, hobby_keywords: textToKeywords(e.target.value) }))} placeholder="music, cooking" />
            </Field>
            <Field label="Avoid if user has" optional>
              <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(draft.avoid_condition_keywords)} onChange={(e) => setDraft((prev) => ({ ...prev, avoid_condition_keywords: textToKeywords(e.target.value) }))} placeholder="mobility_severe" />
            </Field>
          </div>

          <button className="mt-4 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => addCard()}>
            Add card
          </button>
        </section>

        {cards.length === 0 ? (
          <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
            <h2 className="font-serif text-3xl">Setup needed</h2>
            <p className="mt-2 text-[#7d6b65]">Home cards are not active yet. Run the one-time migration, then refresh this page.</p>
            <code className="mt-4 block overflow-auto whitespace-pre-wrap break-words rounded-3xl bg-[#2f2135] p-4 text-sm text-white">psql "$DATABASE_URL" -f schema/home_plan_cards.sql</code>
          </section>
        ) : (
          <section className="mt-5 grid gap-4 xl:grid-cols-2">
            {cards.map((card) => (
              <article key={card.card_id} className="rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-xl font-black">{card.card_id}</p>
                    <p className="text-sm text-[#7d6b65]">{card.route}</p>
                  </div>
                  <label className="flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 font-bold text-purple-700">
                    <input type="checkbox" checked={card.is_enabled} onChange={(e) => updateCard(card.card_id, { is_enabled: e.target.checked })} />
                    Enabled
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Field label="Icon"><input className="w-full rounded-2xl border px-4 py-3" value={card.emoji} onChange={(e) => updateCard(card.card_id, { emoji: e.target.value })} /></Field>
                  <Field label="Priority"><input className="w-full rounded-2xl border px-4 py-3" type="number" value={card.base_priority} onChange={(e) => updateCard(card.card_id, { base_priority: Number(e.target.value) })} /></Field>
                  <Field label="Route"><input className="w-full rounded-2xl border px-4 py-3" value={card.route} onChange={(e) => updateCard(card.card_id, { route: e.target.value })} /></Field>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Background"><input className="w-full rounded-2xl border px-4 py-3" value={card.bg} onChange={(e) => updateCard(card.card_id, { bg: e.target.value })} /></Field>
                  <Field label="Badge background"><input className="w-full rounded-2xl border px-4 py-3" value={card.badge_bg} onChange={(e) => updateCard(card.card_id, { badge_bg: e.target.value })} /></Field>
                  <Field label="Badge text"><input className="w-full rounded-2xl border px-4 py-3" value={card.badge_text} onChange={(e) => updateCard(card.card_id, { badge_text: e.target.value })} /></Field>
                </div>

                <div className="mt-3 grid gap-3">
                  <Field label="Condition keywords">
                    <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(card.condition_keywords)} onChange={(e) => updateCard(card.card_id, { condition_keywords: textToKeywords(e.target.value) })} />
                  </Field>
                  <Field label="Hobby keywords">
                    <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(card.hobby_keywords)} onChange={(e) => updateCard(card.card_id, { hobby_keywords: textToKeywords(e.target.value) })} />
                  </Field>
                  <Field label="Avoid if user has">
                    <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(card.avoid_condition_keywords)} onChange={(e) => updateCard(card.card_id, { avoid_condition_keywords: textToKeywords(e.target.value) })} />
                  </Field>
                  <Field label="Admin notes" optional>
                    <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={card.admin_notes ?? ""} onChange={(e) => updateCard(card.card_id, { admin_notes: e.target.value })} />
                  </Field>
                </div>

                <button className="mt-4 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => saveCard(card)}>
                  Save card
                </button>
              </article>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
