import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import {
  buildShoppingRecommendations,
  type ShoppingNeedInput,
  type ShoppingPriority,
  type ShoppingRecommendationResponse,
} from "../../shared/shopping.js";
import { loadShoppingCatalogForUser } from "../lib/conciergeShoppingCatalog.js";

const router = Router();

const VALID_PRIORITIES = new Set<ShoppingPriority>([
  "budget",
  "simplicity",
  "accessibility",
  "diet",
  "delivery",
  "safety",
]);

type ShoppingRecommendationBody = {
  needText?: unknown;
  category?: unknown;
  priorities?: unknown;
  constraints?: unknown;
  locale?: unknown;
  packageId?: unknown;
};

function safeString(value: unknown, maxLength = 600): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeStringArray(value: unknown, maxLength = 120): string[] {
  return Array.isArray(value)
    ? value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim().slice(0, maxLength))
      .slice(0, 8)
    : [];
}

function safePriorities(value: unknown): ShoppingPriority[] {
  return Array.isArray(value)
    ? value.filter((item): item is ShoppingPriority => typeof item === "string" && VALID_PRIORITIES.has(item as ShoppingPriority))
    : [];
}

function normaliseBody(body: ShoppingRecommendationBody): ShoppingNeedInput {
  return {
    needText: safeString(body.needText),
    category: safeString(body.category, 80) || null,
    priorities: safePriorities(body.priorities),
    constraints: safeStringArray(body.constraints),
    locale: safeString(body.locale, 12) || "en",
    packageId: safeString(body.packageId, 120) || null,
  };
}

async function maybeAddAiSummary(response: ShoppingRecommendationResponse, input: ShoppingNeedInput): Promise<ShoppingRecommendationResponse> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || response.recommendations.length === 0) return response;

  try {
    const client = new OpenAI({ apiKey });
    const facts = response.recommendations.map((item) => ({
      name: item.product.name,
      priceLabel: item.product.priceLabel,
      description: item.product.description,
      reasons: item.reasons,
      tradeoffs: item.tradeoffs,
      cautions: item.cautionNotes,
    }));

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_SHOPPING_RECOMMENDATION_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: [
            "You write one plain-language shopping comparison sentence for older adults.",
            "Use only the supplied product facts. Do not add new products, claims, prices, medical advice, or purchase instructions.",
            "Return JSON only: {\"summary\":\"...\"}. Keep summary under 32 words.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            locale: input.locale ?? "en",
            userNeed: input.needText ?? "",
            deterministicSummary: response.comparison.summary,
            products: facts,
          }),
        },
      ],
      temperature: 0.2,
      max_tokens: 120,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = JSON.parse(raw) as { summary?: unknown };
    const summary = safeString(parsed.summary, 260);
    if (!summary) return response;

    return {
      ...response,
      comparison: {
        ...response.comparison,
        summary,
      },
    };
  } catch (err) {
    console.warn("[concierge/shopping] AI summary unavailable:", err instanceof Error ? err.message : err);
    return response;
  }
}

export async function conciergeShoppingRecommendationsHandler(req: Request, res: Response) {
  const input = normaliseBody((req.body ?? {}) as ShoppingRecommendationBody);
  const hasIntent = Boolean(input.needText?.trim() || input.category || input.priorities?.length || input.constraints?.length);

  if (!hasIntent) {
    return res.status(400).json({
      error: "Tell VYVA what you need before asking for shopping recommendations.",
    });
  }

  const catalogSource = await loadShoppingCatalogForUser();
  const deterministic = buildShoppingRecommendations(input, {
    catalog: catalogSource.products,
    packageProductIds: input.packageId ? catalogSource.packageProductIds[input.packageId] ?? [] : [],
  });
  const response = await maybeAddAiSummary(deterministic, input);
  return res.json(response);
}

export async function conciergeShoppingSupportPackagesHandler(_req: Request, res: Response) {
  const catalogSource = await loadShoppingCatalogForUser();
  return res.json({
    source: catalogSource.source,
    packages: catalogSource.packages,
  });
}

router.get("/support-packages", conciergeShoppingSupportPackagesHandler);
router.post("/recommendations", conciergeShoppingRecommendationsHandler);

export default router;

