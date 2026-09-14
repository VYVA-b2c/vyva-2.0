import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyElevenLabsWebhookSignature(input: {
  rawBody: Buffer;
  signatureHeader: string | undefined;
  secret: string;
  nowMs?: number;
}) {
  const values = new Map(
    (input.signatureHeader ?? "")
      .split(",")
      .map((part) => part.trim().split("=", 2) as [string, string])
      .filter(([key, value]) => Boolean(key && value)),
  );
  const timestamp = Number.parseInt(values.get("t") ?? "", 10);
  const supplied = values.get("v0") ?? "";
  if (!Number.isFinite(timestamp) || !/^[a-f0-9]{64}$/i.test(supplied)) return false;

  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (timestamp < nowSeconds - 30 * 60 || timestamp > nowSeconds + 5 * 60) return false;

  const expected = createHmac("sha256", input.secret)
    .update(`${timestamp}.${input.rawBody.toString("utf8")}`)
    .digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  const suppliedBytes = Buffer.from(supplied, "hex");
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}
