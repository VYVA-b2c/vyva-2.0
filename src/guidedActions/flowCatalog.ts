export type GuidedFlowRef =
  | "concierge.book_ride"
  | "concierge.book_medical_appointment"
  | "concierge.paperwork_help"
  | "concierge.provider_comparison"
  | "concierge.company_document_review"
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
  "concierge.paperwork_help": {
    ref: "concierge.paperwork_help",
    titleKey: "guidedActions.concierge.paperworkHelp.title",
    titleFallback: "Paperwork help",
    introKey: "guidedActions.concierge.paperworkHelp.intro",
    introFallback:
      "Answer only what is missing. VYVA prepares the next step and asks before anything is sent, uploaded, or submitted.",
    completionKey: "guidedActions.concierge.paperworkHelp.completion",
    completionFallback: "Paperwork request ready.",
    confirmationKey: "guidedActions.concierge.paperworkHelp.confirmation",
    confirmationFallback:
      "VYVA can summarize, draft, or prepare a form. You confirm before any call, email, upload, application, or shared data.",
    steps: [
      {
        id: "task",
        slot: "task",
        input: "single_choice",
        titleKey: "guidedActions.concierge.paperworkHelp.steps.task.title",
        titleFallback: "What kind of admin help is this?",
        helperKey: "guidedActions.concierge.paperworkHelp.steps.task.helper",
        helperFallback: "Choose the closest match. You can type the exact task.",
        textPlaceholderKey:
          "guidedActions.concierge.paperworkHelp.steps.task.placeholder",
        textPlaceholderFallback: "Passport renewal, benefit form, letter...",
        allowCustomAnswer: true,
        customAnswerLabelKey:
          "guidedActions.concierge.paperworkHelp.customAnswer",
        customAnswerLabelFallback: "Use typed answer",
        choices: [
          {
            id: "government_form",
            value: "government_form",
            labelKey:
              "guidedActions.concierge.paperworkHelp.choices.governmentForm",
            labelFallback: "Government form",
          },
          {
            id: "health_insurance_admin",
            value: "health_insurance_admin",
            labelKey:
              "guidedActions.concierge.paperworkHelp.choices.healthInsurance",
            labelFallback: "Health or insurance",
          },
          {
            id: "letter_or_document",
            value: "letter_or_document",
            labelKey:
              "guidedActions.concierge.paperworkHelp.choices.letterDocument",
            labelFallback: "Letter or document",
          },
          {
            id: "bill_or_invoice",
            value: "bill_or_invoice",
            labelKey:
              "guidedActions.concierge.paperworkHelp.choices.billInvoice",
            labelFallback: "Bill or invoice",
          },
          {
            id: "application",
            value: "application",
            labelKey:
              "guidedActions.concierge.paperworkHelp.choices.application",
            labelFallback: "Application",
          },
        ],
      },
      {
        id: "document_status",
        slot: "document_status",
        input: "single_choice",
        titleKey:
          "guidedActions.concierge.paperworkHelp.steps.documentStatus.title",
        titleFallback: "What do you already have?",
        helperKey:
          "guidedActions.concierge.paperworkHelp.steps.documentStatus.helper",
        helperFallback:
          "VYVA will not ask you to upload or share anything until you confirm.",
        choices: [
          {
            id: "have_document",
            value: "have_document",
            labelKey:
              "guidedActions.concierge.paperworkHelp.choices.haveDocument",
            labelFallback: "I have the document",
          },
          {
            id: "need_form",
            value: "need_form",
            labelKey:
              "guidedActions.concierge.paperworkHelp.choices.needForm",
            labelFallback: "Need the form",
          },
          {
            id: "need_draft",
            value: "need_draft",
            labelKey:
              "guidedActions.concierge.paperworkHelp.choices.needDraft",
            labelFallback: "Need a draft",
          },
          {
            id: "only_question",
            value: "only_question",
            labelKey:
              "guidedActions.concierge.paperworkHelp.choices.onlyQuestion",
            labelFallback: "Just a question",
          },
        ],
      },
      {
        id: "deadline",
        slot: "deadline",
        input: "single_choice",
        titleKey: "guidedActions.concierge.paperworkHelp.steps.deadline.title",
        titleFallback: "Is there a deadline?",
        helperKey: "guidedActions.concierge.paperworkHelp.steps.deadline.helper",
        helperFallback: "A rough timing is enough.",
        textPlaceholderKey:
          "guidedActions.concierge.paperworkHelp.steps.deadline.placeholder",
        textPlaceholderFallback: "Date or timing...",
        allowCustomAnswer: true,
        customAnswerLabelKey:
          "guidedActions.concierge.paperworkHelp.customAnswer",
        customAnswerLabelFallback: "Use typed answer",
        choices: [
          {
            id: "today",
            value: "today",
            labelKey: "guidedActions.concierge.paperworkHelp.choices.today",
            labelFallback: "Today",
          },
          {
            id: "this_week",
            value: "this_week",
            labelKey: "guidedActions.concierge.paperworkHelp.choices.thisWeek",
            labelFallback: "This week",
          },
          {
            id: "specific_date",
            value: "specific_date",
            labelKey:
              "guidedActions.concierge.paperworkHelp.choices.specificDate",
            labelFallback: "Specific date",
            requiresCustomAnswer: true,
          },
          {
            id: "no_deadline",
            value: "no_deadline",
            labelKey:
              "guidedActions.concierge.paperworkHelp.choices.noDeadline",
            labelFallback: "No deadline",
          },
        ],
      },
      {
        id: "next_step",
        slot: "next_step",
        input: "single_choice",
        titleKey: "guidedActions.concierge.paperworkHelp.steps.nextStep.title",
        titleFallback: "What should VYVA prepare?",
        helperKey: "guidedActions.concierge.paperworkHelp.steps.nextStep.helper",
        helperFallback:
          "This chooses the draft action. You still confirm before it happens.",
        choices: [
          {
            id: "explain",
            value: "explain",
            labelKey: "guidedActions.concierge.paperworkHelp.choices.explain",
            labelFallback: "Explain it",
          },
          {
            id: "checklist",
            value: "checklist",
            labelKey:
              "guidedActions.concierge.paperworkHelp.choices.checklist",
            labelFallback: "Checklist",
          },
          {
            id: "draft_message",
            value: "draft_message",
            labelKey:
              "guidedActions.concierge.paperworkHelp.choices.draftMessage",
            labelFallback: "Draft email/message",
          },
          {
            id: "fill_form",
            value: "fill_form",
            labelKey: "guidedActions.concierge.paperworkHelp.choices.fillForm",
            labelFallback: "Prepare form",
          },
          {
            id: "prepare_call",
            value: "prepare_call",
            labelKey:
              "guidedActions.concierge.paperworkHelp.choices.prepareCall",
            labelFallback: "Prepare call",
          },
        ],
      },
    ],
  },
  "concierge.provider_comparison": {
    ref: "concierge.provider_comparison",
    titleKey: "guidedActions.concierge.providerComparison.title",
    titleFallback: "Compare options",
    introKey: "guidedActions.concierge.providerComparison.intro",
    introFallback:
      "VYVA compares providers, services, or deals neutrally. No one is contacted without confirmation.",
    completionKey: "guidedActions.concierge.providerComparison.completion",
    completionFallback: "Comparison brief ready.",
    confirmationKey: "guidedActions.concierge.providerComparison.confirmation",
    confirmationFallback:
      "VYVA can compare trusted options first. You confirm before any call, email, booking, purchase, or shared data.",
    steps: [
      {
        id: "category",
        slot: "category",
        input: "single_choice",
        titleKey:
          "guidedActions.concierge.providerComparison.steps.category.title",
        titleFallback: "What do you want to compare?",
        helperKey:
          "guidedActions.concierge.providerComparison.steps.category.helper",
        helperFallback: "Pick the closest category, or type your own.",
        textPlaceholderKey:
          "guidedActions.concierge.providerComparison.steps.category.placeholder",
        textPlaceholderFallback: "Dentist, insurance, residence, cleaner...",
        allowCustomAnswer: true,
        customAnswerLabelKey:
          "guidedActions.concierge.providerComparison.customAnswer",
        customAnswerLabelFallback: "Use typed answer",
        choices: [
          {
            id: "health_provider",
            value: "health_provider",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.healthProvider",
            labelFallback: "Health provider",
          },
          {
            id: "home_service",
            value: "home_service",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.homeService",
            labelFallback: "Home service",
          },
          {
            id: "residence",
            value: "residence",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.residence",
            labelFallback: "Residence/care",
          },
          {
            id: "insurance_or_deal",
            value: "insurance_or_deal",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.insuranceDeal",
            labelFallback: "Insurance or deal",
          },
          {
            id: "local_business",
            value: "local_business",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.localBusiness",
            labelFallback: "Local business",
          },
        ],
      },
      {
        id: "goal",
        slot: "goal",
        input: "multi_choice",
        titleKey: "guidedActions.concierge.providerComparison.steps.goal.title",
        titleFallback: "What matters most?",
        helperKey: "guidedActions.concierge.providerComparison.steps.goal.helper",
        helperFallback:
          "Pick what VYVA should prioritize when comparing options.",
        choices: [
          {
            id: "lowest_cost",
            value: "lowest_cost",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.lowestCost",
            labelFallback: "Lower cost",
          },
          {
            id: "most_trusted",
            value: "most_trusted",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.mostTrusted",
            labelFallback: "Most trusted",
          },
          {
            id: "closest",
            value: "closest",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.closest",
            labelFallback: "Closest",
          },
          {
            id: "accessibility",
            value: "accessibility",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.accessibility",
            labelFallback: "Accessibility",
          },
          {
            id: "availability",
            value: "availability",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.availability",
            labelFallback: "Availability",
          },
          {
            id: "safest_terms",
            value: "safest_terms",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.safestTerms",
            labelFallback: "Safer terms",
          },
        ],
      },
      {
        id: "current_provider",
        slot: "current_provider",
        input: "single_choice",
        titleKey:
          "guidedActions.concierge.providerComparison.steps.currentProvider.title",
        titleFallback: "Should VYVA use a saved provider?",
        helperKey:
          "guidedActions.concierge.providerComparison.steps.currentProvider.helper",
        helperFallback:
          "Use a saved provider if relevant, name one, or ask VYVA to find options.",
        textPlaceholderKey:
          "guidedActions.concierge.providerComparison.steps.currentProvider.placeholder",
        textPlaceholderFallback: "Provider or company name...",
        allowCustomAnswer: true,
        customAnswerLabelKey:
          "guidedActions.concierge.providerComparison.customAnswer",
        customAnswerLabelFallback: "Use typed answer",
        choices: [
          {
            id: "saved_provider",
            value: "saved_provider",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.savedProvider",
            labelFallback: "Saved provider",
          },
          {
            id: "named_provider",
            value: "named_provider",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.namedProvider",
            labelFallback: "Type a name",
            requiresCustomAnswer: true,
          },
          {
            id: "find_new",
            value: "find_new",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.findNew",
            labelFallback: "Find options",
          },
          {
            id: "not_sure",
            value: "not_sure",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.notSure",
            labelFallback: "Not sure",
          },
        ],
      },
      {
        id: "next_step",
        slot: "next_step",
        input: "single_choice",
        titleKey:
          "guidedActions.concierge.providerComparison.steps.nextStep.title",
        titleFallback: "What should happen next?",
        helperKey:
          "guidedActions.concierge.providerComparison.steps.nextStep.helper",
        helperFallback:
          "VYVA prepares the next step and waits for confirmation before action.",
        choices: [
          {
            id: "compare_options",
            value: "compare_options",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.compareOptions",
            labelFallback: "Compare options",
          },
          {
            id: "review_one",
            value: "review_one",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.reviewOne",
            labelFallback: "Review one option",
          },
          {
            id: "prepare_call_email",
            value: "prepare_call_email",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.prepareCallEmail",
            labelFallback: "Prepare call/email",
          },
          {
            id: "watch_changes",
            value: "watch_changes",
            labelKey:
              "guidedActions.concierge.providerComparison.choices.watchChanges",
            labelFallback: "Watch changes",
          },
        ],
      },
    ],
  },
  "concierge.company_document_review": {
    ref: "concierge.company_document_review",
    titleKey: "guidedActions.concierge.companyDocumentReview.title",
    titleFallback: "Review safely",
    introKey: "guidedActions.concierge.companyDocumentReview.intro",
    introFallback:
      "VYVA checks messages, companies, documents, and offers before you reply or share data.",
    completionKey: "guidedActions.concierge.companyDocumentReview.completion",
    completionFallback: "Safe review brief ready.",
    confirmationKey:
      "guidedActions.concierge.companyDocumentReview.confirmation",
    confirmationFallback:
      "VYVA prepares a safe review. You confirm before replies, calls, uploads, applications, payments, or shared personal data.",
    steps: [
      {
        id: "item_type",
        slot: "item_type",
        input: "single_choice",
        titleKey:
          "guidedActions.concierge.companyDocumentReview.steps.itemType.title",
        titleFallback: "What should VYVA review?",
        helperKey:
          "guidedActions.concierge.companyDocumentReview.steps.itemType.helper",
        helperFallback: "Choose the closest item, or type your own.",
        textPlaceholderKey:
          "guidedActions.concierge.companyDocumentReview.steps.itemType.placeholder",
        textPlaceholderFallback: "Company, contract, suspicious letter...",
        allowCustomAnswer: true,
        customAnswerLabelKey:
          "guidedActions.concierge.companyDocumentReview.customAnswer",
        customAnswerLabelFallback: "Use typed answer",
        choices: [
          {
            id: "suspicious_message",
            value: "suspicious_message",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.suspiciousMessage",
            labelFallback: "Suspicious message",
          },
          {
            id: "company_offer",
            value: "company_offer",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.companyOffer",
            labelFallback: "Company/offer",
          },
          {
            id: "contract_policy",
            value: "contract_policy",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.contractPolicy",
            labelFallback: "Contract/policy",
          },
          {
            id: "bill_invoice",
            value: "bill_invoice",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.billInvoice",
            labelFallback: "Bill/invoice",
          },
          {
            id: "official_document",
            value: "official_document",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.officialDocument",
            labelFallback: "Official document",
          },
        ],
      },
      {
        id: "concern",
        slot: "concern",
        input: "multi_choice",
        titleKey:
          "guidedActions.concierge.companyDocumentReview.steps.concern.title",
        titleFallback: "What worries you?",
        helperKey:
          "guidedActions.concierge.companyDocumentReview.steps.concern.helper",
        helperFallback: "Pick all that apply.",
        choices: [
          {
            id: "scam_risk",
            value: "scam_risk",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.scamRisk",
            labelFallback: "Scam risk",
          },
          {
            id: "price_terms",
            value: "price_terms",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.priceTerms",
            labelFallback: "Price or terms",
          },
          {
            id: "deadline",
            value: "deadline",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.deadline",
            labelFallback: "Deadline",
          },
          {
            id: "documents_needed",
            value: "documents_needed",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.documentsNeeded",
            labelFallback: "Documents needed",
          },
          {
            id: "identity_data",
            value: "identity_data",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.identityData",
            labelFallback: "Personal data",
          },
          {
            id: "not_sure",
            value: "not_sure",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.notSure",
            labelFallback: "Not sure",
          },
        ],
      },
      {
        id: "source",
        slot: "source",
        input: "single_choice",
        titleKey:
          "guidedActions.concierge.companyDocumentReview.steps.source.title",
        titleFallback: "Where did it come from?",
        helperKey:
          "guidedActions.concierge.companyDocumentReview.steps.source.helper",
        helperFallback:
          "This helps VYVA choose safer verification steps.",
        choices: [
          {
            id: "email_sms",
            value: "email_sms",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.emailSms",
            labelFallback: "Email or SMS",
          },
          {
            id: "paper_letter",
            value: "paper_letter",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.paperLetter",
            labelFallback: "Paper letter",
          },
          {
            id: "phone_call",
            value: "phone_call",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.phoneCall",
            labelFallback: "Phone call",
          },
          {
            id: "website_form",
            value: "website_form",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.websiteForm",
            labelFallback: "Website/form",
          },
          {
            id: "uploaded_document",
            value: "uploaded_document",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.uploadedDocument",
            labelFallback: "Document/photo",
          },
          {
            id: "spoken_summary",
            value: "spoken_summary",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.spokenSummary",
            labelFallback: "I will describe it",
          },
        ],
      },
      {
        id: "next_step",
        slot: "next_step",
        input: "single_choice",
        titleKey:
          "guidedActions.concierge.companyDocumentReview.steps.nextStep.title",
        titleFallback: "What should VYVA prepare?",
        helperKey:
          "guidedActions.concierge.companyDocumentReview.steps.nextStep.helper",
        helperFallback:
          "Choose a safe next step. VYVA will stop before contacting or sharing anything.",
        choices: [
          {
            id: "summarize_risks",
            value: "summarize_risks",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.summarizeRisks",
            labelFallback: "Summarize risks",
          },
          {
            id: "draft_reply",
            value: "draft_reply",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.draftReply",
            labelFallback: "Draft reply",
          },
          {
            id: "compare_company",
            value: "compare_company",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.compareCompany",
            labelFallback: "Compare company",
          },
          {
            id: "prepare_trusted_contact",
            value: "prepare_trusted_contact",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.prepareTrustedContact",
            labelFallback: "Ask trusted contact",
          },
          {
            id: "prepare_form_application",
            value: "prepare_form_application",
            labelKey:
              "guidedActions.concierge.companyDocumentReview.choices.prepareFormApplication",
            labelFallback: "Prepare form/application",
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
