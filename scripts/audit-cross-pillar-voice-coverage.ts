import {
  homeSubflowForVoiceToolCall,
  homeSubflowForVoiceUtterance,
  VOICE_COVERAGE_LANGUAGES,
  VOICE_HOME_SUBFLOW_PILLARS,
  VOICE_HOME_SUBFLOW_SAMPLE_PHRASES,
  type VoiceHomeSubflowId,
} from "../src/lib/voiceNavigation";

const EXPECTED_ACTIONS = 18;
const EXPECTED_LANGUAGES = 6;
const EXPECTED_LANGUAGE_CASES = EXPECTED_ACTIONS * EXPECTED_LANGUAGES;

const toolCases: Array<{
  actionId: VoiceHomeSubflowId;
  parameters: Record<string, string>;
}> = [
  { actionId: "health-symptoms", parameters: { action_type: "health.symptoms" } },
  { actionId: "health-vitals", parameters: { action_type: "health.vitals" } },
  { actionId: "health-meds", parameters: { action_type: "medication" } },
  { actionId: "health-doctor", parameters: { action_type: "health.doctor_support" } },
  { actionId: "health-prevention", parameters: { action_type: "health.prevention" } },
  { actionId: "health-visual-scan", parameters: { action_type: "health.visual_scan" } },
  { actionId: "mind-memory", parameters: { action_type: "brain.memory" } },
  { actionId: "mind-reflexes", parameters: { action_type: "brain.reflex" } },
  { actionId: "mind-focus", parameters: { action_type: "brain.focus" } },
  { actionId: "mind-senses", parameters: { action_type: "brain.senses" } },
  { actionId: "community-friends", parameters: { action_type: "social.friend" } },
  { actionId: "community-experts", parameters: { action_type: "social.expert" } },
  { actionId: "community-share", parameters: { action_type: "social.share" } },
  { actionId: "community-activities", parameters: { action_type: "social.event" } },
  { actionId: "concierge-home", parameters: { action_type: "concierge.home_service" } },
  { actionId: "concierge-care", parameters: { action_type: "concierge.provider_contact" } },
  { actionId: "concierge-order", parameters: { action_type: "concierge.shopping" } },
  { actionId: "concierge-book", parameters: { action_type: "concierge.ride" } },
];

const actionIds = Object.keys(VOICE_HOME_SUBFLOW_SAMPLE_PHRASES) as VoiceHomeSubflowId[];
const failures: string[] = [];
let passingLanguageCases = 0;
let passingToolCases = 0;

for (const actionId of actionIds) {
  for (const language of VOICE_COVERAGE_LANGUAGES) {
    const phrase = VOICE_HOME_SUBFLOW_SAMPLE_PHRASES[actionId]?.[language];
    const resolved = phrase ? homeSubflowForVoiceUtterance(phrase) : null;
    if (resolved?.actionId === actionId && resolved.pillar === VOICE_HOME_SUBFLOW_PILLARS[actionId]) {
      passingLanguageCases += 1;
    } else {
      failures.push(`${language}/${actionId}: ${JSON.stringify(phrase)} resolved to ${JSON.stringify(resolved)}`);
    }
  }
}

for (const { actionId, parameters } of toolCases) {
  const resolved = homeSubflowForVoiceToolCall(parameters);
  if (resolved?.actionId === actionId && resolved.pillar === VOICE_HOME_SUBFLOW_PILLARS[actionId]) {
    passingToolCases += 1;
  } else {
    failures.push(`tool/${actionId}: ${JSON.stringify(parameters)} resolved to ${JSON.stringify(resolved)}`);
  }
}

const shapeIsComplete = actionIds.length === EXPECTED_ACTIONS
  && VOICE_COVERAGE_LANGUAGES.length === EXPECTED_LANGUAGES
  && toolCases.length === EXPECTED_ACTIONS;

console.log("Cross-pillar voice coverage audit");
console.log(`Actions: ${actionIds.length}/${EXPECTED_ACTIONS}`);
console.log(`Languages per action: ${VOICE_COVERAGE_LANGUAGES.length}/${EXPECTED_LANGUAGES}`);
console.log(`Localized language/action cases: ${passingLanguageCases}/${EXPECTED_LANGUAGE_CASES}`);
console.log(`Agent tool mappings: ${passingToolCases}/${EXPECTED_ACTIONS}`);

if (!shapeIsComplete || failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log("PASS All cross-pillar voice coverage checks passed.");
}
