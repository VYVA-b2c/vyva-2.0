import { createHmac, randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { authMiddleware, requireUser } from "../middleware/auth.js";

export const scheduledCheckinsRouter = Router();
scheduledCheckinsRouter.use(authMiddleware, requireUser);

async function forwardCheckin(req: Request, res: Response) {
  res.set("Cache-Control", "private, no-store");
  const user = req.user;
  if (!user?.authProvider) {
    res.sendStatus(401);
    return;
  }
  const { TELECARE_APP_CHECKIN_SIMULATION, VYVA_ENVIRONMENT, TELECARE_BRIDGE_URL,
    TELECARE_BRIDGE_ACCOUNT_ID, CONSUMER_BRIDGE_JWT_SECRET } = process.env;
  const config = TELECARE_APP_CHECKIN_SIMULATION === "true" &&
    process.env.VERCEL_ENV !== "production" &&
    ["staging", "development", "test"].includes(VYVA_ENVIRONMENT ?? "") &&
    TELECARE_BRIDGE_URL && TELECARE_BRIDGE_ACCOUNT_ID && CONSUMER_BRIDGE_JWT_SECRET &&
    CONSUMER_BRIDGE_JWT_SECRET.length >= 32;
  const submitting = req.method === "POST";
  if (!config) {
    res.json(submitting ? { recorded: false } : { prompts: [] });
    return;
  }
  const promptId = req.body?.promptId;
  if (submitting && (typeof promptId !== "string" || !/^app_[a-f0-9]+$/.test(promptId))) {
    res.sendStatus(400);
    return;
  }
  try {
    const url = new URL(`/api/v1/bridge/person/${encodeURIComponent(user.id)}/scheduled-checkins`, TELECARE_BRIDGE_URL);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))
      throw new Error("Invalid bridge address");
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const claims = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
      iss: "vyva-consumer", aud: "vyva-os-bridge-v1", sub: "vyva-consumer-bridge",
      account_id: TELECARE_BRIDGE_ACCOUNT_ID, iat: now, exp: now + 60, jti: randomUUID(),
    })}`;
    const signature = createHmac("sha256", CONSUMER_BRIDGE_JWT_SECRET!).update(claims).digest("base64url");
    const result = await fetch(url, {
      method: req.method, redirect: "error", signal: AbortSignal.timeout(5000),
      headers: { Authorization: `Bearer ${claims}.${signature}`, "Content-Type": "application/json" },
      ...(submitting ? { body: JSON.stringify({ promptId }) } : {}),
    });
    if (!result.ok) throw new Error("Bridge request failed");
    res.json(await result.json());
  } catch {
    res.status(503).json({ error: "Scheduled check-ins unavailable" });
  }
}

scheduledCheckinsRouter.get("/", forwardCheckin);
scheduledCheckinsRouter.post("/", forwardCheckin);
