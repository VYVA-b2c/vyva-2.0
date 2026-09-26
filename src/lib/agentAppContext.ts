type AgentAppEventType = "page_change" | "button_click" | "context_update";

type AgentAppEvent = {
  type: AgentAppEventType;
  label: string;
  path: string;
  timestamp: number;
};

type AgentAppContextListener = (message: string, event: AgentAppEvent) => void;

const MAX_RECENT_EVENTS = 12;
const listeners = new Set<AgentAppContextListener>();

let currentPath = "/";
let recentEvents: AgentAppEvent[] = [];

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function pageNameFromPath(path: string): string {
  const pathname = path.split("?")[0] || "/";
  if (pathname === "/") return "Home";
  return pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[-_]/g, " "))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" > ");
}

function formatEvent(event: AgentAppEvent): string {
  const pageName = pageNameFromPath(event.path);
  if (event.type === "page_change") {
    return `Opened ${pageName} (${event.path})`;
  }
  if (event.type === "context_update") return event.label;
  return `Clicked "${event.label}" on ${pageName} (${event.path})`;
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  } catch {
    return "local";
  }
}

function timeOfDay(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function getUserLocalTimeContext(now = new Date()): Record<string, string> {
  const hour = now.getHours();
  const minute = now.getMinutes();

  return {
    current_user_time_iso: now.toISOString(),
    current_user_local_date: [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-"),
    current_user_local_time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    current_user_weekday: now.toLocaleDateString(undefined, { weekday: "long" }),
    current_user_timezone: browserTimeZone(),
    current_user_time_of_day: timeOfDay(hour),
  };
}

function pushEvent(event: AgentAppEvent) {
  currentPath = event.path;
  recentEvents = [event, ...recentEvents].slice(0, MAX_RECENT_EVENTS);
  const message = [
    "App context update:",
    formatEvent(event),
    "Use this as silent context for the conversation; do not narrate the navigation unless it helps the user.",
  ].join("\n");

  listeners.forEach((listener) => listener(message, event));
}

export function getCurrentAppPath(): string {
  return currentPath;
}

export function recordAgentPageChange(path: string) {
  const cleanPath = cleanText(path) || "/";
  if (recentEvents[0]?.type === "page_change" && recentEvents[0].path === cleanPath) return;

  pushEvent({
    type: "page_change",
    label: pageNameFromPath(cleanPath),
    path: cleanPath,
    timestamp: Date.now(),
  });
}

export function recordAgentButtonClick(input: { label: string; path: string }) {
  const label = cleanText(input.label);
  if (!label) return;

  pushEvent({
    type: "button_click",
    label,
    path: cleanText(input.path) || currentPath,
    timestamp: Date.now(),
  });
}

export function recordAgentContextUpdate(input: { summary: string; path?: string }) {
  const summary = (input.summary ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);
  if (!summary) return;
  if (recentEvents[0]?.type === "context_update" && recentEvents[0].label === summary) return;
  pushEvent({
    type: "context_update",
    label: summary,
    path: cleanText(input.path) || currentPath,
    timestamp: Date.now(),
  });
}

export function getAgentAppContextSummary(): string {
  const lines = [
    `Current app page: ${pageNameFromPath(currentPath)} (${currentPath})`,
    "Recent user activity:",
    ...recentEvents.slice(0, 6).map((event) => `- ${formatEvent(event)}`),
  ];

  return lines.join("\n");
}

export function getAgentAppContextVariables(): Record<string, string> {
  return {
    ...getUserLocalTimeContext(),
    current_app_page: currentPath,
    recent_app_activity: recentEvents.slice(0, 6).map(formatEvent).join(" | "),
    app_context: getAgentAppContextSummary(),
  };
}

export function subscribeAgentAppContext(listener: AgentAppContextListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
