type AgentAppEventType = "page_change" | "button_click";

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
  return `Clicked "${event.label}" on ${pageName} (${event.path})`;
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
    current_app_page: currentPath,
    recent_app_activity: recentEvents.slice(0, 6).map(formatEvent).join(" | "),
    app_context: getAgentAppContextSummary(),
  };
}

export function subscribeAgentAppContext(listener: AgentAppContextListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
