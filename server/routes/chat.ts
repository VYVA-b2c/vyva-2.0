import type { Request, Response } from "express";
import { generateLiveChatReply } from "../lib/liveChat.js";

export async function liveChatHandler(req: Request, res: Response) {
  const result = await generateLiveChatReply(req.body ?? {});
  return res.status(200).json(result);
}
