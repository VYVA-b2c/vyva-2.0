export type GuidedFlowRef =
  | "concierge.book_ride"
  | "concierge.book_medical_appointment"
  | "health.medication_help";

export type GuidedActionInput = "single_choice" | "multi_choice";

export type GuidedActionChoice = {
  id: string;
  value: string;
  labelKey: string;
  labelFallback: string;
  helperKey?: string;
  helperFallback?: string;
  requiresCustomAnswer?: boolean;
};

export type GuidedActionStepVisibility = {
  slot: string;
  values: string[];
};

export type GuidedActionStep = {
  id: string;
  slot: string;
  input: GuidedActionInput;
  titleKey: string;
  titleFallback: string;
  helperKey: string;
  helperFallback: string;
  textPlaceholderKey?: string;
  textPlaceholderFallback?: string;
  choices: GuidedActionChoice[];
  allowCustomAnswer?: boolean;
  customAnswerLabelKey?: string;
  customAnswerLabelFallback?: string;
  skipValue?: string;
  showWhen?: GuidedActionStepVisibility;
};

export type GuidedActionFlow = {
  ref: GuidedFlowRef;
  titleKey: string;
  titleFallback: string;
  introKey: string;
  introFallback: string;
  completionKey: string;
  completionFallback: string;
  confirmationKey: string;
  confirmationFallback: string;
  steps: GuidedActionStep[];
};

export const guidedActionFlows: Record<GuidedFlowRef, GuidedActionFlow> = {
  "concierge.book_ride": {
    ref: "concierge.book_ride",
    titleKey: "guidedActions.concierge.bookRide.title",
    titleFallback: "Let's book your ride",
    introKey: "guidedActions.concierge.bookRide.intro",
    introFallback:
      "Say it, type it, or tap a choice. VYVA compares options before anything is booked.",
    completionKey: "guidedActions.concierge.bookRide.completion",
    completionFallback: "Ride details ready. Now compare safe options.",
    confirmationKey: "guidedActions.concierge.bookRide.confirmation",
    confirmationFallback:
      "If you have a saved transport provider, VYVA shows it first. Otherwise VYVA compares safe options. Nothing is booked without your confirmation.",
    steps: [
      {
        id: "destination",
        slot: "destination",
        input: "single_choice",
        titleKey: "guidedActions.concierge.bookRide.steps.destination.title",
        titleFallback: "Where are you going?",
        helperKey: "guidedActions.concierge.bookRide.steps.destination.helper",
        helperFallback:
          "Use a saved place, choose a common stop, or type the address.",
        textPlaceholderKey:
          "guidedActions.concierge.bookRide.steps.destination.placeholder",
        textPlaceholderFallback: "Clinic, pharmacy, family address...",
        allowCustomAnswer: true,
        customAnswerLabelKey: "guidedActions.concierge.bookRide.customAnswer",
        customAnswerLabelFallback: "Use typed answer",
        choices: [
          {
            id: "doctor",
            value: "Doctor or clinic",
            labelKey: "guidedActions.concierge.bookRide.choices.doctor",
            labelFallback: "Doctor",
          },
          {
            id: "pharmacy",
            value: "Pharmacy",
            labelKey: "guidedActions.concierge.bookRide.choices.pharmacy",
            labelFallback: "Pharmacy",
          },
          {
            id: "hospital",
            value: "Hospital",
            labelKey: "guidedActions.concierge.bookRide.choices.hospital",
            labelFallback: "Hospital",
          },
          {
            id: "new_address",
            value: "New address",
            labelKey: "guidedActions.concierge.bookRide.choices.newAddress",
            labelFallback: "New address",
            requiresCustomAnswer: true,
          },
        ],
      },
      {
        id: "pickup",
        slot: "pickup",
        input: "single_choice",
        titleKey: "guidedActions.concierge.bookRide.steps.pickup.title",
        titleFallback: "Where should we pick you up?",
        helperKey: "guidedActions.concierge.bookRide.steps.pickup.helper",
        helperFallback:
          "Use your saved home, current place, or type a pickup address.",
        textPlaceholderKey:
          "guidedActions.concierge.bookRide.steps.pickup.placeholder",
        textPlaceholderFallback: "Home, hotel, reception, entrance...",
        allowCustomAnswer: true,
        customAnswerLabelKey: "guidedActions.concierge.bookRide.customAnswer",
        customAnswerLabelFallback: "Use typed answer",
        choices: [
          {
            id: "saved_home",
            value: "Saved home",
            labelKey: "guidedActions.concierge.bookRide.choices.savedHome",
            labelFallback: "Home",
          },
          {
            id: "current_place",
            value: "Current location",
            labelKey: "guidedActions.concierge.bookRide.choices.currentPlace",
            labelFallback: "Current place",
          },
          {
            id: "new_pickup",
            value: "New pickup",
            labelKey: "guidedActions.concierge.bookRide.choices.newPickup",
            labelFallback: "New pickup",
            requiresCustomAnswer: true,
          },
        ],
      },
      {
        id: "time",
        slot: "time",
        input: "single_choice",
        titleKey: "guidedActions.concierge.bookRide.steps.time.title",
        titleFallback: "When do you need to go?",
        helperKey: "guidedActions.concierge.bookRide.steps.time.helper",
        helperFallback: "Choose a simple time or type the appointment time.",
        textPlaceholderKey:
          "guidedActions.concierge.bookRide.steps.time.placeholder",
        textPlaceholderFallback: "Tomorrow at 10, later today...",
        allowCustomAnswer: true,
        customAnswerLabelKey: "guidedActions.concierge.bookRide.customAnswer",
        customAnswerLabelFallback: "Use typed answer",
        choices: [
          {
            id: "now",
            value: "now",
            labelKey: "guidedActions.concierge.bookRide.choices.now",
            labelFallback: "Now",
          },
          {
            id: "later_today",
            value: "later today",
            labelKey: "guidedActions.concierge.bookRide.choices.laterToday",
            labelFallback: "Later today",
          },
          {
            id: "tomorrow",
            value: "tomorrow",
            labelKey: "guidedActions.concierge.bookRide.choices.tomorrow",
            labelFallback: "Tomorrow",
          },
          {
            id: "appointment_time",
            value: "for my appointment time",
            labelKey:
              "guidedActions.concierge.bookRide.choices.appointmentTime",
            labelFallback: "For appointment",
          },
        ],
      },
      {
        id: "mobility",
        slot: "mobility",
        input: "multi_choice",
        titleKey: "guidedActions.concierge.bookRide.steps.mobility.title",
        titleFallback: "Any help getting in or out?",
        helperKey: "guidedActions.concierge.bookRide.steps.mobility.helper",
        helperFallback:
          "Pick all that matter. This helps VYVA compare safer options.",
        choices: [
          {
            id: "none",
            value: "No extra help",
            labelKey: "guidedActions.concierge.bookRide.choices.noExtraHelp",
            labelFallback: "No extra help",
          },
          {
            id: "walker",
            value: "Walker",
            labelKey: "guidedActions.concierge.bookRide.choices.walker",
            labelFallback: "Walker",
          },
          {
            id: "wheelchair",
            value: "Wheelchair",
            labelKey: "guidedActions.concierge.bookRide.choices.wheelchair",
            labelFallback: "Wheelchair",
          },
          {
            id: "companion",
            value: "Someone with me",
            labelKey: "guidedActions.concierge.bookRide.choices.companion",
            labelFallback: "Someone with me",
          },
        ],
        skipValue: "No extra help",
      },
    ],
  },
  "concierge.book_medical_appointment": {
    ref: "concierge.book_medical_appointment",
    titleKey: "guidedActions.concierge.bookMedicalAppointment.title",
    titleFallback: "Let's prepare your appointment",
    introKey: "guidedActions.concierge.bookMedicalAppointment.intro",
    introFallback:
      "Answer a few things. VYVA checks saved providers first, then safe options.",
    completionKey: "guidedActions.concierge.bookMedicalAppointment.completion",
    completionFallback: "Appointment request ready.",
    confirmationKey:
      "guidedActions.concierge.bookMedicalAppointment.confirmation",
    confirmationFallback:
      "VYVA will prepare the request and ask before booking or contacting anyone.",
    steps: [
      {
        id: "need",
        slot: "need",
        input: "single_choice",
        titleKey:
          "guidedActions.concierge.bookMedicalAppointment.steps.need.title",
        titleFallback: "What kind of care do you need?",
        helperKey:
          "guidedActions.concierge.bookMedicalAppointment.steps.need.helper",
        helperFallback: "Choose the closest match. You can type your own.",
        textPlaceholderKey:
          "guidedActions.concierge.bookMedicalAppointment.steps.need.placeholder",
        textPlaceholderFallback: "Cardiology, skin, blood test...",
        allowCustomAnswer: true,
        customAnswerLabelKey:
          "guidedActions.concierge.bookMedicalAppointment.customAnswer",
        customAnswerLabelFallback: "Use typed answer",
        choices: [
          {
            id: "doctor",
            value: "doctor",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.doctor",
            labelFallback: "Doctor",
          },
          {
            id: "specialist",
            value: "specialist",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.specialist",
            labelFallback: "Specialist",
          },
          {
            id: "nurse",
            value: "nurse",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.nurse",
            labelFallback: "Nurse",
          },
          {
            id: "lab",
            value: "lab",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.lab",
            labelFallback: "Test or lab",
          },
          {
            id: "other",
            value: "other",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.other",
            labelFallback: "Other",
            requiresCustomAnswer: true,
          },
        ],
      },
      {
        id: "reason",
        slot: "reason",
        input: "single_choice",
        titleKey:
          "guidedActions.concierge.bookMedicalAppointment.steps.reason.title",
        titleFallback: "What is this for?",
        helperKey:
          "guidedActions.concierge.bookMedicalAppointment.steps.reason.helper",
        helperFallback: "This helps VYVA write a clearer request.",
        textPlaceholderKey:
          "guidedActions.concierge.bookMedicalAppointment.steps.reason.placeholder",
        textPlaceholderFallback: "Short reason...",
        allowCustomAnswer: true,
        customAnswerLabelKey:
          "guidedActions.concierge.bookMedicalAppointment.customAnswer",
        customAnswerLabelFallback: "Use typed answer",
        choices: [
          {
            id: "routine",
            value: "routine_check",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.routine",
            labelFallback: "Routine check",
          },
          {
            id: "symptom",
            value: "new_symptom",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.symptom",
            labelFallback: "New symptom",
          },
          {
            id: "follow_up",
            value: "follow_up",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.followUp",
            labelFallback: "Follow-up",
          },
          {
            id: "medication",
            value: "medication",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.medication",
            labelFallback: "Medication",
          },
          {
            id: "urgent",
            value: "urgent_worry",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.urgent",
            labelFallback: "Urgent worry",
          },
        ],
      },
      {
        id: "provider",
        slot: "provider",
        input: "single_choice",
        titleKey:
          "guidedActions.concierge.bookMedicalAppointment.steps.provider.title",
        titleFallback: "Which provider should VYVA try first?",
        helperKey:
          "guidedActions.concierge.bookMedicalAppointment.steps.provider.helper",
        helperFallback: "If you have a saved doctor, VYVA checks that first.",
        textPlaceholderKey:
          "guidedActions.concierge.bookMedicalAppointment.steps.provider.placeholder",
        textPlaceholderFallback: "Clinic or doctor name...",
        allowCustomAnswer: true,
        customAnswerLabelKey:
          "guidedActions.concierge.bookMedicalAppointment.customAnswer",
        customAnswerLabelFallback: "Use typed answer",
        choices: [
          {
            id: "saved",
            value: "saved_provider",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.savedProvider",
            labelFallback: "Saved doctor",
          },
          {
            id: "nearby",
            value: "find_nearby",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.findNearby",
            labelFallback: "Find nearby",
          },
          {
            id: "clinic",
            value: "clinic_name",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.clinicName",
            labelFallback: "Clinic name",
            requiresCustomAnswer: true,
          },
          {
            id: "not_sure",
            value: "not_sure",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.notSure",
            labelFallback: "Not sure",
          },
        ],
      },
      {
        id: "timing",
        slot: "timing",
        input: "single_choice",
        titleKey:
          "guidedActions.concierge.bookMedicalAppointment.steps.timing.title",
        titleFallback: "When would you like it?",
        helperKey:
          "guidedActions.concierge.bookMedicalAppointment.steps.timing.helper",
        helperFallback: "A rough time is enough to start.",
        textPlaceholderKey:
          "guidedActions.concierge.bookMedicalAppointment.steps.timing.placeholder",
        textPlaceholderFallback: "Tuesday morning, next week...",
        allowCustomAnswer: true,
        customAnswerLabelKey:
          "guidedActions.concierge.bookMedicalAppointment.customAnswer",
        customAnswerLabelFallback: "Use typed answer",
        choices: [
          {
            id: "soon",
            value: "soon",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.soon",
            labelFallback: "Soon",
          },
          {
            id: "this_week",
            value: "this_week",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.thisWeek",
            labelFallback: "This week",
          },
          {
            id: "specific",
            value: "specific_time",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.specificTime",
            labelFallback: "Specific time",
            requiresCustomAnswer: true,
          },
          {
            id: "flexible",
            value: "flexible",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.flexible",
            labelFallback: "Flexible",
          },
        ],
      },
      {
        id: "contact",
        slot: "contact",
        input: "single_choice",
        titleKey:
          "guidedActions.concierge.bookMedicalAppointment.steps.contact.title",
        titleFallback: "How should VYVA handle it?",
        helperKey:
          "guidedActions.concierge.bookMedicalAppointment.steps.contact.helper",
        helperFallback:
          "Choose the route you are comfortable with. You confirm first.",
        choices: [
          {
            id: "phone",
            value: "phone",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.phone",
            labelFallback: "Phone",
          },
          {
            id: "online",
            value: "online_form",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.online",
            labelFallback: "Online form",
          },
          {
            id: "message",
            value: "whatsapp_email",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.message",
            labelFallback: "Message",
          },
          {
            id: "ask_vyva",
            value: "ask_vyva",
            labelKey:
              "guidedActions.concierge.bookMedicalAppointment.choices.askVyva",
            labelFallback: "Let VYVA choose",
          },
        ],
      },
    ],
  },
  "health.medication_help": {
    ref: "health.medication_help",
    titleKey: "guidedActions.health.medicationHelp.title",
    titleFallback: "Medication help",
    introKey: "guidedActions.health.medicationHelp.intro",
    introFallback:
      "Answer a few things. VYVA prepares a safe next step and never changes medication for you.",
    completionKey: "guidedActions.health.medicationHelp.completion",
    completionFallback: "Medication request ready.",
    confirmationKey: "guidedActions.health.medicationHelp.confirmation",
    confirmationFallback:
      "Pharmacy help is for OTC items through a saved pharmacy. VYVA asks before contacting anyone.",
    steps: [
      {
        id: "need",
        slot: "need",
        input: "single_choice",
        titleKey: "guidedActions.health.medicationHelp.steps.need.title",
        titleFallback: "What do you need help with?",
        helperKey: "guidedActions.health.medicationHelp.steps.need.helper",
        helperFallback:
          "Choose the closest need. If it feels urgent, VYVA will point you to safer help.",
        choices: [
          {
            id: "missed_dose",
            value: "missed_dose",
            labelKey: "guidedActions.health.medicationHelp.choices.missedDose",
            labelFallback: "Missed dose",
          },
          {
            id: "refill",
            value: "refill",
            labelKey: "guidedActions.health.medicationHelp.choices.refill",
            labelFallback: "OTC item",
          },
          {
            id: "side_effect",
            value: "side_effect",
            labelKey: "guidedActions.health.medicationHelp.choices.sideEffect",
            labelFallback: "Side effect",
          },
          {
            id: "schedule",
            value: "schedule",
            labelKey: "guidedActions.health.medicationHelp.choices.schedule",
            labelFallback: "Schedule",
          },
          {
            id: "add_medicine",
            value: "add_medicine",
            labelKey: "guidedActions.health.medicationHelp.choices.addMedicine",
            labelFallback: "Add medicine",
          },
          {
            id: "question",
            value: "question",
            labelKey: "guidedActions.health.medicationHelp.choices.question",
            labelFallback: "Question",
          },
        ],
      },
      {
        id: "medicine",
        slot: "medicine",
        input: "single_choice",
        titleKey: "guidedActions.health.medicationHelp.steps.medicine.title",
        titleFallback: "Which medicine is this about?",
        helperKey: "guidedActions.health.medicationHelp.steps.medicine.helper",
        helperFallback:
          "Use a saved medicine, say the name, or choose not sure.",
        textPlaceholderKey:
          "guidedActions.health.medicationHelp.steps.medicine.placeholder",
        textPlaceholderFallback: "Medicine name...",
        allowCustomAnswer: true,
        customAnswerLabelKey:
          "guidedActions.health.medicationHelp.customAnswer",
        customAnswerLabelFallback: "Use typed answer",
        choices: [
          {
            id: "saved_medicine",
            value: "saved_medicine",
            labelKey:
              "guidedActions.health.medicationHelp.choices.savedMedicine",
            labelFallback: "Saved medicine",
          },
          {
            id: "type_name",
            value: "type_name",
            labelKey: "guidedActions.health.medicationHelp.choices.typeName",
            labelFallback: "Type name",
            requiresCustomAnswer: true,
          },
          {
            id: "not_sure",
            value: "not_sure",
            labelKey: "guidedActions.health.medicationHelp.choices.notSure",
            labelFallback: "Not sure",
          },
        ],
      },
      {
        id: "pharmacy",
        slot: "pharmacy",
        input: "single_choice",
        titleKey: "guidedActions.health.medicationHelp.steps.pharmacy.title",
        titleFallback: "Use your saved pharmacy?",
        helperKey: "guidedActions.health.medicationHelp.steps.pharmacy.helper",
        helperFallback:
          "For now, VYVA only helps with non-prescription items through a pharmacy saved in your profile.",
        showWhen: {
          slot: "need",
          values: ["refill"],
        },
        choices: [
          {
            id: "usual_pharmacy",
            value: "usual_pharmacy",
            labelKey:
              "guidedActions.health.medicationHelp.choices.usualPharmacy",
            labelFallback: "Saved pharmacy",
          },
          {
            id: "setup_pharmacy_first",
            value: "setup_pharmacy_first",
            labelKey:
              "guidedActions.health.medicationHelp.choices.setupPharmacyFirst",
            labelFallback: "Set up pharmacy first",
          },
          {
            id: "not_sure",
            value: "not_sure",
            labelKey: "guidedActions.health.medicationHelp.choices.notSure",
            labelFallback: "Not sure",
          },
        ],
      },
      {
        id: "urgency",
        slot: "urgency",
        input: "single_choice",
        titleKey: "guidedActions.health.medicationHelp.steps.urgency.title",
        titleFallback: "How soon do you need help?",
        helperKey: "guidedActions.health.medicationHelp.steps.urgency.helper",
        helperFallback:
          "This helps VYVA choose between routine help and a safer urgent step.",
        choices: [
          {
            id: "now",
            value: "now",
            labelKey: "guidedActions.health.medicationHelp.choices.now",
            labelFallback: "Now",
          },
          {
            id: "today",
            value: "today",
            labelKey: "guidedActions.health.medicationHelp.choices.today",
            labelFallback: "Today",
          },
          {
            id: "this_week",
            value: "this_week",
            labelKey: "guidedActions.health.medicationHelp.choices.thisWeek",
            labelFallback: "This week",
          },
          {
            id: "routine",
            value: "routine",
            labelKey: "guidedActions.health.medicationHelp.choices.routine",
            labelFallback: "Routine",
          },
        ],
      },
      {
        id: "next_step",
        slot: "next_step",
        input: "single_choice",
        titleKey: "guidedActions.health.medicationHelp.steps.nextStep.title",
        titleFallback: "What should VYVA prepare?",
        helperKey: "guidedActions.health.medicationHelp.steps.nextStep.helper",
        helperFallback:
          "VYVA prepares the request. You confirm before anything is sent.",
        choices: [
          {
            id: "call_pharmacy",
            value: "call_pharmacy",
            labelKey:
              "guidedActions.health.medicationHelp.choices.callPharmacy",
            labelFallback: "Ask saved pharmacy",
          },
          {
            id: "message_doctor",
            value: "message_doctor",
            labelKey:
              "guidedActions.health.medicationHelp.choices.messageDoctor",
            labelFallback: "Message doctor",
          },
          {
            id: "add_reminder",
            value: "add_reminder",
            labelKey: "guidedActions.health.medicationHelp.choices.addReminder",
            labelFallback: "Add reminder",
          },
          {
            id: "review_list",
            value: "review_list",
            labelKey: "guidedActions.health.medicationHelp.choices.reviewList",
            labelFallback: "Review list",
          },
          {
            id: "ask_vyva",
            value: "ask_vyva",
            labelKey: "guidedActions.health.medicationHelp.choices.askVyva",
            labelFallback: "Let VYVA choose",
          },
        ],
      },
    ],
  },
};

export function getGuidedActionFlow(ref: GuidedFlowRef) {
  return guidedActionFlows[ref];
}
