import crypto from "node:crypto";

/**
 * Verify a Twilio status-callback request using the X-Twilio-Signature header.
 *
 * Twilio builds the signature by taking the full request URL, appending every
 * POST parameter sorted alphabetically by key (key immediately followed by
 * value), HMAC-SHA1 signing the result with the account auth token, and
 * base64-encoding it. See https://www.twilio.com/docs/usage/security.
 */
export function verifyTwilioSignature(options: {
  authToken: string;
  signature: string | undefined;
  url: string;
  params: Record<string, unknown>;
}): boolean {
  const { authToken, signature, url, params } = options;
  if (!authToken || !signature) return false;

  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    const value = params[key];
    data += key + (value === undefined || value === null ? "" : String(value));
  }

  const expected = crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");

  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Verify a SendGrid Event Webhook request signed with the "Signed Event
 * Webhook" feature. SendGrid signs `timestamp + rawBody` with ECDSA (P-256)
 * and sends the signature and timestamp in headers. The configured public key
 * is a base64-encoded DER (SPKI) EC public key.
 * See https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
 */
export function verifySendgridSignature(options: {
  publicKey: string;
  signature: string | undefined;
  timestamp: string | undefined;
  rawBody: string;
}): boolean {
  const { publicKey, signature, timestamp, rawBody } = options;
  if (!publicKey || !signature || !timestamp) return false;

  try {
    const keyObject = crypto.createPublicKey({
      key: Buffer.from(publicKey, "base64"),
      format: "der",
      type: "spki",
    });

    const payload = Buffer.from(timestamp + rawBody, "utf-8");
    const signatureBuffer = Buffer.from(signature, "base64");

    return crypto.verify("sha256", payload, { key: keyObject, dsaEncoding: "der" }, signatureBuffer);
  } catch {
    return false;
  }
}
