import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

const endpoint = "/api/health/scheduled-checkins";

export function ScheduledTelecareCheckins() {
  const { user } = useAuth();
  const [notice, setNotice] = useState("");
  const checkins = useQuery<{ prompts: { id: string; expiresAt: string }[] }>({
    queryKey: [endpoint, user?.id],
    enabled: Boolean(user),
    refetchInterval: 15_000,
    gcTime: 0,
    retry: false,
  });
  const reply = useMutation({
    mutationFn: async (promptId: string) => {
      const response = await apiFetch(endpoint, { method: "POST", body: JSON.stringify({ promptId }) });
      if (!response.ok) throw new Error("Reply failed");
      return response.json() as Promise<{ recorded: boolean }>;
    },
    onSuccess: ({ recorded }) => {
      setNotice(recorded ? "Your check-in reply was recorded." : "This check-in is no longer open.");
      void checkins.refetch();
    },
    onError: () => setNotice("Couldn’t record your reply. Try again."),
  });
  const prompts = checkins.data?.prompts ?? [];
  if (!prompts.length && !notice) return null;
  return <section className="mt-5 space-y-3" aria-label="Scheduled check-ins">
    {prompts.map((prompt) => <div key={prompt.id} className="rounded-2xl border border-[#EFE4F6] bg-white p-4">
      <h2 className="font-body text-base font-bold">Scheduled wellbeing check-in</h2>
      <p className="mt-1 text-sm">Reply to confirm you received this check-in.</p>
      <button type="button" disabled={reply.isPending} onClick={() => reply.mutate(prompt.id)}
        className="mt-3 rounded-xl bg-vyva-purple px-4 py-2 font-bold text-white disabled:opacity-60">
        Reply to check-in
      </button>
    </div>)}
    <p role="status" className="text-sm">{notice}</p>
  </section>;
}
