import {
  CONCIERGE_FLOW_REFERENCES,
  type ConciergeFlowReference,
} from "./conciergeFlowRegistry";

export type ConciergeLiveHandoffQaChannel = "phone_call" | "whatsapp" | "email" | "booking_form";

export interface ConciergeLiveHandoffQaJourney {
  reference: ConciergeFlowReference;
  channel: ConciergeLiveHandoffQaChannel;
  channelLabel: string;
  testProviderLabel: string;
  launchInstruction: string;
  launchExpectedResult: string;
  waitingInstruction: string;
  waitingExpectedResult: string;
  noAnswerInstruction: string;
  noAnswerExpectedResult: string;
  replyInstruction: string;
  replyExpectedResult: string;
  historyInstruction: string;
  historyExpectedResult: string;
}

const COMMON_WAITING_EXPECTATION = "After a reload, the same task is still visible as Waiting for provider with its provider, channel, elapsed wait, and follow-up actions intact.";
const COMMON_NO_ANSWER_EXPECTATION = "The task stays open, the contact attempt is retained, and opening any second contact requires another final user confirmation.";

export const CONCIERGE_LIVE_HANDOFF_QA_JOURNEYS: ConciergeLiveHandoffQaJourney[] = [
  {
    reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
    channel: "phone_call",
    channelLabel: "Phone call",
    testProviderLabel: "QA transport provider",
    launchInstruction: "Use a QA-controlled transport phone number. Prepare a ride, verify no call starts before confirmation, confirm, and launch the phone handoff.",
    launchExpectedResult: "The call targets only the QA transport number and starts only after the final confirmation screen.",
    waitingInstruction: "Save No answer for the call, reload the app, and reopen Concierge.",
    waitingExpectedResult: COMMON_WAITING_EXPECTATION,
    noAnswerInstruction: "Choose No answer, then prepare a second call to the same QA transport provider.",
    noAnswerExpectedResult: COMMON_NO_ANSWER_EXPECTATION,
    replyInstruction: "Record the QA provider reply with the confirmed pickup time and a test reference.",
    replyExpectedResult: "The ride reply is saved, the waiting task closes, and the confirmed ride details remain traceable.",
    historyInstruction: "Open completed Concierge history after saving the QA ride reply.",
    historyExpectedResult: "History shows a Ride receipt with the QA provider, outcome, time, reference, and contact route.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
    channel: "whatsapp",
    channelLabel: "WhatsApp",
    testProviderLabel: "QA pharmacy",
    launchInstruction: "Use a QA-controlled WhatsApp number saved as the pharmacy. Prepare an OTC-only request, verify WhatsApp does not open before confirmation, then confirm and open the draft.",
    launchExpectedResult: "WhatsApp opens only after final confirmation, addressed to the QA number with the OTC item and timing in the prepared message.",
    waitingInstruction: "Mark the QA WhatsApp as sent, reload the app, and reopen Concierge.",
    waitingExpectedResult: COMMON_WAITING_EXPECTATION,
    noAnswerInstruction: "Choose No answer, then prepare a second WhatsApp follow-up to the QA pharmacy.",
    noAnswerExpectedResult: COMMON_NO_ANSWER_EXPECTATION,
    replyInstruction: "Record the QA pharmacy reply, availability, pickup or delivery detail, and a test reference.",
    replyExpectedResult: "The pharmacy reply is saved and the waiting OTC task closes without introducing prescription-medicine ordering.",
    historyInstruction: "Open completed Concierge history after saving the QA pharmacy reply.",
    historyExpectedResult: "History shows an OTC pharmacy receipt with the QA pharmacy, outcome, reference, and WhatsApp contact route.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
    channel: "email",
    channelLabel: "Email",
    testProviderLabel: "QA clinic",
    launchInstruction: "Use a QA-controlled clinic inbox. Prepare an appointment email, verify the draft cannot open before confirmation, then confirm and open it.",
    launchExpectedResult: "The email draft opens only after final confirmation, addressed to the QA inbox with the appointment reason and preferred timing.",
    waitingInstruction: "Mark the QA email as sent, reload the app, and reopen Concierge.",
    waitingExpectedResult: COMMON_WAITING_EXPECTATION,
    noAnswerInstruction: "Choose No answer, then prepare a second email to the QA clinic.",
    noAnswerExpectedResult: COMMON_NO_ANSWER_EXPECTATION,
    replyInstruction: "Record a QA clinic reply with a date, time, location, and test reference.",
    replyExpectedResult: "The appointment is saved in Scheduled Support, the waiting task closes, and the reply details remain attached to the completed session.",
    historyInstruction: "Open completed Concierge history after saving the QA appointment reply.",
    historyExpectedResult: "History shows an Appointment receipt with the QA clinic, confirmed time, location, reference, and email contact route.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.homeService,
    channel: "booking_form",
    channelLabel: "Booking form",
    testProviderLabel: "QA home-service provider",
    launchInstruction: "Use a QA-controlled supported booking page. Prepare a home-service visit, verify the form cannot open or submit before confirmation, then confirm and open the prepared form.",
    launchExpectedResult: "Only the QA booking page opens after final confirmation, with no payment, CAPTCHA, or unsupported sensitive step submitted automatically.",
    waitingInstruction: "Mark the QA form as submitted, reload the app, and reopen Concierge.",
    waitingExpectedResult: COMMON_WAITING_EXPECTATION,
    noAnswerInstruction: "Choose No answer, then prepare another contact attempt for the QA home-service provider.",
    noAnswerExpectedResult: COMMON_NO_ANSWER_EXPECTATION,
    replyInstruction: "Record a QA provider reply with the visit date, time, location, estimate, and test reference.",
    replyExpectedResult: "The visit is saved in Scheduled Support, the waiting task closes, and access or safety notes remain attached.",
    historyInstruction: "Open completed Concierge history after saving the QA home-service reply.",
    historyExpectedResult: "History shows a Home service receipt with the QA provider, visit details, reference, and booking contact route.",
  },
];

export function getConciergeLiveHandoffQaJourney(
  reference: ConciergeFlowReference,
): ConciergeLiveHandoffQaJourney | null {
  return CONCIERGE_LIVE_HANDOFF_QA_JOURNEYS.find((journey) => journey.reference === reference) ?? null;
}
