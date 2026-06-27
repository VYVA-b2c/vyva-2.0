export const VYVA_UI_COPY = {
  appName: "VYVA",
  subtitle: "A voice-first wellbeing companion for seniors living alone.",
  disclaimers: {
    wellbeing: "VYVA supports wellbeing and is not a medical service.",
    medication: "Medication reminders do not replace advice from your doctor or pharmacist.",
    emergency: "In an emergency, call local emergency services.",
  },
  demoLogin: {
    maria: "Continue as Maria, Senior",
    john: "Continue as John, Senior",
    ana: "Continue as Ana, Caregiver",
  },
  seniorHome: {
    greeting: (name: string) => `Good morning, ${name}.`,
    dailyCheckIn: "Daily Check-In",
    weeklyCheckIn: "Brain & Wellbeing Check-In",
    myWeek: "My Week",
    medicationRoutine: "Medication & Routine",
    smallStep: "Small Step for Today",
    askForHelp: "Ask for Help",
  },
  weekly: {
    introTitle: "Let's check how your week is going.",
    introBody: "This short check-in helps VYVA notice what is steady and what may need support.",
    progress: (current: number, total: number) => `Question ${current} of ${total}`,
    completeTitle: "Thank you. Your weekly check-in is complete.",
    completeBody: "VYVA will use this to support your wellbeing pattern over time.",
    viewMyWeek: "View My Week",
  },
  myWeek: {
    title: "My Week",
    steady: "What looked steady",
    changed: "What changed",
    smallStep: "One small step",
    share: "Share this summary with my caregiver",
  },
  caregiver: {
    dashboardTitle: "Caregiver Dashboard",
    seniorsMonitored: "Seniors monitored",
    checkInsThisWeek: "Check-ins this week",
    openAlerts: "Open alerts",
    medicationConfirmations: "Medication confirmations",
    consentOff: "Sharing consent is not enabled.",
    markReviewed: "Mark as reviewed",
    addNote: "Add note",
  },
} as const;

export const VYVA_BANNED_UI_TERMS = [
  "dementia",
  "alzheimer",
  "mci",
  "clinical risk",
  "cognitive impairment",
  "disease prediction",
  "medical score",
  "pathology",
] as const;

export function textHasBannedVyvaUiTerm(text: string) {
  const lower = text.toLowerCase();
  return VYVA_BANNED_UI_TERMS.some((term) => lower.includes(term));
}
