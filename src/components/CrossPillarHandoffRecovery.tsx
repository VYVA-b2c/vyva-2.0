import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  ClipboardCheck,
  RotateCcw,
  UserRoundSearch,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  CROSS_PILLAR_HANDOFF_EVENT,
  chooseAnotherCrossPillarProvider,
  continueCrossPillarHandoffManually,
  getCrossPillarRecoveryPlan,
  readCrossPillarHandoff,
  retryCrossPillarHandoff,
  saveCrossPillarHandoffForLater,
  type CrossPillarHandoffRecord,
} from "@/lib/crossPillarHandoffExecution";
import type { CrossPillarRecoveryAction } from "../../shared/crossPillarExecutionRecovery";

type RecoveryCopy = {
  title: string;
  message: string;
  autoRetry: string;
  actions: Record<CrossPillarRecoveryAction, string>;
};

const COPY: Record<string, RecoveryCopy> = {
  en: {
    title: "Your request is safe",
    message: "That step did not finish, but your details are saved.",
    autoRetry: "VYVA is trying that safe step once more.",
    actions: {
      retry: "Try again",
      choose_provider: "Choose another provider",
      continue_manual: "Continue manually",
      save_later: "Save for later",
    },
  },
  es: {
    title: "Tu solicitud está segura",
    message: "Ese paso no terminó, pero tus datos están guardados.",
    autoRetry: "VYVA está intentando ese paso seguro una vez más.",
    actions: {
      retry: "Intentar de nuevo",
      choose_provider: "Elegir otro proveedor",
      continue_manual: "Continuar manualmente",
      save_later: "Guardar para después",
    },
  },
  fr: {
    title: "Votre demande est en sécurité",
    message: "Cette étape n’a pas abouti, mais vos informations sont enregistrées.",
    autoRetry: "VYVA réessaie cette étape sûre une fois.",
    actions: {
      retry: "Réessayer",
      choose_provider: "Choisir un autre prestataire",
      continue_manual: "Continuer manuellement",
      save_later: "Enregistrer pour plus tard",
    },
  },
  de: {
    title: "Ihre Anfrage ist sicher",
    message: "Dieser Schritt wurde nicht beendet, aber Ihre Angaben sind gespeichert.",
    autoRetry: "VYVA versucht diesen sicheren Schritt noch einmal.",
    actions: {
      retry: "Erneut versuchen",
      choose_provider: "Anderen Anbieter wählen",
      continue_manual: "Manuell fortfahren",
      save_later: "Für später speichern",
    },
  },
  it: {
    title: "La tua richiesta è al sicuro",
    message: "Questo passaggio non è terminato, ma i tuoi dati sono salvati.",
    autoRetry: "VYVA riprova una volta questo passaggio sicuro.",
    actions: {
      retry: "Riprova",
      choose_provider: "Scegli un altro fornitore",
      continue_manual: "Continua manualmente",
      save_later: "Salva per dopo",
    },
  },
  pt: {
    title: "O seu pedido está seguro",
    message: "Este passo não terminou, mas os seus dados estão guardados.",
    autoRetry: "A VYVA está a tentar este passo seguro mais uma vez.",
    actions: {
      retry: "Tentar novamente",
      choose_provider: "Escolher outro prestador",
      continue_manual: "Continuar manualmente",
      save_later: "Guardar para mais tarde",
    },
  },
};

const ACTION_ICONS = {
  retry: RotateCcw,
  choose_provider: UserRoundSearch,
  continue_manual: ClipboardCheck,
  save_later: Bookmark,
} satisfies Record<CrossPillarRecoveryAction, typeof RotateCcw>;

function language(locale?: string): string {
  const code = (locale || document.documentElement.lang || navigator.language || "en")
    .toLowerCase()
    .split("-")[0];
  return COPY[code] ? code : "en";
}

export default function CrossPillarHandoffRecovery() {
  const navigate = useNavigate();
  const [handoff, setHandoff] = useState<CrossPillarHandoffRecord | null>(
    () => readCrossPillarHandoff(),
  );

  useEffect(() => {
    const refresh = () => setHandoff(readCrossPillarHandoff());
    window.addEventListener(CROSS_PILLAR_HANDOFF_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CROSS_PILLAR_HANDOFF_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const plan = useMemo(
    () => handoff?.status === "failed" ? getCrossPillarRecoveryPlan(handoff) : null,
    [handoff],
  );

  useEffect(() => {
    if (!handoff || handoff.status !== "failed" || !plan?.autoRetryAllowed) return;
    const timer = window.setTimeout(() => {
      retryCrossPillarHandoff(handoff.id, navigate, undefined, { automatic: true });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [handoff, navigate, plan]);

  if (!handoff || handoff.status !== "failed" || !plan) return null;

  const copy = COPY[language(handoff.locale)];
  const runAction = (action: CrossPillarRecoveryAction) => {
    if (action === "retry") retryCrossPillarHandoff(handoff.id, navigate);
    if (action === "choose_provider") chooseAnotherCrossPillarProvider(handoff.id, navigate);
    if (action === "continue_manual") continueCrossPillarHandoffManually(handoff.id, navigate);
    if (action === "save_later") saveCrossPillarHandoffForLater(handoff.id);
  };

  return (
    <aside
      aria-live="polite"
      className="fixed inset-x-3 bottom-[104px] z-[80] mx-auto max-w-[560px] rounded-lg border border-[#E6D8F4] bg-white p-4 shadow-[0_16px_44px_rgba(35,18,61,0.18)] sm:p-5"
      data-testid="cross-pillar-handoff-recovery"
    >
      <h2 className="text-xl font-bold text-[#25152F]">{copy.title}</h2>
      <p className="mt-1 text-base leading-relaxed text-[#66576B]">
        {plan.autoRetryAllowed ? copy.autoRetry : copy.message}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {plan.actions.map((action) => {
          const Icon = ACTION_ICONS[action];
          return (
            <button
              key={action}
              type="button"
              className={
                action === "retry"
                  ? "vyva-primary-action min-h-[54px] justify-start px-4 text-sm"
                  : "vyva-secondary-action min-h-[54px] justify-start px-4 text-sm"
              }
              onClick={() => runAction(action)}
            >
              <Icon aria-hidden="true" className="mr-2 h-5 w-5 shrink-0" />
              {copy.actions[action]}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
