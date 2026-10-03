import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import { homeServiceText } from "../../shared/homeServiceText";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";

export function DeleteConciergeRequest({ taskKey, title, language, onDeleted }: {
  taskKey: string; title: string; language: string; onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const copy = (text: string) => homeServiceText(language, text);
  const match = /^(draft|pending):(.+)$/.exec(taskKey);
  const deletion = useMutation({
    mutationFn: async () => {
      if (!match) throw new Error("Invalid request");
      const response = await apiFetch(`/api/concierge/tasks/${match[1] === "pending" ? "pending/" : ""}${encodeURIComponent(match[2])}`, { method: "DELETE" });
      if (!response.ok) throw new Error(response.status === 409 ? "This request is being processed. Please try again when it finishes." : "Could not delete request. Please try again.");
    },
    onSuccess: async () => {
      await client.invalidateQueries({ predicate: query => String(query.queryKey[0]).includes("concierge") });
      setOpen(false);
      onDeleted?.();
    },
  });
  if (!match) return null;
  return <>
    <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center text-vyva-text-2" aria-label={`${copy("Delete request")}: ${title}`} title={copy("Delete request")} onClick={() => { deletion.reset(); setOpen(true); }}><Trash2 size={20} aria-hidden="true" /></button>
    <AlertDialog open={open} onOpenChange={value => { if (!deletion.isPending) setOpen(value); }}>
      <AlertDialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg bg-white text-gray-950">
        <AlertDialogTitle>{copy("Delete request")}: {title}?</AlertDialogTitle>
        <AlertDialogDescription className="text-gray-700">{copy("Unsent actions will be cancelled. If a provider has already been contacted, deleting this request does not cancel that contact or booking.")}</AlertDialogDescription>
        {deletion.isError && <p role="alert">{copy(deletion.error.message)}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletion.isPending}>{copy("Keep request")}</AlertDialogCancel>
          <button type="button" disabled={deletion.isPending} onClick={() => deletion.mutate()} className="min-h-11 rounded-md bg-red-700 px-4 text-white disabled:opacity-50">{copy("Delete request")}</button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
