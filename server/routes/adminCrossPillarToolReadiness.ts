import { Router, type Request, type Response } from "express";
import {
  CROSS_PILLAR_TOOL_FAMILIES,
  type CrossPillarToolEvidence,
  type CrossPillarToolFamily,
  type CrossPillarToolReadinessStatus,
} from "../../shared/crossPillarToolReadiness.js";
import { buildAdminConciergeChannelReadinessSnapshot } from "../services/conciergeChannelReadiness.js";
import { buildAdminCrossPillarExecutionSummary } from "../services/crossPillarExecutionObservability.js";

const router = Router();

type ChannelRow = Awaited<ReturnType<typeof buildAdminConciergeChannelReadinessSnapshot>>["channels"][number];

function externalStatus(channel: ChannelRow | undefined): CrossPillarToolReadinessStatus {
  if (channel?.ready) return "ready";
  if (channel?.configured) return "temporarily_unavailable";
  return "setup_needed";
}

function evidence(
  family: CrossPillarToolFamily,
  status: CrossPillarToolReadinessStatus,
  adapter: string,
  reason?: string,
): CrossPillarToolEvidence {
  return {
    family,
    status,
    adapter,
    reason: reason || undefined,
    checkedAt: new Date().toISOString(),
  };
}

function envReady(keys: string[]): boolean {
  return keys.some((key) => Boolean(process.env[key]?.trim()));
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    const snapshot = await buildAdminConciergeChannelReadinessSnapshot();
    const channels = new Map(snapshot.channels.map((channel) => [channel.channel, channel]));
    const phone = channels.get("phone_call");
    const email = channels.get("email");
    const whatsapp = channels.get("whatsapp");
    const booking = channels.get("form_application");
    const upload = channels.get("document_upload");
    const contactChannels = [phone, email, whatsapp].filter(Boolean) as ChannelRow[];
    const providerContactReady = contactChannels.some((channel) => channel.ready);
    const providerContactConfigured = contactChannels.some((channel) => channel.configured);
    const searchReady = envReady([
      "GOOGLE_PLACES_API_KEY",
      "GOOGLE_MAPS_API_KEY",
      "BRAVE_SEARCH_API_KEY",
      "SERPER_API_KEY",
      "TAVILY_API_KEY",
    ]);

    const tools = Object.fromEntries(CROSS_PILLAR_TOOL_FAMILIES.map((family) => [
      family,
      evidence(family, "setup_needed", "unverified"),
    ])) as Record<CrossPillarToolFamily, CrossPillarToolEvidence>;
    tools.routing = evidence("routing", "ready", "app-router");
    tools.task_creation = evidence("task_creation", "ready", "cross-pillar-handoff-store");
    tools.notification = evidence("notification", "ready", "in-app-notifications");
    tools.email = evidence(
        "email",
        externalStatus(email),
        "concierge-email-adapter",
        email?.blockers.join(" "),
      );
    tools.phone = evidence(
        "phone",
        externalStatus(phone),
        "concierge-phone-adapter",
        phone?.blockers.join(" "),
      );
    tools.booking = evidence(
        "booking",
        externalStatus(booking),
        "concierge-booking-adapter",
        booking?.blockers.join(" "),
      );
    tools.upload = evidence(
        "upload",
        externalStatus(upload),
        "concierge-upload-adapter",
        upload?.blockers.join(" "),
      );
    tools.provider_contact = evidence(
        "provider_contact",
        providerContactReady
          ? "ready"
          : providerContactConfigured
            ? "temporarily_unavailable"
            : "setup_needed",
        "trusted-provider-contact",
        providerContactReady ? undefined : "No verified provider contact channel is ready.",
      );
    tools.search = evidence(
        "search",
        searchReady ? "ready" : "setup_needed",
        "provider-and-web-search",
      searchReady ? undefined : "No supported search credential is configured.",
    );

    try {
      const executionSummary = await buildAdminCrossPillarExecutionSummary(24);
      for (const health of executionSummary.toolHealth) {
        if (health.status === "temporarily_degraded" && tools[health.family].status === "ready") {
          tools[health.family] = evidence(
            health.family,
            "temporarily_unavailable",
            tools[health.family].adapter || "live-execution-monitor",
            health.reason,
          );
        }
      }
    } catch (error) {
      console.warn("[admin-cross-pillar-tool-readiness] live health overlay unavailable:", error);
    }

    res.json({
      generated_at: new Date().toISOString(),
      tools: CROSS_PILLAR_TOOL_FAMILIES.map((family) => ({
        family,
        ...tools[family],
      })),
    });
  } catch (error) {
    console.error("[admin-cross-pillar-tool-readiness] GET / error:", error);
    res.status(500).json({ error: "Could not load cross-pillar tool readiness." });
  }
});

export default router;
