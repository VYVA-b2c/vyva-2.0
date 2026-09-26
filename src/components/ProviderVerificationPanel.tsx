import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import { currentVerification, type ProviderVerification } from "../../shared/providerVerification";

interface Option { id: string; provider_source?: string; provider_snapshot: Record<string, unknown> }
interface Props {
  requestId: string;
  options: Option[];
  selectedId: string | null;
  isSpanish: boolean;
  onResultsVisible: (visible: boolean) => void;
}

export function ProviderVerificationPanel({ requestId, options, selectedId, isSpanish: es, onResultsVisible }: Props) {
  const [results, setResults] = useState<Record<string, ProviderVerification>>({});
  const resultsRef = useRef(results);
  const [phase, setPhase] = useState<"checking" | "choice" | "results">("checking");
  const [round, setRound] = useState(0);
  const [message, setMessage] = useState(0);
  const optionIds = options.slice(0, 3).map(o => o.id).join(",");
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    const ids = optionIds.split(",").filter(Boolean);
    let disposed = false;
    const controller = new AbortController();
    const next = Object.fromEntries(ids.flatMap(id => {
      const option = latest.current.find(o => o.id === id);
      const privateContact: ProviderVerification | null = option?.provider_source === "saved" || option?.provider_source === "manual"
        ? { version: 1, status: "incomplete", checkedAt: new Date().toISOString(), reviewCount: 0, recentReviewCount: 0, sources: [], gaps: [es ? "Este contacto no se ha enviado a servicios externos de investigacion." : "This contact has not been sent to external research services."], concerns: [], retryable: false } : null;
      const existing = resultsRef.current[id] ?? currentVerification(option?.provider_snapshot.verification) ?? privateContact;
      return existing && !existing.retryable ? [[id, existing]] : [];
    }));
    resultsRef.current = next;
    setResults(next);
    setPhase("checking");
    onResultsVisible(false);
    const deadline = setTimeout(() => {
      if (disposed) return;
      controller.abort();
      clearInterval(interval);
      setPhase("choice");
    }, 120000);
    const interval = setInterval(() => setMessage(m => (m + 1) % 3), 4000);
    void Promise.all(ids.filter(id => !next[id]).map(async id => {
      try {
        const response = await apiFetch(`/api/appointments/requests/${requestId}/options/${id}/verify`, { method: "POST", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        const result = currentVerification(data.verification);
        if (!result || disposed || controller.signal.aborted) return;
        resultsRef.current = { ...resultsRef.current, [id]: result };
        setResults(resultsRef.current);
      } catch { /* Failed checks stay incomplete; never award verification. */ }
    })).then(() => {
      if (disposed || controller.signal.aborted) return;
      clearTimeout(deadline);
      clearInterval(interval);
      if (ids.some(id => !resultsRef.current[id] || resultsRef.current[id].retryable)) setPhase("choice");
      else { setPhase("results"); onResultsVisible(true); }
    });
    return () => { disposed = true; controller.abort(); clearTimeout(deadline); clearInterval(interval); };
  }, [requestId, optionIds, round, onResultsVisible, es]);

  if (phase === "checking") return <section className="py-10 text-center text-vyva-text-1" aria-live="polite" data-testid="provider-verification-loading">
    <Loader2 className="mx-auto mb-4 animate-spin text-vyva-purple motion-reduce:animate-none" size={28} aria-hidden="true" />
    <h3 className="text-xl font-semibold">{es ? "Comprobando proveedores" : "Checking providers"}</h3>
    <p className="mx-auto mt-3 min-h-12 max-w-md text-sm text-vyva-text-2">{(es
      ? ["Contrastamos la identidad y los servicios con fuentes publicas.", "Buscamos opiniones recientes y posibles problemas recurrentes.", "Solo verificamos lo que podemos respaldar con pruebas."]
      : ["Cross-checking business identity and services against public sources.", "Looking for recent reviews and recurring concerns.", "Only evidence-backed checks count toward verification."])[message]}</p>
  </section>;
  if (phase === "choice") return <section className="py-8 text-vyva-text-1" aria-live="polite">
    <h3 className="text-lg font-semibold">{es ? "Algunas comprobaciones siguen incompletas" : "Some checks are still incomplete"}</h3>
    <p className="mt-2 text-sm text-vyva-text-2">{es ? "Puedes ver las opciones o dedicar hasta dos minutos mas a las comprobaciones." : "See the available options, or allow up to two more minutes for checks."}</p>
    <div className="mt-5 flex flex-wrap gap-4">
      <button type="button" className="min-h-11 rounded-full bg-vyva-purple px-5 py-2 font-semibold text-white" onClick={() => { setPhase("results"); onResultsVisible(true); }}>{es ? "Ver resultados ahora" : "Show results now"}</button>
      <button type="button" className="min-h-11 px-2 font-semibold text-vyva-purple" onClick={() => setRound(n => n + 1)}>{es ? "Seguir comprobando" : "Keep checking"}</button>
    </div>
  </section>;
  const result = selectedId ? results[selectedId] : null;
  return <section className="mt-4 text-sm text-vyva-text-2" data-testid="provider-verification-result">
    <p className="font-semibold text-vyva-text-1">{result?.status === "verified" ? (es ? "Verificado" : "Verified") : result?.status === "concerns" ? (es ? "Aspectos a revisar" : "Concerns found") : (es ? "Comprobaciones incompletas" : "Checks incomplete")}</p>
    <details className="mt-2">
      <summary className="cursor-pointer py-2 text-vyva-purple">{es ? "Que hemos comprobado" : "What we checked"}</summary>
      <p>{es ? "Identidad, servicio y opiniones disponibles. No garantiza calidad ni disponibilidad." : "Business identity, service fit and available reviews. Not a guarantee of quality or availability."}</p>
      {result && <p className="mt-2">{result.reviewCount} {es ? "opiniones con fecha; recientes:" : "dated reviews; recent:"} {result.recentReviewCount}</p>}
      {result?.gaps.map((gap, i) => <p className="mt-2" key={`gap-${i}`}>{gap}</p>)}
      {result?.concerns.map((concern, i) => <p className="mt-2" key={`concern-${i}`}>{concern}</p>)}
      {result?.sources.map(url => <a className="mt-2 block break-words text-vyva-purple underline" key={url} href={url} target="_blank" rel="noopener noreferrer">{url}</a>)}
      {result && <p className="mt-2">{es ? "Comprobado:" : "Checked:"} {new Date(result.checkedAt).toLocaleDateString()}</p>}
    </details>
  </section>;
}
