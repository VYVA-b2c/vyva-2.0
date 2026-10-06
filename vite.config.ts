import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { readFileSync } from "node:fs";
import path from "path";
import type { IncomingMessage, ServerResponse } from "http";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version?: string };

const appVersion = process.env.VITE_APP_VERSION || packageJson.version || "0.0.0";
const localApiUnavailableMessage =
  "Local API is not running. Start the backend on port 3001 and make sure DATABASE_URL is set.";

type HomeMasterPreviewQuickAnswer = {
  id: string;
  label: string;
  value: string;
  icon:
    | "heart"
    | "wind"
    | "thermometer"
    | "activity"
    | "alert"
    | "help"
    | "calendar"
    | "calendar_range"
    | "calendar_clock"
    | "trend_up"
    | "bed"
    | "check"
    | "face";
  tone: "red" | "amber" | "purple" | "green" | "blue";
  kind: string;
};

function previewAnswer(
  id: string,
  label: string,
  value: string,
  icon: HomeMasterPreviewQuickAnswer["icon"],
  tone: HomeMasterPreviewQuickAnswer["tone"],
  kind: string,
): HomeMasterPreviewQuickAnswer {
  return { id, label, value, icon, tone, kind };
}

function homeMasterPreviewPlan(stage: string, focus: string, isFrench: boolean) {
  const frenchFocus: Record<string, string> = {
    "A clear home-monitoring plan.": "Un plan clair de surveillance à domicile.",
    "Confirming the answers before guidance.": "Confirmation des réponses avant les conseils.",
    "Checking one related detail.": "Vérification d’un détail associé.",
    "Checking when the change began.": "Vérification du moment où le changement a commencé.",
    "Checking symptom strength.": "Évaluation de l’intensité du symptôme.",
    "Checking urgent breathing warning signs.": "Vérification des signes d’alerte respiratoires urgents.",
  };

  return {
    protocolId: "breathing",
    protocolLabel: isFrench ? "Changements respiratoires" : "Breathing changes",
    stage,
    priorityLabel: isFrench ? "Vérification guidée par VYVA" : "VYVA guided check",
    nextQuestionFocus: isFrench ? (frenchFocus[focus] ?? focus) : focus,
    confidence: {
      score: 4,
      label: isFrench ? "Confiance solide" : "Strong confidence",
      reasons: isFrench
        ? ["symptôme décrit", "questions de sécurité renseignées"]
        : ["symptom described", "safety answers reviewed"],
      missing: [],
    },
    profileContextUsed: false,
    usefulSignals: [],
  };
}

function homeMasterPreviewTriageResponse(payload: Record<string, unknown>) {
  const isFrench = String(payload.locale ?? "en").split("-")[0].toLowerCase() === "fr";
  const wizard = payload.wizard && typeof payload.wizard === "object"
    ? payload.wizard as Record<string, unknown>
    : {};
  const answers = Array.isArray(wizard.quickAnswers)
    ? wizard.quickAnswers.filter((answer): answer is Record<string, unknown> => Boolean(answer) && typeof answer === "object")
    : [];
  const hasKind = (kind: string) => answers.some((answer) => answer.kind === kind);

  if (hasKind("support")) {
    const summaryContent = isFrench
      ? "Vos réponses permettent une surveillance à domicile pour le moment, avec des signes précis qui doivent faire changer le plan."
      : "Your answers fit home monitoring for now, with clear signs that should change the plan.";
    return {
      role: "assistant",
      content: summaryContent,
      done: true,
      quickReplies: [],
      wizardStage: "complete",
      wizardStageLabel: "Summary",
      wizardSymptomId: "breathing",
      guidancePlan: homeMasterPreviewPlan("complete", "A clear home-monitoring plan.", isFrench),
      evidenceSources: [],
      summary: {
        chiefComplaint: isFrench ? "Ma respiration est différente" : "Breathing feels different",
        symptoms: [isFrench ? "Respiration différente" : "Breathing feels different"],
        urgency: "monitor",
        recommendations: isFrench
          ? [
              "Surveillez votre état à domicile et gardez un moyen de contacter un médecin.",
              "Vérifiez vos constantes si vous disposez d’un appareil fiable.",
              "Demandez une aide urgente si vous avez du mal à respirer au repos.",
            ]
          : [
              "Monitor at home and keep doctor access ready.",
              "Check your vitals if a reliable device is available.",
              "Seek urgent help if breathing becomes difficult at rest.",
            ],
        disclaimer: isFrench
          ? "Ce rapport est fourni à titre informatif et ne remplace pas un diagnostic ou un avis médical."
          : "This report is for informational purposes only and does not replace medical diagnosis or treatment.",
        aiSummary: summaryContent,
        nextStepLabel: isFrench
          ? "Surveillez votre état à domicile et gardez un accès à un médecin"
          : "Monitor at home, with doctor access ready",
        nextStepLevel: "monitor",
        triageReasons: [isFrench
          ? "Aucun signe d’alerte urgent n’a été sélectionné et le symptôme est léger."
          : "No emergency warning sign was selected and the symptom is mild."],
        watchSigns: [isFrench
          ? "La respiration devient difficile au repos."
          : "Breathing becomes difficult at rest."],
        profileConsiderations: [],
        vitalsNotes: [],
        scanResults: [],
        scanNotes: [],
      },
    };
  }

  if (hasKind("trend")) {
    return {
      role: "assistant",
      content: "Does this look right?",
      done: false,
      quickReplies: [
        previewAnswer("edit_answers", "Edit", "Edit my answers.", "help", "purple", "action"),
        previewAnswer("confirm_review", "Yes, show my guidance", "Yes, show my guidance.", "check", "green", "support"),
      ],
      wizardStage: "support",
      wizardStageLabel: "Review answers",
      wizardSymptomId: "breathing",
      guidancePlan: homeMasterPreviewPlan("support", "Confirming the answers before guidance.", isFrench),
      evidenceSources: [],
    };
  }

  if (hasKind("duration")) {
    return {
      role: "assistant",
      content: "One more detail",
      done: false,
      quickReplies: [
        previewAnswer("new_or_worse", "It is new or suddenly worse today", "It is new or suddenly worse today.", "trend_up", "amber", "trend"),
        previewAnswer("fever_or_cough", "It comes with fever, cough, or more phlegm", "It comes with fever, cough, or more phlegm.", "thermometer", "amber", "trend"),
        previewAnswer("worse_flat", "It is worse lying flat, or my ankles are swollen", "It is worse lying flat, or my ankles are swollen.", "bed", "purple", "trend"),
        previewAnswer("mild_improving", "It is mild, usual for me, and improving", "It is mild, usual for me, and improving.", "check", "green", "trend"),
      ],
      wizardStage: "trend",
      wizardStageLabel: "What changed",
      wizardSymptomId: "breathing",
      guidancePlan: homeMasterPreviewPlan("trend", "Checking one related detail.", isFrench),
      evidenceSources: [],
    };
  }

  if (hasKind("severity")) {
    return {
      role: "assistant",
      content: "When did the breathing change start?",
      done: false,
      quickReplies: [
        previewAnswer("today", "New today", "It started today.", "calendar", "purple", "duration"),
        previewAnswer("few_days", "Few days", "It started a few days ago.", "calendar_range", "purple", "duration"),
        previewAnswer("week_or_more", "A week or more", "It started a week or more ago.", "calendar_clock", "purple", "duration"),
        previewAnswer("duration_unsure", "I am not sure", "I am not sure when it started.", "help", "purple", "duration"),
      ],
      wizardStage: "duration",
      wizardStageLabel: "When it started",
      wizardSymptomId: "breathing",
      guidancePlan: homeMasterPreviewPlan("duration", "Checking when the change began.", isFrench),
      evidenceSources: [],
    };
  }

  if (hasKind("red_flag")) {
    return {
      role: "assistant",
      content: "How strong is it?",
      done: false,
      quickReplies: Array.from({ length: 11 }, (_, value) =>
        previewAnswer(`severity_${value}`, String(value), `My symptom severity is ${value} out of 10.`, "activity", "purple", "severity"),
      ),
      wizardStage: "severity",
      wizardStageLabel: "More details",
      wizardSymptomId: "breathing",
      guidancePlan: homeMasterPreviewPlan("severity", "Checking symptom strength.", isFrench),
      evidenceSources: [],
    };
  }

  return {
    role: "assistant",
    content: "How is your breathing right now?",
    done: false,
    quickReplies: [
      previewAnswer("cannot_speak", "Gasping or cannot speak", "I am gasping or cannot speak.", "wind", "red", "red_flag"),
      previewAnswer("blue_or_confused", "Blue, grey, pale, or confused", "I look blue, grey, pale, or confused.", "face", "red", "red_flag"),
      previewAnswer("worse_can_speak", "Worse than usual, but I can speak", "It is worse than usual, but I can speak.", "trend_up", "amber", "red_flag"),
      previewAnswer("mild_activity", "Mild or only with activity", "It is mild or only happens with activity.", "check", "green", "red_flag"),
    ],
    wizardStage: "red_flag",
    wizardStageLabel: "Safety check",
    wizardSymptomId: "breathing",
    guidancePlan: homeMasterPreviewPlan("red_flag", "Checking urgent breathing warning signs.", isFrench),
    evidenceSources: [],
  };
}

function isHomeMasterAskDrAiPreview(req: IncomingMessage) {
  const referer = req.headers.referer ?? "";
  return referer.includes("/dev/home-master/ask-dr-ai");
}

function vendorChunkName(id: string) {
  if (!id.includes("node_modules")) return undefined;

  const normalizedId = id.replace(/\\/g, "/");

  if (/\/node_modules\/(react|react-dom|scheduler|use-sync-external-store)\//.test(normalizedId)) {
    return "vendor-react";
  }

  if (/\/node_modules\/(react-router|react-router-dom)\//.test(normalizedId)) {
    return "vendor-router";
  }

  if (normalizedId.includes("/node_modules/@tanstack/")) {
    return "vendor-query";
  }

  if (normalizedId.includes("/node_modules/i18next/") || normalizedId.includes("/node_modules/react-i18next/")) {
    return "vendor-i18n";
  }

  if (
    normalizedId.includes("/node_modules/@radix-ui/") ||
    normalizedId.includes("/node_modules/lucide-react/") ||
    normalizedId.includes("/node_modules/sonner/") ||
    normalizedId.includes("/node_modules/vaul/") ||
    normalizedId.includes("/node_modules/cmdk/") ||
    normalizedId.includes("/node_modules/class-variance-authority/") ||
    normalizedId.includes("/node_modules/clsx/") ||
    normalizedId.includes("/node_modules/tailwind-merge/")
  ) {
    return "vendor-ui";
  }

  if (normalizedId.includes("/node_modules/recharts/") || normalizedId.includes("/node_modules/d3-")) {
    return "vendor-charts";
  }

  return undefined;
}

function forwardApiRequest(req: IncomingMessage, res: ServerResponse) {
  const target = `http://127.0.0.1:3001${req.url ?? ""}`;
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (!value || key.toLowerCase() === "host") return;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  });

  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  req.on("end", async () => {
    try {
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const isHomeMasterPreview = isHomeMasterAskDrAiPreview(req);
      const isBenefitsPreview = String(req.headers.referer ?? "").includes("/dev/benefits");
      const isProviderTaskPreview = String(req.headers.referer ?? "").includes("/dev/provider-task-preview/");
      if (isProviderTaskPreview && req.method === "POST" && req.url?.startsWith("/api/offers/search")) {
        const checkedAt = new Date().toISOString();
        const fact = (criterion: string, value: string | null, source: string, status: "verified" | "reported" | "unknown" = value ? "verified" : "unknown") => ({
          criterion, value, status, source, sourceType: status === "verified" ? "provider_owned" : status === "reported" ? "directory" : "unknown",
          sourceUrl: value ? "https://example.com/provider-evidence" : null, checkedAt, conflict: false,
          evidence: value ? [{ value, status, source, sourceType: status === "verified" ? "provider_owned" : "directory", sourceUrl: "https://example.com/provider-evidence", checkedAt }] : [],
        });
        const options = [
          { id: "clinic-sol", name: "Clinica Sol Madrid", address: "1.2 km · Calle Mayor", price: "Consultation from EUR 65", reputation: "4.8/5 from 184 reviews", availability: "Appointments this week", accessibility: "Step-free entrance and lift", coverage: "Sanitas and Adeslas listed" },
          { id: "centro-salud", name: "Centro Salud Retiro", address: "2.4 km · Retiro", price: "Public coverage; referral may apply", reputation: "4.5/5 from 96 reviews", availability: "Next appointment in 9 days", accessibility: "Accessible entrance", coverage: "Public health system" },
          { id: "doctor-casa", name: "Doctor en Casa Madrid", address: "Home visits in Madrid", price: null, reputation: "4.7/5 from 61 reviews", availability: "Call to confirm", accessibility: "Care delivered at home", coverage: null },
        ].map((item, index) => ({
          id: item.id, label: index === 0 ? "Opcion recomendada" : `Alternativa ${index}`, name: item.name, category: "Vivienda y cuidados",
          what_it_offers: "Local healthcare option", price_or_advantage: item.price ?? "Price to confirm", why_good_option: "Compared with your selected priorities.",
          distance_or_availability: item.address, contact_method: "Contact can be prepared after review", source_label: "Preview evidence", source_status: index < 2 ? "verified" : "reported", source_type: index < 2 ? "provider_owned" : "directory", source_url: "https://example.com/provider-evidence", checked_at: checkedAt,
          comparison: {
            distance: fact("distance", item.address, "Demo: Maps listing", "reported"), price: fact("price", item.price, "Demo: provider price page", item.price ? "verified" : "unknown"),
            reputation: fact("reputation", item.reputation, "Demo: public directory", "reported"), availability: fact("availability", item.availability, "Demo: provider booking page", index === 0 ? "verified" : "reported"),
            accessibility: fact("accessibility", item.accessibility, "Demo: provider accessibility page", "verified"), coverage: fact("coverage", item.coverage, "Demo: provider coverage page", item.coverage ? "verified" : "unknown"),
          },
          personalised_fit: index === 0 ? { matchedPriorities: ["distance", "reputation", "accessibility"], tradeOffs: ["Price is higher than the public option"], unmetMustHaves: [], unknowns: [], explanation: "Closest option with verified step-free access and near-term availability.", recommendationStatus: "best_fit" } : { matchedPriorities: ["reputation", "accessibility"], tradeOffs: [], unmetMustHaves: item.coverage ? [] : ["coverage"], unknowns: item.price ? [] : ["price", "coverage"], explanation: item.coverage ? "Strong coverage option, but further away and slower." : "Convenient home visits, but price and coverage still need confirmation.", recommendationStatus: item.coverage ? "possible_fit" : "cautious" },
          score: 0, score_breakdown: { distance: 0, price_value: 0, trust: 0, simplicity: 0, preference_match: 0 },
        }));
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify({ category: "Preview data — vivienda y cuidados", options, best_fit_provider_id: "clinic-sol", recommendation_confident: true, recommendation_explanation: "Demo result: Clinica Sol Madrid is the best-supported fit for your priorities.", decision_explanation: "Demo result: Clinica Sol Madrid is the best-supported fit for your priorities.", neutrality_note: "Preview data only. VYVA does not receive commissions.", source_guidance: [], next_step: "Review the evidence before choosing.", no_results_message: "" }));
        return;
      }
      if (isBenefitsPreview && req.method === "GET" && req.url?.startsWith("/api/profile")) {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify({
          profileId: "benefits-preview-profile",
          firstName: "Elena",
          lastName: "García",
          preferredName: "Elena",
          dateOfBirth: "1947-02-14",
          livingSituation: "alone",
          country: "ES",
          region: "Madrid",
          language: "es",
          timezone: "Europe/Madrid",
        }));
        return;
      }
      if (isBenefitsPreview && req.method === "POST" && req.url?.startsWith("/api/benefits/screenings")) {
        const payload = body?.length
          ? JSON.parse(body.toString("utf8")) as { country?: string; currentBenefits?: string[] }
          : {};
        const isSpanish = req.url.includes("lang=es");
        const isGerman = req.url.includes("lang=de");
        const result = payload.country === "DE"
          ? {
            id: "de-grundsicherung-preview",
            country: "DE",
            region: null,
            name: isGerman ? "Grundsicherung im Alter" : "Basic income support in old age",
            description: isGerman ? "Eine bedarfsabhängige Unterstützung für Menschen im Rentenalter mit niedrigem Einkommen." : "Income-tested support for people of pension age with a low income.",
            askInesStarter: isGerman ? "Kannst du mir die Grundsicherung im Alter erklären?" : "Can you explain basic income support in old age?",
          }
          : {
            id: "es-imv-preview",
            country: "ES",
            region: null,
            name: isSpanish ? "Ingreso Mínimo Vital" : "Minimum Living Income",
            description: isSpanish ? "Una ayuda sujeta a ingresos para hogares con recursos limitados." : "Income-tested support for households with limited resources.",
            askInesStarter: isSpanish ? "¿Puedes explicarme el Ingreso Mínimo Vital?" : "Can you explain Minimum Living Income?",
          };
        const alreadyReceived = payload.currentBenefits?.includes(payload.country === "DE" ? "de-grundsicherung" : "es-imv");
        res.statusCode = 201;
        res.setHeader("content-type", "application/json");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify({
          screeningId: "benefits-preview-screening",
          results: alreadyReceived ? [] : [result],
        }));
        return;
      }
      if (isHomeMasterPreview && req.method === "POST" && req.url?.startsWith("/api/triage/message")) {
        const payload = body?.length
          ? JSON.parse(body.toString("utf8")) as Record<string, unknown>
          : {};
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify(homeMasterPreviewTriageResponse(payload)));
        return;
      }
      if (isHomeMasterPreview && req.method === "POST" && req.url?.startsWith("/api/reports/triage")) {
        const payload = body?.length
          ? JSON.parse(body.toString("utf8")) as Record<string, unknown>
          : {};
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify({
          id: "home-master-preview-report",
          ...payload,
          created_at: new Date().toISOString(),
          sent_to: [],
          staff_review_requested: false,
        }));
        return;
      }
      if (isHomeMasterPreview && req.method === "POST" && req.url?.startsWith("/api/symptoms/log")) {
        res.statusCode = 204;
        res.end();
        return;
      }
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
      });
      res.statusCode = upstream.status;
      upstream.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      res.statusCode = 502;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        error: "API proxy failed",
        message: localApiUnavailableMessage,
        code: "LOCAL_API_UNAVAILABLE",
        detail: err instanceof Error ? err.message : String(err),
      }));
    }
  });
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    chunkSizeWarningLimit: 1900,
    rollupOptions: {
      output: {
        manualChunks: vendorChunkName,
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    {
      name: "vyva-api-forwarder",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/api/")) {
            forwardApiRequest(req, res);
            return;
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/api/")) {
            forwardApiRequest(req, res);
            return;
          }
          next();
        });
      },
    },
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
});
