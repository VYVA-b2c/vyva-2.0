import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Flower2, Info, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { useLanguage } from "@/i18n";
import vyvaLogo from "@/assets/vyva-logo.png";
import foodImage from "@/assets/scent-memory/food.jpg";
import breadImage from "@/assets/scent-memory/fresh-bread.jpg";
import homeImage from "@/assets/scent-memory/home.jpg";
import natureImage from "@/assets/scent-memory/nature.jpg";
import occasionImage from "@/assets/scent-memory/occasion.jpg";
import placeImage from "@/assets/scent-memory/place.jpg";
import seasonImage from "@/assets/scent-memory/season.jpg";
import { apiFetch } from "@/lib/queryClient";
import DualInput from "./shared/DualInput";
import { normalizeGameLanguage } from "./shared/language";

const BRAND = {
  purple: "#6B21A8",
  gold: "#F59E0B",
  bg: "#FAF9F6",
  ink: "#2B2233",
  muted: "#5B4A61",
  border: "#E7D8F3",
  softPurple: "#F3E8FF",
  softGold: "#FFF7ED",
  teal: "#0F766E",
  tealPale: "#DDF7F1",
};

const SCENT_MEMORY_TUTORIAL_KEY = "scentMemory:tutorialSeen:v1";

function tutorialStorageKey(userId) {
  return userId ? `${SCENT_MEMORY_TUTORIAL_KEY}:${userId}` : SCENT_MEMORY_TUTORIAL_KEY;
}

function readScentMemoryTutorialSeen(userId) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(tutorialStorageKey(userId)) === "true";
  } catch {
    return false;
  }
}

function writeScentMemoryTutorialSeen(userId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tutorialStorageKey(userId), "true");
  } catch {
    // Tutorial persistence is helpful but should never block the reflection.
  }
}

const DEFAULT_STREAK_STATE = {
  total_sessions: 0,
  streak_days: 0,
  last_streak_date: null,
  last_played_at: null,
};

const SCENT_VISUAL_IMAGES = {
  bread: breadImage,
  food: foodImage,
  nature: natureImage,
  home: homeImage,
  season: seasonImage,
  place: placeImage,
  occasion: occasionImage,
};

const SCENT_VISUAL_DEFAULTS = {
  bread: "Warm from the oven.",
  food: "A familiar kitchen smell.",
  nature: "Fresh air, leaves, and flowers.",
  home: "A smell from home.",
  season: "A scent from a season.",
  place: "A place you can almost visit again.",
  occasion: "A scent from a special day.",
};

const BREAD_TERMS = ["bread", "sourdough", "loaf", "oven", "bakery", "baked", "pan", "brot", "pain", "pane", "pao"];

const FALLBACK_PROMPTS = {
  es: {
    id: null,
    scent_name: "pan recien hecho",
    scent_description: "Imagina ese olor calido y un poco dulce que sale del horno recien apagado.",
    guiding_question: "Te recuerda a algun momento, lugar o costumbre?",
    category: "food",
    language: "es",
  },
  de: {
    id: null,
    scent_name: "frisch gebackenes Brot",
    scent_description: "Stell dir diesen warmen, leicht suessen Duft vor, der aus einem gerade geoeffneten Ofen kommt.",
    guiding_question: "Erinnert dich das an einen Ort, einen Moment oder eine Gewohnheit?",
    category: "food",
    language: "de",
  },
  en: {
    id: null,
    scent_name: "fresh bread",
    scent_description: "Imagine that warm, slightly sweet smell coming from an oven that has just been opened.",
    guiding_question: "Does it bring back a place, a moment, or a small habit?",
    category: "food",
    language: "en",
  },
  fr: {
    id: null,
    scent_name: "pain tout juste cuit",
    scent_description: "Imagine cette odeur chaude et legerement sucree qui sort d'un four que l'on vient d'ouvrir.",
    guiding_question: "Cela te rappelle-t-il un lieu, un moment ou une habitude?",
    category: "food",
    language: "fr",
  },
  it: {
    id: null,
    scent_name: "pane appena sfornato",
    scent_description: "Immagina quel profumo caldo e leggermente dolce che arriva da un forno appena aperto.",
    guiding_question: "Ti fa tornare in mente un luogo, un momento o una piccola abitudine?",
    category: "food",
    language: "it",
  },
  pt: {
    id: null,
    scent_name: "pao acabado de fazer",
    scent_description: "Imagina esse cheiro quente e ligeiramente doce que sai de um forno acabado de abrir.",
    guiding_question: "Isto faz-te lembrar algum lugar, momento ou costume?",
    category: "food",
    language: "pt",
  },
};

export function getDefaultScentMemoryUserState(userId) {
  return {
    user_id: userId,
    ...DEFAULT_STREAK_STATE,
    updated_at: new Date().toISOString(),
  };
}

function useLatestRef(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function fallbackPromptFor(language) {
  const normalized = normalizeGameLanguage(language);
  return FALLBACK_PROMPTS[normalized] ?? FALLBACK_PROMPTS.es;
}

function normalizeScentText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getScentVisualKey(prompt) {
  const searchable = normalizeScentText(`${prompt?.scent_name ?? ""} ${prompt?.scent_description ?? ""}`);
  if (BREAD_TERMS.some((term) => searchable.includes(term))) return "bread";
  return SCENT_VISUAL_IMAGES[prompt?.category] ? prompt.category : "home";
}

function getScentVisual(prompt, t) {
  const key = getScentVisualKey(prompt);
  const scent = prompt?.scent_name ?? t("games.scentMemory.scentFallback", "this scent");
  return {
    image: SCENT_VISUAL_IMAGES[key] ?? homeImage,
    cue: t(`games.scentMemory.visualCues.${key}`, SCENT_VISUAL_DEFAULTS[key] ?? SCENT_VISUAL_DEFAULTS.home),
    alt: t("games.scentMemory.visualAlt", "{scent} visual cue", { scent }),
  };
}

function ScentTutorialVisual({ visual }) {
  return (
    <div className="relative mx-auto h-[160px] w-full max-w-[560px] overflow-hidden rounded-[24px] border sm:h-[260px] sm:rounded-[34px]" style={{ borderColor: "#F3D9B7", background: BRAND.softGold }}>
      <img src={visual.image} alt="" aria-hidden="true" className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#2B2233]/45 via-transparent to-white/10" />
      <div className="absolute bottom-3 left-3 right-3 rounded-full bg-white/95 px-4 py-2 text-[18px] font-black leading-tight shadow-vyva-card sm:bottom-4 sm:left-4 sm:right-4 sm:px-5 sm:py-3 sm:text-[23px]" style={{ color: BRAND.purple }}>
        {visual.cue}
      </div>
    </div>
  );
}

export default function ScentMemory({ userId, onExit }) {
  const { language, t } = useLanguage();
  const gameLanguage = normalizeGameLanguage(language);
  const [screen, setScreen] = useState("loading");
  const [prompt, setPrompt] = useState(null);
  const [userState, setUserState] = useState(null);
  const [questionRevealed, setQuestionRevealed] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saveWarning, setSaveWarning] = useState("");
  const [saving, setSaving] = useState(false);

  const sessionStartRef = useRef(Date.now());
  const sessionSavedRef = useRef(false);
  const screenRef = useLatestRef(screen);
  const promptRef = useLatestRef(prompt);
  const responseTextRef = useLatestRef(responseText);

  const fallbackState = useMemo(() => getDefaultScentMemoryUserState(userId || "local"), [userId]);
  const scentVisual = useMemo(() => getScentVisual(prompt, t), [prompt, t]);

  const loadTodaysPrompt = useCallback(async () => {
    if (!userId) {
      setPrompt(fallbackPromptFor(gameLanguage));
      setUserState(fallbackState);
      return;
    }

    const response = await apiFetch(`/api/games/scent-memory/content?language=${encodeURIComponent(gameLanguage)}`);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error ?? t("games.scentMemory.contentUnavailable", "There is no reviewed Scent Memory content available yet."));
    }

    setPrompt(payload.prompt);
    setUserState(payload.state ?? getDefaultScentMemoryUserState(userId));
  }, [fallbackState, gameLanguage, t, userId]);

  const loadGame = useCallback(async () => {
    setScreen("loading");
    setLoadError("");
    setSaveWarning("");
    setQuestionRevealed(false);
    setResponseText("");
    sessionStartRef.current = Date.now();
    sessionSavedRef.current = false;

    try {
      await loadTodaysPrompt();
      setScreen(readScentMemoryTutorialSeen(userId) ? "scent" : "tutorial");
    } catch (error) {
      console.warn("Scent Memory could not load.", error);
      setLoadError(error instanceof Error ? error.message : t("games.scentMemory.contentUnavailable", "There is no reviewed Scent Memory content available yet."));
      setScreen("error");
    }
  }, [loadTodaysPrompt, t, userId]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  useEffect(() => {
    if (screen !== "scent") return undefined;
    if (questionRevealed) return undefined;
    const timeout = window.setTimeout(() => setQuestionRevealed(true), 3000);
    return () => window.clearTimeout(timeout);
  }, [questionRevealed, screen, prompt?.id]);

  const saveSession = useCallback(async ({ completed, abandoned, text, method }) => {
    if (sessionSavedRef.current) return null;
    sessionSavedRef.current = true;

    const currentPrompt = promptRef.current;
    const response = String(text ?? responseTextRef.current ?? "").trim();
    const durationSeconds = Math.max(0, Math.round((Date.now() - sessionStartRef.current) / 1000));

    if (!userId) {
      if (completed) {
        setUserState((current) => ({
          ...(current ?? fallbackState),
          total_sessions: Number(current?.total_sessions ?? 0) + 1,
          streak_days: Math.max(1, Number(current?.streak_days ?? 0)),
          last_played_at: new Date().toISOString(),
        }));
      }
      return null;
    }

    const apiResponse = await apiFetch("/api/games/scent-memory/sessions", {
      method: "POST",
      body: JSON.stringify({
        promptId: currentPrompt?.id ?? null,
        responseText: response || null,
        responseInputMethod: method ?? null,
        completed,
        abandoned,
        durationSeconds,
        language: gameLanguage,
      }),
    });
    const saved = await apiResponse.json().catch(() => ({}));

    if (!apiResponse.ok) {
      sessionSavedRef.current = false;
      throw new Error(saved?.error ?? "Scent Memory session could not be saved.");
    }

    if (saved.state) setUserState(saved.state);
    return saved.session ?? null;
  }, [fallbackState, gameLanguage, promptRef, responseTextRef, userId]);

  const completeSession = async (text = "", method = null) => {
    setSaving(true);
    setSaveWarning("");
    if (text) setResponseText(text);

    try {
      await saveSession({
        completed: true,
        abandoned: false,
        text,
        method,
      });
    } catch (error) {
      console.warn("Scent Memory could not save the completed session.", error);
      setSaveWarning(t("games.scentMemory.saveWarning", "Your reflection is shown here, but saving may need to be retried."));
    } finally {
      setSaving(false);
      setScreen("close");
    }
  };

  const handleSubmit = (text, method) => {
    void completeSession(text, method);
  };

  const handleSkip = () => {
    setResponseText("");
    void completeSession("", null);
  };

  const closeTutorial = () => {
    writeScentMemoryTutorialSeen(userId);
    setScreen("scent");
  };

  const openInstructions = () => {
    setScreen("tutorial");
  };

  const exitGame = async () => {
    if (screenRef.current === "scent") {
      setSaving(true);
      try {
        await saveSession({
          completed: false,
          abandoned: true,
          text: responseTextRef.current,
          method: null,
        });
      } catch (error) {
        console.warn("Scent Memory could not save the abandoned session.", error);
      } finally {
        setSaving(false);
      }
    }
    onExit?.();
  };

  if (screen === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6" style={{ background: BRAND.bg, color: BRAND.ink }}>
        <section className="text-center">
          <Loader2 className="mx-auto h-14 w-14 animate-spin" style={{ color: BRAND.purple }} />
          <p className="mt-5 text-[26px] font-black">{t("games.scentMemory.preparing", "Preparing a memory...")}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-6" style={{ background: BRAND.bg, color: BRAND.ink }}>
      <div className="mx-auto w-full max-w-[780px]">
        <header className="flex items-center justify-between gap-4">
          <img src={vyvaLogo} alt="VYVA" className="h-12 w-12 rounded-2xl" />
          {screen !== "close" ? (
            <button
              type="button"
              onClick={() => void exitGame()}
              disabled={saving}
              className="inline-flex min-h-[64px] items-center gap-2 rounded-full bg-white px-6 text-[22px] font-extrabold shadow-vyva-card disabled:opacity-50"
            >
              <ArrowLeft size={24} aria-hidden="true" />
              {t("common.exit", "Exit")}
            </button>
          ) : null}
        </header>

        {screen === "error" ? (
          <section className="mt-6 rounded-[28px] border bg-white p-6 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="mx-auto flex h-[92px] w-[92px] items-center justify-center rounded-[24px]" style={{ background: BRAND.softPurple, color: BRAND.purple }}>
              <Flower2 size={52} aria-hidden="true" />
            </div>
            <h1 className="mt-6 font-display text-[40px] leading-tight">{t("games.scentMemory.title", "Scent Memory")}</h1>
            <p className="mt-4 text-[24px] font-bold" style={{ color: BRAND.muted }}>{loadError}</p>
            <button
              type="button"
              onClick={() => void loadGame()}
              className="mt-7 inline-flex min-h-[72px] items-center justify-center gap-3 rounded-full px-6 text-[24px] font-black text-white shadow-vyva-card"
              style={{ background: BRAND.purple }}
            >
              <RefreshCw size={26} aria-hidden="true" />
              {t("games.scentMemory.tryAgain", "Try again")}
            </button>
          </section>
        ) : null}

        {screen === "tutorial" ? (
          <section className="mt-4 rounded-[28px] border bg-white p-3 text-center shadow-vyva-card sm:mt-6 sm:p-6" style={{ borderColor: BRAND.border }}>
            <ScentTutorialVisual visual={scentVisual} />
            <h1 className="mt-4 font-display text-[31px] leading-tight sm:mt-6 sm:text-[42px]">{t("games.scentMemory.title", "Scent Memory")}</h1>
            <p className="mt-2 text-[21px] font-black leading-tight sm:text-[27px]" style={{ color: BRAND.muted }}>
              {t("games.scentMemory.tutorialSubtitle", "Look. Remember. Share if you want.")}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-3">
              {[
                { label: t("games.scentMemory.tutorialLook", "Look"), Icon: Flower2 },
                { label: t("games.scentMemory.tutorialRemember", "Remember"), Icon: Check },
                { label: t("games.scentMemory.tutorialShare", "Share or skip"), Icon: MessageCircle },
              ].map(({ label, Icon }) => (
                <div key={label} className="min-h-[82px] rounded-[18px] px-2 py-2 sm:min-h-[108px] sm:rounded-[22px] sm:py-4" style={{ background: BRAND.softGold, color: BRAND.gold }}>
                  <Icon className="mx-auto" size={26} aria-hidden="true" />
                  <span className="mt-2 block text-[13px] font-black leading-tight sm:mt-3 sm:text-[17px]">{label}</span>
                </div>
              ))}
            </div>

            <p className="mx-auto mt-3 max-w-[560px] text-[17px] font-bold leading-snug sm:mt-5 sm:text-[21px]" style={{ color: BRAND.muted }}>
              {t("games.scentMemory.tutorialPace", "There is no right answer. A small memory is enough.")}
            </p>

            <button
              type="button"
              onClick={closeTutorial}
              className="mt-3 min-h-[60px] w-full rounded-full px-6 text-[22px] font-black text-white shadow-vyva-card sm:mt-6 sm:min-h-[76px] sm:text-[25px]"
              style={{ background: BRAND.purple }}
            >
              {t("games.scentMemory.tutorialUnderstand", "I understand")}
            </button>
            <button
              type="button"
              onClick={closeTutorial}
              className="mt-2 min-h-[48px] rounded-full px-5 text-[19px] font-extrabold underline underline-offset-4 sm:mt-3 sm:min-h-[58px] sm:text-[21px]"
              style={{ color: BRAND.purple }}
            >
              {t("common.skip", "Skip")}
            </button>
          </section>
        ) : null}

        {screen === "scent" ? (
          <section className="mt-6 rounded-[28px] border bg-white p-6 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={openInstructions}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-full border bg-white px-4 text-[18px] font-extrabold"
                style={{ borderColor: BRAND.border, color: BRAND.purple }}
              >
                <Info size={22} aria-hidden="true" />
                {t("games.scentMemory.instructions", "Instructions")}
              </button>
            </div>
            <div className="mx-auto flex h-[82px] w-[82px] items-center justify-center rounded-[24px]" style={{ background: BRAND.softGold, color: BRAND.gold }}>
              <Flower2 size={54} strokeWidth={2.4} aria-hidden="true" />
            </div>
            <h1 className="mt-5 font-display text-[38px] leading-tight">{t("games.scentMemory.title", "Scent Memory")}</h1>
            <p className="mt-2 text-[24px] font-black" style={{ color: BRAND.muted }}>
              {t("games.scentMemory.intro", "Look, then remember.")}
            </p>

            <div className="mt-6 rounded-[26px] border p-4" style={{ background: "#FFFCF8", borderColor: "#F3D9B7" }}>
              <div className="relative overflow-hidden rounded-[22px] bg-[#F7EFE7]">
                <img
                  src={scentVisual.image}
                  alt={scentVisual.alt}
                  className="h-[250px] w-full object-cover sm:h-[300px]"
                />
                <div className="absolute inset-x-4 bottom-4 flex justify-start">
                  <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1 rounded-full bg-white/95 px-5 py-3 text-left leading-tight shadow-vyva-card">
                    <span className="text-[24px] font-black sm:text-[28px]" style={{ color: BRAND.purple }}>
                      {prompt?.scent_name}
                    </span>
                    <span aria-hidden="true" className="hidden text-[18px] font-black sm:inline" style={{ color: "#C084FC" }}>
                      /
                    </span>
                    <span className="text-[18px] font-black sm:text-[20px]" style={{ color: "#92400E" }}>
                      {scentVisual.cue}
                    </span>
                  </span>
                </div>
              </div>

              <div
                className={`mx-auto mt-5 max-w-[660px] transition-all duration-700 ${questionRevealed ? "opacity-100 translate-y-0" : "pointer-events-none translate-y-2 opacity-0"}`}
                aria-live="polite"
              >
                <p className="sr-only">
                  {prompt?.scent_description} {prompt?.guiding_question}
                </p>
                <p className="text-[30px] font-black leading-tight" style={{ color: BRAND.teal }}>
                  {t("games.scentMemory.memoryQuestion", "What comes back?")}
                </p>
                <p className="mt-2 text-[20px] font-bold" style={{ color: BRAND.muted }}>
                  {t("games.scentMemory.memoryHint", "A place, a person, or a small habit.")}
                </p>
                <div className="mt-5">
                  <DualInput
                    value={responseText}
                    onChange={setResponseText}
                    onSubmit={handleSubmit}
                    placeholder={t("games.scentMemory.placeholder", "Tell me what you remember...")}
                    skipLabel={t("common.skip", "Skip")}
                    onSkip={handleSkip}
                    submitLabel={t("common.continue", "Continue")}
                    dictateLabel={t("games.curiousMinds.dictateLabel", "Dictate")}
                    listeningLabel={t("games.curiousMinds.listeningLabel", "Listening...")}
                    voiceUnavailableLabel={t("games.curiousMinds.voiceUnavailableLabel", "Voice input is not available")}
                    language={language}
                    disabled={saving || !questionRevealed}
                  />
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {screen === "close" ? (
          <section className="mt-6 rounded-[28px] border bg-white p-6 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="mx-auto flex h-[92px] w-[92px] items-center justify-center rounded-[24px]" style={{ background: BRAND.tealPale, color: BRAND.teal }}>
              <Check size={54} aria-hidden="true" />
            </div>
            <h1 className="mt-6 font-display text-[40px] leading-tight">{t("games.scentMemory.thanksForSharing", "Thanks for sharing that.")}</h1>
            {responseText.trim() ? (
              <p className="mx-auto mt-4 max-w-[620px] text-[24px] font-bold leading-snug" style={{ color: BRAND.muted }}>
                {t("games.scentMemory.gentleReflection", "A memory worth keeping close.")}
              </p>
            ) : (
              <p className="mx-auto mt-4 max-w-[620px] text-[24px] font-bold leading-snug" style={{ color: BRAND.muted }}>
                {t("games.scentMemory.skipReflection", "Some memories come quietly. That is fine.")}
              </p>
            )}
            <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full px-5 py-3 text-[22px] font-black" style={{ background: "#FEF3C7", color: "#92400E" }}>
              <Check size={24} aria-hidden="true" />
              {t("games.scentMemory.streakLabel", "{n} days reflecting", { n: userState?.streak_days ?? 1 })}
            </p>
            {saveWarning ? <p className="mt-4 text-[20px] font-bold text-[#92400E]">{saveWarning}</p> : null}
            <button
              type="button"
              onClick={onExit}
              className="mt-7 min-h-[72px] w-full rounded-full px-6 text-[24px] font-black text-white shadow-vyva-card"
              style={{ background: BRAND.purple }}
            >
              {t("common.finish", "Finish")}
            </button>
          </section>
        ) : null}
      </div>
    </main>
  );
}
