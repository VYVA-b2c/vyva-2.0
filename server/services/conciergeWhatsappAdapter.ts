// Opt in separately from the existing dispatcher; this does not enable live actions.
export function ownedConciergeWhatsappEnabled() {
  return process.env.CONCIERGE_WHATSAPP_ADAPTER === "twilio";
}

export function ownedConciergeWhatsappConfigured() {
  return ownedConciergeWhatsappEnabled() && Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim()
    && (process.env.TWILIO_WHATSAPP_FROM?.trim()
      || process.env.TWILIO_WHATSAPP_FROM_NUMBER?.trim()
      || process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID?.trim()),
  );
}

export async function sendConciergeWhatsapp(recipient: string, message: string) {
  if (!ownedConciergeWhatsappConfigured()) throw new Error("Concierge Twilio WhatsApp is not configured.");
  if (!/^\+[1-9]\d{7,14}$/.test(recipient)) throw new Error("A valid WhatsApp recipient is required.");
  // Keep the first rollout restricted to explicitly approved pilot recipients.
  const allowed = (process.env.CONCIERGE_WHATSAPP_PILOT_RECIPIENTS ?? "").split(",").map(value => value.trim()).filter(Boolean);
  if (!allowed.includes(recipient)) throw new Error("WhatsApp recipient is not approved for the Concierge pilot.");
  if (!message.trim()) throw new Error("WhatsApp message is required.");
  const { sendWhatsapp } = await import("./communicationDispatcher.js");
  const result = await sendWhatsapp({ recipient, body: message, metadata: { source: "concierge" } });
  if (!result.sid || ["failed", "undelivered"].includes(result.status ?? "")) {
    throw new Error("Twilio did not accept the WhatsApp message.");
  }
  return result;
}
