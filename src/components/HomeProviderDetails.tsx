import { MapPin, ExternalLink, Clock } from "lucide-react";
import { homeHelpCopy } from "../../shared/homeHelpCopy";

function publicUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function HomeProviderDetails({ snapshot, isSpanish: es, language }: { snapshot: Record<string, unknown>; isSpanish: boolean; language?: string }) {
  const label = (key: Parameters<typeof homeHelpCopy>[1]) => homeHelpCopy(language ?? (es ? "es" : "en"), key);
  const maps = publicUrl(snapshot.maps_url);
  const website = publicUrl(snapshot.website_url);
  const hours = Array.isArray(snapshot.opening_hours_text)
    ? snapshot.opening_hours_text.filter((line): line is string => typeof line === "string") : [];
  return <div className="mt-3 text-sm text-vyva-text-2">
    <div className="flex flex-wrap gap-x-5 gap-y-1">
      {maps && <a href={maps} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-vyva-purple underline underline-offset-4"><MapPin size={16} aria-hidden="true" />{label("map")}</a>}
      {website && <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-vyva-purple underline underline-offset-4"><ExternalLink size={16} aria-hidden="true" />{label("website")}</a>}
    </div>
    {hours.length > 0 && <details>
      <summary className="min-h-11 cursor-pointer py-3"><Clock size={16} className="mr-2 inline" aria-hidden="true" />{label("hours")}</summary>
      <ul className="space-y-1 pb-3">{hours.map(line => <li key={line}>{line}</li>)}</ul>
    </details>}
    {snapshot.search_area_fallback === true && typeof snapshot.search_area === "string" && <p className="mt-2">{label("near")} {snapshot.search_area}</p>}
  </div>;
}
