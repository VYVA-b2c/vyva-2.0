import type { Request, Response } from "express";
import { resolveDrAiVoiceAccess } from "../lib/drAiVoiceFeature.js";

export function drAiVoiceFeatureHandler(req: Request, res: Response) {
  return res.json(resolveDrAiVoiceAccess({ userId: req.user?.id, env: process.env }));
}
