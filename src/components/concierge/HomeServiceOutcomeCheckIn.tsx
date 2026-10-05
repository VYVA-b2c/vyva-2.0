import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { homeServiceText } from "../../../shared/homeServiceText";
import { OUTCOME_QUESTIONS, type ProviderOutcomeAnswer } from "../../../shared/providerOutcomes";

interface DueOutcome { requestId: string; providerName: string; serviceType: string | null }
type Answers = Partial<Record<(typeof OUTCOME_QUESTIONS)[number]["key"], string>>;

const DUE_KEY = ["/api/appointments/outcomes/due"];

// One check-in at a time, three taps, skippable. Answers are pooled across
// members so the next search ranks this provider on real visits.
export function HomeServiceOutcomeCheckIn({ language }: { language: string }) {
  const copy = (text: string) => homeServiceText(language, text);
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Answers>({});
  const [thanked, setThanked] = useState(false);
  const due = useQuery({
    queryKey: DUE_KEY,
    queryFn: async () => {
      const response = await apiFetch("/api/appointments/outcomes/due");
      if (!response.ok) return [] as DueOutcome[];
      const data = await response.json() as { items?: DueOutcome[] };
      return Array.isArray(data.items) ? data.items : [];
    },
    staleTime: 60_000,
    retry: false,
  });
  const item = due.data?.[0];
  const save = useMutation({
    mutationFn: async (answer: ProviderOutcomeAnswer) => {
      const response = await apiFetch(`/api/appointments/requests/${item!.requestId}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answer),
      });
      if (!response.ok) throw new Error("Outcome not saved");
    },
    onSuccess: (_data, answer) => {
      setAnswers({});
      if (answer.skipped !== true) setThanked(true);
      void queryClient.invalidateQueries({ queryKey: DUE_KEY });
    },
    onError: () => setAnswers({}),
  });

  if (thanked && !item) return <p className="order-0 rounded-[22px] border border-current/10 px-4 py-3 text-sm text-vyva-text-2" role="status">{copy("Thank you. This helps VYVA suggest better providers.")}</p>;
  if (!item) return null;
  const question = OUTCOME_QUESTIONS.find(q => !answers[q.key]);
  function choose(key: string, value: string) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (OUTCOME_QUESTIONS.every(q => next[q.key])) {
      save.mutate({ arrived: next.arrived, price: next.price, wouldUseAgain: next.wouldUseAgain } as ProviderOutcomeAnswer);
    }
  }
  return <section className="order-0 rounded-[22px] border border-vyva-purple/30 px-4 py-4" data-testid="home-service-outcome-checkin" aria-live="polite">
    <p className="font-semibold text-vyva-text-1">{copy("How did it go with {provider}?").replace("{provider}", item.providerName)}</p>
    {question && <>
      <p className="mt-2 text-sm text-vyva-text-2">{copy(question.en)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {question.options.map(([value, label]) => <button key={value} type="button" disabled={save.isPending}
          className="min-h-[48px] rounded-full border border-vyva-purple/40 px-4 py-2 font-semibold text-vyva-text-1 disabled:opacity-50"
          data-testid={`button-outcome-${question.key}-${value}`} onClick={() => choose(question.key, value)}>{copy(label)}</button>)}
      </div>
    </>}
    {save.isError && <p className="mt-2 text-sm text-vyva-text-2">{copy("Could not save your answer. Please try again.")}</p>}
    <button type="button" disabled={save.isPending} className="mt-3 min-h-11 text-sm text-vyva-purple underline" data-testid="button-outcome-skip"
      onClick={() => save.mutate({ skipped: true })}>{copy("Skip")}</button>
  </section>;
}
