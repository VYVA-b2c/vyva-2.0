const CRITERIA_LABELS: Record<string, string> = {
  fastest: "fastest available help",
  trusted: "a trusted provider",
  lowest_cost: "lower cost",
  highest_rated: "highest rated",
};

export function homeServiceContactSummaryLines(payload: Record<string, unknown>): string[] {
  const service = typeof payload.service_label === "string" ? payload.service_label.trim() : "";
  const urgency = typeof payload.urgency === "string" ? payload.urgency.trim().replaceAll("_", " ") : "";
  const requestedTime = typeof payload.requested_time === "string" ? payload.requested_time.trim() : "";
  const criteria = Array.isArray(payload.criteria)
    ? payload.criteria
        .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
        .map((value) => CRITERIA_LABELS[value] ?? value.replaceAll("_", " "))
    : [];
  return [
    service ? `Service: ${service}` : "",
    urgency ? `Urgency: ${urgency}` : "",
    requestedTime ? `Preferred timing: ${requestedTime}` : "",
    criteria.length ? `Priorities: ${criteria.join(", ")}` : "",
  ].filter(Boolean);
}
