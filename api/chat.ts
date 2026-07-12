import { generateLiveChatReply, type LiveChatRequestBody } from "../server/lib/liveChat.js";

type VercelLikeRequest = {
  method?: string;
  body?: unknown;
};

type VercelLikeResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelLikeResponse;
  json(body: unknown): void;
  end(): void;
};

export const config = {
  maxDuration: 30,
};

function parseBody(body: unknown): LiveChatRequestBody {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as LiveChatRequestBody;
    } catch {
      return {};
    }
  }
  return body && typeof body === "object" ? (body as LiveChatRequestBody) : {};
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const result = await generateLiveChatReply(parseBody(req.body));
  res.status(200).json(result);
}
