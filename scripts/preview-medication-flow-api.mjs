import { createServer } from "node:http";

const port = Number(process.env.PORT || 3001);
let takenToday = false;
const previewToday = () => new Date().toISOString().slice(0, 10);
let medicine = {
  id: "med-preview-1",
  display_name: "Metformin",
  dose_text: "500mg once daily with breakfast",
  purpose_text: "Blood sugar support",
  item_type: "prescription",
  drug_class_tag: "diabetes_blood_sugar",
  status: "active",
  dose_unit: "tablet",
  units_per_dose: 1,
  daily_frequency: 1,
  inventory_tracking_enabled: true,
  refill_alert_days: 7,
};
let estimatedQuantity = 18;
let inventoryHistory = [{
  id: "inventory-preview-1",
  type: "stock_count",
  quantity: 18,
  unit: "tablet",
  occurredOn: previewToday(),
  source: "manual",
  updatedBy: "Rosa",
  actorRole: "elder",
}];
let refillAlerts = [];

function refillSummary() {
  const dailyUse = Number(medicine.units_per_dose || 0) * Number(medicine.daily_frequency || 0);
  const daysRemaining = dailyUse > 0 ? Math.max(0, Math.floor(estimatedQuantity / dailyUse)) : null;
  const projected = daysRemaining === null ? null : new Date(Date.now() + daysRemaining * 86400000).toISOString().slice(0, 10);
  const status = daysRemaining === null
    ? "setup_needed"
    : estimatedQuantity <= 0
      ? "refill_now"
      : daysRemaining <= Number(medicine.refill_alert_days || 7)
        ? "refill_soon"
        : "on_track";
  const latest = inventoryHistory[0] || null;
  return {
    medicineId: medicine.id,
    medicineName: medicine.display_name,
    strength: medicine.dose_text,
    doseUnit: medicine.dose_unit,
    unitsPerDose: Number(medicine.units_per_dose),
    dailyFrequency: Number(medicine.daily_frequency),
    refillAlertDays: Number(medicine.refill_alert_days),
    inventoryTrackingEnabled: medicine.inventory_tracking_enabled,
    estimatedQuantity,
    daysRemaining,
    projectedRunOutDate: projected,
    status,
    confidence: "high",
    calculationReason: "Based on your latest confirmed count and daily routine.",
    updatedAt: new Date().toISOString(),
    updatedBy: latest ? { name: latest.updatedBy, role: latest.actorRole } : null,
    history: inventoryHistory,
  };
}

function reconcilePreviewRefillAlerts() {
  const summary = refillSummary();
  if (!["refill_soon", "refill_now", "uncertain"].includes(summary.status)) {
    refillAlerts = [];
    return;
  }
  const cycleKey = inventoryHistory[0]?.id || medicine.id;
  const existing = refillAlerts.find((alert) => alert.cycleKey === cycleKey && alert.status === summary.status);
  if (existing) {
    refillAlerts = [existing];
    return;
  }
  const title = summary.status === "refill_now"
    ? `${medicine.display_name} may have run out`
    : summary.status === "uncertain"
      ? `Check ${medicine.display_name}'s supply`
      : `${medicine.display_name} needs a refill this week`;
  const message = summary.status === "refill_now"
    ? "Update the confirmed supply now. VYVA will not order medicine or contact anyone."
    : summary.status === "uncertain"
      ? "The estimate needs a fresh stock count before VYVA can forecast reliably."
      : `${summary.daysRemaining} days of supply are estimated to remain. Update supply after the next purchase.`;
  refillAlerts = [{
    id: `refill-alert-${cycleKey}-${summary.status}`,
    cycleKey,
    medicineId: medicine.id,
    status: summary.status,
    title,
    message,
    daysRemaining: summary.daysRemaining,
    projectedRunOutDate: summary.projectedRunOutDate,
    createdAt: new Date().toISOString(),
  }];
}

function send(response, body, status = 200) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function bodyOf(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  const path = url.pathname;

  if (path === "/api/auth/me") {
    return send(response, { id: "medication-preview", email: "preview@vyva.local", language: "en", activeProfileId: "preview-profile", role: "user" });
  }
  if (path === "/api/profile") {
    return send(response, { profileId: "preview-profile", firstName: "Rosa", language: "en", gpName: "Dr Garcia", gpPhone: "+34612345678", gpEmail: "gp@example.com" });
  }
  if (path === "/api/profile/readiness") {
    return send(response, { profile: {}, services: { medications: { ready: true, missing: [] }, adherenceReport: { ready: true, missing: [] }, medicationInteractions: { ready: true, missing: [] } } });
  }
  if (path === "/api/profile/personalisation") {
    return send(response, { conditions: ["type 2 diabetes"], hobbies: [], hasMedications: true });
  }
  if (path === "/api/onboarding/state") {
    return send(response, { stage: "complete", profile: { onboarding_completed: true, data_sharing_consent: { providers: { providers: [] } } } });
  }
  if (path === "/api/meds/adherence-report/today") {
    return send(response, { medications: [{ id: medicine.id, medication_name: medicine.display_name, dosage: "500mg", frequency: "once_daily", scheduled_times: ["08:00"], takenToday, takenCountToday: takenToday ? 1 : 0, scheduledCountToday: 1 }] });
  }
  if ((path === "/api/meds/refills/me" || path === "/api/meds/refills/preview-profile") && request.method === "GET") {
    reconcilePreviewRefillAlerts();
    return send(response, { profileId: "preview-profile", actorRole: "elder", permissions: { view_adherence: true, receive_missed_dose_alerts: true, receive_refill_alerts: true, manage_inventory: true }, medicines: [refillSummary()], alerts: refillAlerts });
  }
  if ((path === "/api/meds/refills/me/photo-extract" || path === "/api/meds/refills/preview-profile/photo-extract") && request.method === "POST") {
    await bodyOf(request);
    return send(response, {
      draft: { medicineName: "Metformin", strength: "500mg", packageCount: 1, unitsPerPackage: 28, totalQuantity: 28, doseUnit: "tablet", purchasedOn: previewToday() },
      confidence: "high",
      fieldConfidence: { medicineName: "high", totalQuantity: "high", doseUnit: "high" },
      warnings: [],
      imageRetained: false,
    });
  }
  const refillEventMatch = path.match(/^\/api\/meds\/refills\/(?:me|preview-profile)\/medicines\/([^/]+)\/(purchases|stock-counts)$/);
  if (refillEventMatch && request.method === "POST") {
    const input = await bodyOf(request);
    medicine = {
      ...medicine,
      dose_unit: input.doseUnit,
      units_per_dose: Number(input.unitsPerDose),
      daily_frequency: Number(input.dailyFrequency),
      refill_alert_days: Number(input.refillAlertDays),
      inventory_tracking_enabled: true,
    };
    estimatedQuantity = refillEventMatch[2] === "purchases"
      ? estimatedQuantity + Number(input.quantity)
      : Number(input.quantity);
    inventoryHistory = [{
      id: `inventory-preview-${Date.now()}`,
      type: refillEventMatch[2] === "purchases" ? "purchase" : "stock_count",
      quantity: Number(input.quantity),
      unit: input.doseUnit,
      occurredOn: input.occurredOn,
      source: input.source || "manual",
      updatedBy: "Rosa",
      actorRole: "elder",
    }, ...inventoryHistory].slice(0, 8);
    reconcilePreviewRefillAlerts();
    return send(response, { summary: refillSummary(), alerts: refillAlerts }, 201);
  }
  if (path === "/api/meds/adherence-report/confirm" && request.method === "POST") {
    takenToday = true;
    return send(response, { ok: true });
  }
  if (path === "/api/meds/my-medicines" && request.method === "GET") {
    return send(response, { medicines: [medicine], classTags: ["diabetes_blood_sugar", "other_uncategorized"] });
  }
  if (path === "/api/meds/my-medicines" && request.method === "POST") {
    const input = await bodyOf(request);
    medicine = {
      id: `med-preview-${Date.now()}`,
      display_name: input.display_name,
      dose_text: input.dose_text,
      purpose_text: input.purpose_text,
      item_type: input.item_type || "prescription",
      drug_class_tag: input.drug_class_tag || "other_uncategorized",
      status: "active",
      dose_unit: input.dose_unit,
      units_per_dose: Number(input.units_per_dose),
      daily_frequency: Number(input.daily_frequency),
      inventory_tracking_enabled: Boolean(input.inventory_tracking_enabled),
      refill_alert_days: Number(input.refill_alert_days || 7),
    };
    estimatedQuantity = Number(input.initial_quantity);
    inventoryHistory = [{
      id: `inventory-preview-${Date.now()}`,
      type: "purchase",
      quantity: estimatedQuantity,
      unit: input.dose_unit,
      occurredOn: input.purchased_on,
      source: input.added_via === "photo" ? "photo" : "manual",
      updatedBy: "Rosa",
      actorRole: "elder",
    }];
    reconcilePreviewRefillAlerts();
    return send(response, { medicine }, 201);
  }
  if (path === `/api/meds/my-medicines/${medicine.id}` && request.method === "PATCH") {
    medicine = { ...medicine, ...(await bodyOf(request)) };
    return send(response, { medicine });
  }
  if (path === "/api/meds/interactions") {
    return send(response, { flags: [], hasMore: false, reviewedRuleCount: 6, activeMedicineCount: 1, message: "No questions found in the available checks." });
  }
  if (path === "/api/meds/safety") {
    return send(response, { summary: { status: "steady", severity: "watch", title: "No medication safety signals found", message: "No signals in the available data.", signalCount: 0, openCaseCount: 0, lastAnalysedAt: null }, signalCandidates: [], signals: [], openCases: [], exportAvailability: { canExport: false, readyCount: 0, needsReviewCount: 0 } });
  }
  if (path === "/api/meds/adherence-report") {
    const period = ["weekly", "monthly", "quarterly", "custom"].includes(url.searchParams.get("period"))
      ? url.searchParams.get("period")
      : "weekly";
    const today = new Date().toISOString().slice(0, 10);
    let endDate = today;
    let days = period === "monthly" ? 30 : period === "quarterly" ? 90 : 7;
    if (period === "custom") {
      const requestedStart = url.searchParams.get("start") || today;
      endDate = url.searchParams.get("end") || today;
      const difference = Math.floor((new Date(`${endDate}T00:00:00Z`) - new Date(`${requestedStart}T00:00:00Z`)) / 86400000) + 1;
      days = Math.max(1, Math.min(366, Number.isFinite(difference) ? difference : 1));
    }
    const start = new Date(`${endDate}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - days + 1);
    const startDate = start.toISOString().slice(0, 10);
    const pct = period === "weekly" ? 86 : period === "monthly" ? 82 : period === "quarterly" ? 79 : 81;
    const scheduled = days;
    const taken = Math.round((scheduled * pct) / 100);
    const dailyStatus = Array.from({ length: days }, (_, index) => {
      if (index === days - 1 && !takenToday) return "none";
      return index % 7 === 2 ? "missed" : "taken";
    });
    return send(response, {
      hasLogs: true,
      weekPct: 86,
      monthPct: 82,
      period: { key: period, startDate, endDate, days },
      periodPct: pct,
      rangeDates: [],
      sevenDayDates: [],
      perMedication: [{ name: medicine.display_name, dosage: "500mg", taken, scheduled, streak: 3, dailyStatus }],
    });
  }
  if (path.startsWith("/api/config/features/")) {
    return send(response, { enabled: false, rolloutPercent: 0 });
  }
  if (path === "/api/billing/status") {
    return send(response, { status: "active", tier: "premium", plan: { plan_id: "premium", name: "Premium" } });
  }

  return send(response, {});
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Medication preview API listening on http://127.0.0.1:${port}`);
});
