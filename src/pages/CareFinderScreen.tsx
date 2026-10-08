import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { CareFinder, type CareFinderServices } from "@/features/careFinder/CareFinder";
import { fetchCareFinderProfile, searchCareFinder } from "@/features/careFinder/api";
import { loadCareFinderTask, useCareFinderTaskPersistence, type CareFinderLoadResult } from "@/features/careFinder/useCareFinderTask";
import { careFinderCopy } from "@/features/careFinder/copy";
import { formatDateOnly } from "@/features/careFinder/ResultsStep";
import { CARE_NEEDS, CARE_TYPES, careFinderLang, pick, type CareFinderLang } from "../../shared/careFinder/careRoutes";
import type { CareFinderState } from "../../shared/careFinder/flow";
import type { CareFinderResultOption } from "../../shared/careFinder/search";
import { CARE_FINDER_PATH, careFinderTaskPath } from "@/lib/careFinderNavigation";
import "@/features/careFinder/careFinder.css";

const services: CareFinderServices = { search: searchCareFinder };

const FRESH: CareFinderLoadResult = { state: undefined, taskId: null, resumeCandidate: null, closedNotice: false };

function rideMessage(option: CareFinderResultOption, state: CareFinderState, isSpanish: boolean): string {
  const care = state.careType ? pick(isSpanish ? "es" : "en", CARE_TYPES[state.careType].label) : option.category;
  const details = [option.name, care, option.address, option.phone].filter(Boolean).join("\n");
  return isSpanish
    ? `Ayúdame a preparar transporte seguro para esta visita. Confirma conmigo antes de reservar.\n\n${details}`
    : `Help me prepare safe transport for this visit. Ask me to confirm before booking.\n\n${details}`;
}

function CareFinderSession({
  loaded,
  lang,
  theme,
  onStartNew,
  onResume,
}: {
  loaded: CareFinderLoadResult;
  lang: CareFinderLang;
  theme: "light" | "dark";
  onStartNew: () => void;
  onResume: (candidate: NonNullable<CareFinderLoadResult["resumeCandidate"]>) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const copy = useMemo(() => careFinderCopy(lang), [lang]);
  const profileQuery = useQuery({ queryKey: ["/api/profile", "care-finder"], queryFn: fetchCareFinderProfile, staleTime: 30_000 });
  const onTaskCreated = useCallback((taskId: string) => {
    // Keep the URL resumable without remounting the conversation.
    window.history.replaceState(window.history.state, "", careFinderTaskPath(taskId));
  }, []);
  const persistence = useCareFinderTaskPersistence({ initialTaskId: loaded.taskId, language: lang, onTaskCreated });
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "/health";

  const resume = loaded.resumeCandidate;
  const resumeOffer = resume ? {
    about: resume.state.description
      ? `“${resume.state.description.slice(0, 60)}”`
      : resume.state.need ? pick(lang, CARE_NEEDS[resume.state.need].label).toLowerCase() : "",
    when: formatDateOnly(resume.updatedAt, lang),
    onContinue: () => onResume(resume),
  } : null;

  return (
    <CareFinder
      lang={lang}
      theme={theme}
      profile={profileQuery.data ?? null}
      services={services}
      initialState={loaded.state}
      resumeOffer={resumeOffer}
      notice={loaded.closedNotice ? copy.closed : null}
      saveStatus={persistence.status}
      onStateChange={persistence.save}
      onExit={() => navigate(returnTo)}
      onArrangeRide={(option, state) => navigate("/concierge", {
        state: { conciergePrefill: { kind: "ride", source: "specialist_finder", message: rideMessage(option, state, lang === "es") } },
      })}
      onStartNew={onStartNew}
      onHealthHome={() => navigate("/health")}
    />
  );
}

export default function CareFinderScreen() {
  const { taskId } = useParams<{ taskId?: string }>();
  const { language } = useLanguage();
  const { isDark } = useHomeMasterTheme();
  const lang = careFinderLang(language);
  const copy = useMemo(() => careFinderCopy(lang), [lang]);
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<CareFinderLoadResult | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const theme = isDark ? "dark" : "light";

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setLoadError(false);
    loadCareFinderTask(taskId)
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, taskId]);

  const replaceSession = useCallback((next: CareFinderLoadResult) => {
    setLoaded(next);
    setSessionKey((value) => value + 1);
  }, []);

  const startNew = useCallback(() => {
    if (taskId) navigate(CARE_FINDER_PATH, { replace: true });
    else window.history.replaceState(window.history.state, "", CARE_FINDER_PATH);
    replaceSession(FRESH);
  }, [navigate, replaceSession, taskId]);

  const resume = useCallback((candidate: NonNullable<CareFinderLoadResult["resumeCandidate"]>) => {
    if (candidate.taskId) {
      navigate(careFinderTaskPath(candidate.taskId), { replace: true });
      return;
    }
    replaceSession({ ...FRESH, state: candidate.state });
  }, [navigate, replaceSession]);

  if (!loaded) {
    return (
      <div className="care-finder flex min-h-[60vh] w-full items-center justify-center p-6" data-care-finder-theme={theme} data-testid="care-finder-loading">
        {loadError ? (
          <div role="alert" className="max-w-[520px] space-y-4 text-center text-[20px]">
            <p>{copy.results.offline}</p>
            <button type="button" className="min-h-[56px] rounded-full bg-[var(--cf-accent)] px-6 font-semibold text-[var(--cf-on-accent)]" onClick={() => setReloadKey((value) => value + 1)}>
              {copy.results.retry}
            </button>
          </div>
        ) : (
          <p role="status" className="flex items-center gap-3 text-[20px]">
            <Loader2 size={26} className="motion-safe:animate-spin" aria-hidden="true" />
            {copy.loading}
          </p>
        )}
      </div>
    );
  }

  return (
    <CareFinderSession
      key={`${sessionKey}:${taskId ?? "new"}`}
      loaded={loaded}
      lang={lang}
      theme={theme}
      onStartNew={startNew}
      onResume={resume}
    />
  );
}
