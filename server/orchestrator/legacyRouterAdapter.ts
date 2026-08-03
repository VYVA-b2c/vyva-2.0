import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import {
  legacyRouterObservationSchema,
  type LegacyResponseKind,
  type LegacyRouterHandler,
  type LegacyRouterObservation,
} from "./orchestratorTypes.js";

function responseKind(value: unknown): LegacyResponseKind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const kind = typeof value;
  if (kind === "boolean" || kind === "number" ||
    kind === "object" || kind === "string") {
    return kind;
  }
  return "unknown";
}

export function orchestratorLatencyBucket(
  durationMs: number,
): LegacyRouterObservation["latencyBucket"] {
  if (durationMs < 10) return "lt_10ms";
  if (durationMs < 50) return "lt_50ms";
  if (durationMs < 100) return "lt_100ms";
  if (durationMs < 250) return "lt_250ms";
  if (durationMs < 500) return "lt_500ms";
  if (durationMs < 1_000) return "lt_1000ms";
  return "gte_1000ms";
}

export function digestLegacyJsonPayload(payload: unknown): string | undefined {
  if (typeof payload === "string") {
    return `sha256:${createHash("sha256").update(payload, "utf8").digest("hex")}`;
  }
  if (Buffer.isBuffer(payload)) {
    return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
  }
  return undefined;
}

export function createLegacyRouterAdapter(
  legacyHandler: LegacyRouterHandler,
  monotonicNow: () => number = () => performance.now(),
) {
  return async function invokeLegacyRouter(
    req: Request,
    res: Response,
  ): Promise<LegacyRouterObservation> {
    const safeMonotonicNow = () => {
      try {
        const value = monotonicNow();
        return Number.isFinite(value) ? value : 0;
      } catch {
        return 0;
      }
    };
    const startedAt = safeMonotonicNow();
    const originalStatus = res.status;
    const originalJson = res.json;
    const originalSend = res.send;
    let statusCode = res.statusCode || 200;
    let completed = false;
    let kind: LegacyResponseKind = "unknown";
    let digest: string | undefined;
    let jsonDelegationDepth = 0;

    res.status = function interceptedStatus(code: number) {
      statusCode = code;
      return originalStatus.call(this, code);
    };
    res.json = function interceptedJson(body?: unknown) {
      statusCode = this.statusCode || statusCode;
      kind = responseKind(body);
      jsonDelegationDepth += 1;
      try {
        const result = originalJson.call(this, body);
        completed = true;
        statusCode = this.statusCode || statusCode;
        return result;
      } finally {
        jsonDelegationDepth -= 1;
      }
    };
    res.send = function interceptedSend(body?: unknown) {
      if (jsonDelegationDepth > 0) {
        digest = digestLegacyJsonPayload(body);
      }
      return originalSend.call(this, body);
    };

    try {
      await legacyHandler(req, res);
    } finally {
      res.status = originalStatus;
      res.json = originalJson;
      res.send = originalSend;
    }

    return legacyRouterObservationSchema.parse({
      invocationCount: 1,
      completed,
      statusCode,
      responseKind: kind,
      latencyBucket: orchestratorLatencyBucket(
        Math.max(0, safeMonotonicNow() - startedAt),
      ),
      ...(digest !== undefined ? { responseDigest: digest } : {}),
    });
  };
}
