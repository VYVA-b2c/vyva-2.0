import { useState } from "react";
import { DeleteConciergeRequest } from "./DeleteConciergeRequest";
import { ChevronRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { homeServiceText } from "../../shared/homeServiceText";
import type { conciergeTaskReminder } from "@/lib/conciergeTaskReminder";

type Reminder = ReturnType<typeof conciergeTaskReminder>;
export function ConciergeRequestUpdates({ reminders, language, dismiss, pending, navigationTestId, embedded = false }: {
  reminders: Reminder[]; language: string;
  dismiss: (inputs: { taskKey: string; revision: string }[]) => void;
  pending: boolean;
  navigationTestId?: string;
  embedded?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const copy = (text: string) => homeServiceText(language, text);
  if (!reminders.length) return null;
  const close = (items: Reminder[]) => dismiss(items.flatMap(item => item.aliases.map(taskKey => ({ taskKey, revision: item.revision }))));
  const label = reminders.length === 1 ? `${reminders[0].title}: ${reminders[0].action}`
    : copy(reminders.every(item => item.hasUpdate) ? "{count} requests have updates" : "{count} requests to review").replace("{count}", String(reminders.length));
  return <section className={embedded ? "border-t border-vyva-border px-4 md:px-5 text-vyva-text-1" : "mb-4 border-b border-vyva-border"} data-testid="request-updates">
    <div className="flex items-center gap-2">
      <button type="button" data-testid={navigationTestId} className="min-h-14 min-w-0 flex-1 py-3 text-left font-bold" aria-expanded={reminders.length > 1 ? expanded : undefined}
        onClick={() => reminders.length === 1 ? navigate(reminders[0].path) : setExpanded(value => !value)}>
        {label}<ChevronRight className={`ml-2 inline transition-transform ${expanded ? "rotate-90" : ""}`} size={18} aria-hidden="true" />
      </button>
      {reminders.length === 1 && <DeleteConciergeRequest taskKey={reminders[0].taskKey} title={reminders[0].title} language={language} />}
      <button type="button" disabled={pending} onClick={() => close(reminders)} className="flex h-11 w-11 shrink-0 items-center justify-center" aria-label={copy("Dismiss reminder")} title={copy("Dismiss reminder")}><X size={20} /></button>
    </div>
    {expanded && reminders.length > 1 && <ul>
      {reminders.map(item => <li key={item.taskKey} className="flex items-center gap-2 border-t border-vyva-border">
        <button type="button" className="min-h-14 min-w-0 flex-1 py-3 text-left" onClick={() => navigate(item.path)}>{item.title}: {item.action}</button>
        <DeleteConciergeRequest taskKey={item.taskKey} title={item.title} language={language} />
        <button type="button" disabled={pending} onClick={() => close([item])} className="flex h-11 w-11 shrink-0 items-center justify-center" aria-label={`${copy("Dismiss reminder")}: ${item.title}`} title={copy("Dismiss reminder")}><X size={20} /></button>
      </li>)}
    </ul>}
  </section>;
}
