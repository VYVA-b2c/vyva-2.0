import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";

const key = ["/api/concierge/notifications/reminders/dismissed"];

export function useConciergeReminderDismissals(enabled = true) {
  const client = useQueryClient();
  const query = useQuery<Record<string, string>>({
    queryKey: key,
    enabled,
    queryFn: async () => {
      const response = await apiFetch(key[0]);
      if (!response.ok) throw new Error("Could not load reminder preferences");
      return response.json();
    },
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async (input: { taskKey: string; revision: string }) => {
      const response = await apiFetch("/api/concierge/notifications/reminders/dismiss", {
        method: "POST", body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Could not dismiss reminder");
      return input;
    },
    onSuccess: input => {
      client.setQueryData<Record<string, string>>(key, previous => ({ ...previous, [input.taskKey]: input.revision }));
      void client.invalidateQueries({ queryKey: ["/api/concierge/notifications"] });
    },
  });
  return {
    ready: query.isSuccess,
    hidden: (taskKey: string, revision: string) => query.data?.[taskKey] === revision,
    dismiss: (taskKey: string, revision: string) => mutation.mutate({ taskKey, revision }),
    pending: mutation.isPending,
    error: mutation.isError,
  };
}
