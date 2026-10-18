import "dotenv/config";
import { sendConciergeWhatsapp } from "../server/services/conciergeWhatsappAdapter.js";

const [recipient, confirmation] = process.argv.slice(2);
if (!recipient || confirmation !== "--confirm-send") {
  throw new Error("Usage: npx tsx scripts/test-concierge-whatsapp.ts +COUNTRYNUMBER --confirm-send (sends one real message)");
}
// No retries: an ambiguous network failure must not cause duplicate test messages.
const result = await sendConciergeWhatsapp(recipient, "VYVA Concierge WhatsApp connection test. No provider has been contacted and no booking has been made.");
console.log(JSON.stringify({ messageId: result.sid, status: result.status, deliveryVerified: false }));
console.log("Twilio acceptance is not delivery confirmation. Check the recipient phone and Twilio delivery status before enabling live use.");
