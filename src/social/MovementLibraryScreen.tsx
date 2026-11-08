import { Accessibility, ChevronDown, ChevronRight, Dumbbell, Footprints, Wind } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CanonicalDetailFlowShell, CanonicalVoiceButton } from "@/components/CanonicalDetailFlowShell";
import { useLanguage } from "@/i18n";
import { MOVEMENT_EXERCISE_VISUALS, getMovementExerciseLanguage, getMovementExerciseLibraryCopy, getNarratedMovementGuide } from "./movementExercises";

export const MOVEMENT_LIBRARY_PATH = "/social-rooms/morning-movement";
export const MOVEMENT_PREVIEW_PATH = "/dev/social-rooms/morning-movement";
const pageCopy = {
  en: { title: "Movement", prompt: "Choose a focus to see its exercises.", exercises: "exercises", start: "Start guide", voice: "Talk to VYVA about movement" },
  es: { title: "Movimiento", prompt: "Elige un enfoque para ver sus ejercicios.", exercises: "ejercicios", start: "Iniciar guía", voice: "Hablar con VYVA sobre movimiento" },
  de: { title: "Bewegung", prompt: "Wähle einen Schwerpunkt, um die Übungen zu sehen.", exercises: "Übungen", start: "Guide starten", voice: "Mit VYVA über Bewegung sprechen" },
  fr: { title: "Mouvement", prompt: "Choisissez un objectif pour voir ses exercices.", exercises: "exercices", start: "Démarrer le guide", voice: "Parler de mouvement avec VYVA" },
  it: { title: "Movimento", prompt: "Scegli un obiettivo per vedere gli esercizi.", exercises: "esercizi", start: "Avvia guida", voice: "Parla di movimento con VYVA" },
  pt: { title: "Movimento", prompt: "Escolha um objetivo para ver os exercícios.", exercises: "exercícios", start: "Iniciar guia", voice: "Falar de movimento com VYVA" },
};
const categoryIcons = { mobility: Accessibility, balance: Footprints, strength: Dumbbell, calm: Wind };
const categoryTones = {
  mobility: "bg-[#F3E8FF] text-[#7024C4]",
  balance: "bg-[#E0F2FE] text-[#0369A1]",
  strength: "bg-[#FFF4CF] text-[#A16207]",
  calm: "bg-[#DCFCE7] text-[#166534]",
};
const shellContract = {
  shellId: "home.production", headerId: "detail.voice-touch", headerTitle: "Movement",
  containerId: "flow.rounded-card", bottomNavId: "home-sos-reports", composer: "hidden",
} as const;

export default function MovementLibraryScreen({ preview = false }: { preview?: boolean }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const focus = searchParams.get("focus");
  const { language } = useLanguage();
  const movementLanguage = getMovementExerciseLanguage(language);
  const copy = pageCopy[movementLanguage];
  const library = getMovementExerciseLibraryCopy(movementLanguage);
  const basePath = preview ? MOVEMENT_PREVIEW_PATH : MOVEMENT_LIBRARY_PATH;

  return (
    <CanonicalDetailFlowShell
      shellContract={{ ...shellContract, headerTitle: copy.title }}
      onBack={() => navigate(preview ? "/dev/home-master/community" : "/social-rooms")}
      shellTestId="movement-library-screen"
      headerAction={<CanonicalVoiceButton agentSlug="wellness" contextHint="Help the user choose a gentle movement exercise from mobility, balance, strength or calm." label={copy.voice} />}
    >
      <p className="mb-5 font-body text-[18px] leading-relaxed text-inherit opacity-80">{copy.prompt}</p>
      <div className="space-y-3">
        {library.groups.map((group) => {
          const Icon = categoryIcons[group.id];
          const exercises = library.cards.filter((exercise) => exercise.group === group.id);
          const expanded = focus === group.id;
          return (
            <section key={group.id} className="overflow-hidden rounded-[24px] border border-[#E8E2F0] bg-white shadow-[0_6px_20px_rgba(80,52,109,0.04)]">
              <h2>
                <button
                  type="button"
                  aria-label={`${group.title} ${exercises.length} ${copy.exercises}`}
                  aria-expanded={expanded}
                  aria-controls={`movement-category-${group.id}`}
                  onClick={() => setSearchParams(expanded ? {} : { focus: group.id }, { replace: true })}
                  className="flex min-h-[88px] w-full items-center gap-4 px-5 py-4 text-left focus-visible:outline focus-visible:outline-4 focus-visible:outline-vyva-purple focus-visible:-outline-offset-4"
                >
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${categoryTones[group.id]}`}><Icon size={23} strokeWidth={2} aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1"><span className="block font-body text-[21px] font-bold text-vyva-text-1">{group.title}</span><span className="mt-1 block font-body text-[15px] text-vyva-text-2">{exercises.length} {copy.exercises}</span></span>
                  <ChevronDown size={21} aria-hidden="true" className={`shrink-0 text-vyva-text-2 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
              </h2>
              <div id={`movement-category-${group.id}`} hidden={!expanded}>
                {expanded ? <div className="border-t border-[#EEE7F3] px-4 pb-2">
                  <p className="px-1 py-4 font-body text-[15px] leading-relaxed text-vyva-text-2">{group.subtitle}</p>
                  {exercises.map((exercise) => (
                    <Link
                      key={exercise.id}
                      to={`${basePath}/exercises/${exercise.id}`}
                      state={{ returnTo: `${basePath}?focus=${group.id}` }}
                      className="mb-2 flex min-h-[96px] items-center gap-4 rounded-[18px] bg-[#FAF7FC] p-3 transition-colors hover:bg-[#F3EAF9] focus-visible:outline focus-visible:outline-4 focus-visible:outline-vyva-purple"
                    >
                      <img src={MOVEMENT_EXERCISE_VISUALS[exercise.id].image} alt="" className="h-[72px] w-[88px] shrink-0 rounded-xl object-cover" />
                      <span className="min-w-0 flex-1"><span className="block font-body text-[19px] font-bold leading-tight text-vyva-text-1">{exercise.title}</span><span className="mt-2 block font-body text-[15px] text-vyva-text-2">{getNarratedMovementGuide(exercise.id, movementLanguage)?.durationLabel ?? "10 min"} · {copy.start}</span></span>
                      <ChevronRight size={20} className="shrink-0 text-vyva-purple" aria-hidden="true" />
                    </Link>
                  ))}
                </div> : null}
              </div>
            </section>
          );
        })}
      </div>
    </CanonicalDetailFlowShell>
  );
}
