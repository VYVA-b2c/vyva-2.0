/**
 * VYVA Weekly Brain & Wellbeing Check-In question bank.
 * Wellness-first. No clinical labels.
 * Codex can adapt this file into prisma/seed.ts or src/lib/question-bank.ts.
 */

export type VyvaQuestionSeed = {
  id: string;
  domain: string;
  questionText: string;
  answerType: string;
  cadence: "WEEKLY";
  burdenLevel: "LOW" | "MEDIUM" | "HIGH";
  preventionDomain?: string;
  triggerRule?: string | null;
  cooldownDays: number;
  active: boolean;
  options?: unknown;
};

export type VyvaWeeklyFormSeed = {
  weekNumber: number;
  title: string;
  questionIds: string[];
};

export const VYVA_WEEKLY_QUESTION_BANK: VyvaQuestionSeed[] = [
  {
    "id": "CORE-01",
    "domain": "global_wellbeing",
    "questionText": "Compared with your usual self, how has this week felt overall?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "global_wellbeing",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "CORE-02",
    "domain": "mood",
    "questionText": "What was the best part of your week, even if it was small?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mood",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true
  },
  {
    "id": "CORE-03",
    "domain": "global_wellbeing",
    "questionText": "Was there anything this week that felt harder than usual?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "global_wellbeing",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true
  },
  {
    "id": "CORE-04",
    "domain": "social",
    "questionText": "Did you have at least one real conversation with someone this week?",
    "answerType": "SCALE_SOCIAL",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "social",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Yes, meaningful conversation",
      "A short exchange only",
      "Not really",
      "I avoided contact",
      "Not sure"
    ]
  },
  {
    "id": "CORE-05",
    "domain": "sleep",
    "questionText": "Did your sleep leave you feeling rested this week?",
    "answerType": "SCALE_DIFFICULTY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "sleep",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Easy",
      "A little difficult",
      "Very difficult",
      "I could not do it",
      "Not applicable"
    ]
  },
  {
    "id": "CORE-06",
    "domain": "routine",
    "questionText": "Did you keep your normal medication or daily routine this week?",
    "answerType": "SCALE_DIFFICULTY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "routine",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Easy",
      "A little difficult",
      "Very difficult",
      "I could not do it",
      "Not applicable"
    ]
  },
  {
    "id": "CORE-07",
    "domain": "routine",
    "questionText": "Would one small reminder, call, walk, meal, or rest plan help next week?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "prevention",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "MOOD-01",
    "domain": "mood",
    "questionText": "Compared with your usual self, how was your mood this week?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mood",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "MOOD-02",
    "domain": "mood",
    "questionText": "Did anything make the week feel heavier than usual?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mood",
    "triggerRule": "trigger when mood trend worsens or caregiver note mentions mood",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "MOOD-03",
    "domain": "mood",
    "questionText": "Did you lose interest in something you normally enjoy?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mood",
    "triggerRule": "trigger when mood trend worsens or caregiver note mentions mood",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "MOOD-04",
    "domain": "mood",
    "questionText": "Did you feel worried, tense, or unsettled more than usual?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mood",
    "triggerRule": "trigger when mood trend worsens or caregiver note mentions mood",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "MOOD-05",
    "domain": "mood",
    "questionText": "Did you feel calm at any point this week? What helped?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mood",
    "triggerRule": "trigger when mood trend worsens or caregiver note mentions mood",
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "MOOD-06",
    "domain": "mood",
    "questionText": "Did you avoid doing something because you did not feel up to it emotionally?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mood",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "MOOD-07",
    "domain": "mood",
    "questionText": "Would talking to someone you trust help this week?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mood",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "MOOD-08",
    "domain": "mood",
    "questionText": "What usually helps you feel a little better when a day is difficult?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mood",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "SOC-01",
    "domain": "social",
    "questionText": "Did you have a real conversation with someone this week?",
    "answerType": "SCALE_SOCIAL",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "social",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Yes, meaningful conversation",
      "A short exchange only",
      "Not really",
      "I avoided contact",
      "Not sure"
    ]
  },
  {
    "id": "SOC-02",
    "domain": "social",
    "questionText": "Did you feel left out or disconnected this week?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "social",
    "triggerRule": "trigger when social trend worsens or caregiver note mentions social",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "SOC-03",
    "domain": "social",
    "questionText": "Did you avoid calling or seeing someone because it felt tiring?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "social",
    "triggerRule": "trigger when social trend worsens or caregiver note mentions social",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "SOC-04",
    "domain": "social",
    "questionText": "Who would you most like to hear from this week?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "social",
    "triggerRule": "trigger when social trend worsens or caregiver note mentions social",
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "SOC-05",
    "domain": "social",
    "questionText": "Did you cancel, postpone, or skip a social plan?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "social",
    "triggerRule": "trigger when social trend worsens or caregiver note mentions social",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "SOC-06",
    "domain": "social",
    "questionText": "Did you spend more time alone than you wanted to?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "social",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "SOC-07",
    "domain": "social",
    "questionText": "Would you like VYVA to help plan a short call or message?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "social",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "SOC-08",
    "domain": "social",
    "questionText": "Was there a moment this week when you felt connected to someone?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "social",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "SLEEP-01",
    "domain": "sleep",
    "questionText": "Did you wake up feeling rested most mornings this week?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "sleep",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "SLEEP-02",
    "domain": "sleep",
    "questionText": "Was your sleep worse than usual this week?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "sleep",
    "triggerRule": "trigger when sleep trend worsens or caregiver note mentions sleep",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "SLEEP-03",
    "domain": "sleep",
    "questionText": "Did tiredness stop you from doing something important?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "sleep",
    "triggerRule": "trigger when sleep trend worsens or caregiver note mentions sleep",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "SLEEP-04",
    "domain": "sleep",
    "questionText": "Did you nap more than usual this week?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "sleep",
    "triggerRule": "trigger when sleep trend worsens or caregiver note mentions sleep",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "SLEEP-05",
    "domain": "sleep",
    "questionText": "Did you wake up during the night and have trouble returning to sleep?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "sleep",
    "triggerRule": "trigger when sleep trend worsens or caregiver note mentions sleep",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "SLEEP-06",
    "domain": "sleep",
    "questionText": "Was there a time of day when your energy was best?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "sleep",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "SLEEP-07",
    "domain": "sleep",
    "questionText": "Would an evening wind-down reminder help?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "sleep",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "SLEEP-08",
    "domain": "sleep",
    "questionText": "Did poor sleep affect your mood, memory, or patience this week?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "sleep",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "ROUT-01",
    "domain": "routine",
    "questionText": "Was anything in your daily routine harder to manage this week?",
    "answerType": "SCALE_DIFFICULTY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "routine",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Easy",
      "A little difficult",
      "Very difficult",
      "I could not do it",
      "Not applicable"
    ]
  },
  {
    "id": "ROUT-02",
    "domain": "routine",
    "questionText": "Did you take your medication as planned this week?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "routine",
    "triggerRule": "trigger when routine trend worsens or caregiver note mentions routine",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "ROUT-03",
    "domain": "routine",
    "questionText": "What got in the way of your medication routine, if anything?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "routine",
    "triggerRule": "trigger when routine trend worsens or caregiver note mentions routine",
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "ROUT-04",
    "domain": "routine",
    "questionText": "Would a different reminder time help?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "routine",
    "triggerRule": "trigger when routine trend worsens or caregiver note mentions routine",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "ROUT-05",
    "domain": "routine",
    "questionText": "Did you miss or delay any appointment, call, or task you meant to do?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "routine",
    "triggerRule": "trigger when routine trend worsens or caregiver note mentions routine",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "ROUT-06",
    "domain": "routine",
    "questionText": "Did the day feel organized, or did it feel hard to get started?",
    "answerType": "SCALE_DIFFICULTY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "routine",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Easy",
      "A little difficult",
      "Very difficult",
      "I could not do it",
      "Not applicable"
    ]
  },
  {
    "id": "ROUT-07",
    "domain": "routine",
    "questionText": "Was there a part of your routine that worked well this week?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "routine",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "ROUT-08",
    "domain": "routine",
    "questionText": "Would a simple morning plan help tomorrow?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "routine",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "FOOD-01",
    "domain": "nutrition",
    "questionText": "Did you eat at least one proper meal most days this week?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "nutrition",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "FOOD-02",
    "domain": "nutrition",
    "questionText": "Did you drink enough water most days?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "nutrition",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "FOOD-03",
    "domain": "nutrition",
    "questionText": "Was cooking or preparing food harder than usual?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "nutrition",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "FOOD-04",
    "domain": "nutrition",
    "questionText": "Did you skip a meal because you were tired, low, or forgot?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "nutrition",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "FOOD-05",
    "domain": "nutrition",
    "questionText": "Was grocery shopping, ordering food, or preparing meals difficult?",
    "answerType": "SCALE_DIFFICULTY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "nutrition",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Easy",
      "A little difficult",
      "Very difficult",
      "I could not do it",
      "Not applicable"
    ]
  },
  {
    "id": "FOOD-06",
    "domain": "nutrition",
    "questionText": "Would a meal or water reminder help next week?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "nutrition",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "FOOD-07",
    "domain": "nutrition",
    "questionText": "What meal felt easiest for you this week?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "nutrition",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "FOOD-08",
    "domain": "nutrition",
    "questionText": "Did food, appetite, or cooking feel different from your usual pattern?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "nutrition",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "MOB-01",
    "domain": "mobility",
    "questionText": "Did you leave home this week?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mobility",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "MOB-02",
    "domain": "mobility",
    "questionText": "Did you feel steady moving around your home?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mobility",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "MOB-03",
    "domain": "mobility",
    "questionText": "Did you avoid going out because you felt unsure or tired?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mobility",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "MOB-04",
    "domain": "mobility",
    "questionText": "Was getting up, walking, or climbing stairs harder than usual?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mobility",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "MOB-05",
    "domain": "mobility",
    "questionText": "Did pain, tiredness, or fear of falling stop you doing something?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mobility",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "MOB-06",
    "domain": "mobility",
    "questionText": "Was there a safe time this week when you felt able to move or walk a little?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mobility",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "MOB-07",
    "domain": "mobility",
    "questionText": "Would a gentle movement reminder help, only when you feel safe?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mobility",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "MOB-08",
    "domain": "mobility",
    "questionText": "Did you need more support than usual moving around?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mobility",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "PAIN-01",
    "domain": "pain_fatigue",
    "questionText": "Did pain make anything harder this week?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "pain_fatigue",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "PAIN-02",
    "domain": "pain_fatigue",
    "questionText": "Was your energy lower than usual?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "pain_fatigue",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "PAIN-03",
    "domain": "pain_fatigue",
    "questionText": "Did you cancel or delay something because of pain or tiredness?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "pain_fatigue",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "PAIN-04",
    "domain": "pain_fatigue",
    "questionText": "Is there a time of day when you usually feel strongest?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "pain_fatigue",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "PAIN-05",
    "domain": "pain_fatigue",
    "questionText": "Did pain or fatigue affect your mood this week?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "pain_fatigue",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "PAIN-06",
    "domain": "pain_fatigue",
    "questionText": "Did you rest more than usual this week?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "pain_fatigue",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "PAIN-07",
    "domain": "pain_fatigue",
    "questionText": "Would planning harder tasks for your best time of day help?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "pain_fatigue",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "PAIN-08",
    "domain": "pain_fatigue",
    "questionText": "Did anything help your energy, even a little?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "pain_fatigue",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "SENS-01",
    "domain": "hearing_vision",
    "questionText": "Was it harder than usual to hear conversations this week?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "hearing_vision",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "SENS-02",
    "domain": "hearing_vision",
    "questionText": "Did you ask people to repeat themselves more often?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "hearing_vision",
    "triggerRule": "trigger when hearing_vision trend worsens or caregiver note mentions hearing_vision",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "SENS-03",
    "domain": "hearing_vision",
    "questionText": "Did hearing difficulty make you avoid a call, visit, or activity?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "hearing_vision",
    "triggerRule": "trigger when hearing_vision trend worsens or caregiver note mentions hearing_vision",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "SENS-04",
    "domain": "hearing_vision",
    "questionText": "Was reading, seeing messages, or recognizing faces harder this week?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "hearing_vision",
    "triggerRule": "trigger when hearing_vision trend worsens or caregiver note mentions hearing_vision",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "SENS-05",
    "domain": "hearing_vision",
    "questionText": "Did vision difficulty make cooking, walking, reading, or using your phone harder?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "hearing_vision",
    "triggerRule": "trigger when hearing_vision trend worsens or caregiver note mentions hearing_vision",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "SENS-06",
    "domain": "hearing_vision",
    "questionText": "Would larger text, louder reminders, or slower speech from VYVA help?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "hearing_vision",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "SENS-07",
    "domain": "hearing_vision",
    "questionText": "Should VYVA speak more slowly or repeat key information?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "hearing_vision",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "SENS-08",
    "domain": "hearing_vision",
    "questionText": "Would it help to mention hearing or vision changes to someone you trust or a professional?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "hearing_vision",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "MEM-01",
    "domain": "subjective_memory",
    "questionText": "Have you noticed more forgetfulness than usual this week?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "subjective_memory",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "MEM-02",
    "domain": "subjective_memory",
    "questionText": "Did you misplace something important?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "subjective_memory",
    "triggerRule": "trigger when subjective_memory trend worsens or caregiver note mentions subjective_memory",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "MEM-03",
    "domain": "subjective_memory",
    "questionText": "Did you repeat a question or story and notice it afterward?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "subjective_memory",
    "triggerRule": "trigger when subjective_memory trend worsens or caregiver note mentions subjective_memory",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "MEM-04",
    "domain": "subjective_memory",
    "questionText": "Did you forget why you entered a room, opened your phone, or started a task?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "subjective_memory",
    "triggerRule": "trigger when subjective_memory trend worsens or caregiver note mentions subjective_memory",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "MEM-05",
    "domain": "subjective_memory",
    "questionText": "Did you feel worried about your memory this week?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "subjective_memory",
    "triggerRule": "trigger when subjective_memory trend worsens or caregiver note mentions subjective_memory",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "MEM-06",
    "domain": "subjective_memory",
    "questionText": "Did reminders from VYVA help you complete anything this week?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "subjective_memory",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "MEM-07",
    "domain": "subjective_memory",
    "questionText": "What is one thing you want help remembering next week?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "subjective_memory",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "MEM-08",
    "domain": "subjective_memory",
    "questionText": "Was there a moment when your memory worked well this week?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "subjective_memory",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "PLAN-01",
    "domain": "planning",
    "questionText": "Was it harder than usual to plan your day?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "planning",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "PLAN-02",
    "domain": "planning",
    "questionText": "Did bills, appointments, forms, or phone calls feel harder this week?",
    "answerType": "SCALE_DIFFICULTY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "planning",
    "triggerRule": "trigger when planning trend worsens or caregiver note mentions planning",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Easy",
      "A little difficult",
      "Very difficult",
      "I could not do it",
      "Not applicable"
    ]
  },
  {
    "id": "PLAN-03",
    "domain": "planning",
    "questionText": "Did you start something and forget to finish it?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "planning",
    "triggerRule": "trigger when planning trend worsens or caregiver note mentions planning",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "PLAN-04",
    "domain": "planning",
    "questionText": "Did you postpone something because it felt complicated?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "planning",
    "triggerRule": "trigger when planning trend worsens or caregiver note mentions planning",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "PLAN-05",
    "domain": "planning",
    "questionText": "Did you feel confident managing your appointments or errands?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "planning",
    "triggerRule": "trigger when planning trend worsens or caregiver note mentions planning",
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "PLAN-06",
    "domain": "planning",
    "questionText": "Would breaking tomorrow into two or three simple steps help?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "planning",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "PLAN-07",
    "domain": "planning",
    "questionText": "What is one task that felt too complicated this week?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "planning",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "PLAN-08",
    "domain": "planning",
    "questionText": "What is one task VYVA could help make easier?",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "planning",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "LANG-01",
    "domain": "language",
    "questionText": "Was it harder than usual to find the right word this week?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "LANG-02",
    "domain": "language",
    "questionText": "Did you lose track during a conversation, book, radio show, or TV program?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "LANG-03",
    "domain": "language",
    "questionText": "Did following a story or conversation feel harder than usual?",
    "answerType": "SCALE_CHANGE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Better than usual",
      "About the same",
      "A little worse than usual",
      "Much worse than usual",
      "Not sure"
    ]
  },
  {
    "id": "LANG-04",
    "domain": "language",
    "questionText": "Tell me about something you enjoyed this week.",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "LANG-05",
    "domain": "language",
    "questionText": "Tell me about a person you spoke with this week.",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "LANG-06",
    "domain": "language",
    "questionText": "Tell me what you did yesterday afternoon.",
    "answerType": "FREE_TEXT",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true
  },
  {
    "id": "LANG-07",
    "domain": "language",
    "questionText": "Did you stop speaking because the words would not come easily?",
    "answerType": "SCALE_FREQUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Not this week",
      "Once or twice",
      "Several times",
      "Most days",
      "Not sure"
    ]
  },
  {
    "id": "LANG-08",
    "domain": "language",
    "questionText": "Would you like VYVA to speak more slowly, repeat things, or summarize?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 21,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "STORY-01",
    "domain": "language",
    "questionText": "Ana called Maria on Tuesday morning. They talked about buying oranges and going to the pharmacy after lunch.",
    "answerType": "TASK_STORY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "STORY-02",
    "domain": "language",
    "questionText": "John put his blue umbrella by the door because he planned to visit the library before dinner.",
    "answerType": "TASK_STORY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "STORY-03",
    "domain": "language",
    "questionText": "Elena watered the plants, made tea, and wrote down a reminder to call her grandson on Friday.",
    "answerType": "TASK_STORY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "STORY-04",
    "domain": "language",
    "questionText": "Luis met a neighbor near the bakery and decided to walk home slowly because the weather was warm.",
    "answerType": "TASK_STORY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "STORY-05",
    "domain": "language",
    "questionText": "Maria placed her glasses on the kitchen table before preparing soup and listening to the radio.",
    "answerType": "TASK_STORY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "STORY-06",
    "domain": "language",
    "questionText": "Peter checked the calendar, paid one bill, and asked his daughter to visit on Sunday.",
    "answerType": "TASK_STORY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "PLAN-TASK-01",
    "domain": "planning",
    "questionText": "Imagine you have an appointment tomorrow morning. What would you do to get ready?",
    "answerType": "TASK_PLANNING",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "planning",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "PLAN-TASK-02",
    "domain": "planning",
    "questionText": "Imagine you want to make a simple lunch. What steps would you take?",
    "answerType": "TASK_PLANNING",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "planning",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "PLAN-TASK-03",
    "domain": "planning",
    "questionText": "Imagine you need to call a friend but do not know the best time. What would you do?",
    "answerType": "TASK_PLANNING",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "planning",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "PLAN-TASK-04",
    "domain": "planning",
    "questionText": "Imagine you are going out and it may rain. What would you prepare?",
    "answerType": "TASK_PLANNING",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "planning",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "PLAN-TASK-05",
    "domain": "planning",
    "questionText": "Imagine you need to remember medication, lunch, and a phone call. How would you organize the day?",
    "answerType": "TASK_PLANNING",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "planning",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "PLAN-TASK-06",
    "domain": "planning",
    "questionText": "Imagine the pharmacy is closed when you arrive. What would you do next?",
    "answerType": "TASK_PLANNING",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "planning",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "FLU-01",
    "domain": "language",
    "questionText": "Name as many animals as you can in 30 seconds.",
    "answerType": "TASK_FLUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true,
    "options": {
      "category": "Animals",
      "durationSeconds": 30
    }
  },
  {
    "id": "FLU-02",
    "domain": "language",
    "questionText": "Name as many foods as you can in 30 seconds.",
    "answerType": "TASK_FLUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true,
    "options": {
      "category": "Foods",
      "durationSeconds": 30
    }
  },
  {
    "id": "FLU-03",
    "domain": "language",
    "questionText": "Name as many things in a kitchen as you can in 30 seconds.",
    "answerType": "TASK_FLUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true,
    "options": {
      "category": "Things in a kitchen",
      "durationSeconds": 30
    }
  },
  {
    "id": "FLU-04",
    "domain": "language",
    "questionText": "Name as many things you can buy at a market as you can in 30 seconds.",
    "answerType": "TASK_FLUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true,
    "options": {
      "category": "Things you can buy at a market",
      "durationSeconds": 30
    }
  },
  {
    "id": "FLU-05",
    "domain": "language",
    "questionText": "Name as many places in a town as you can in 30 seconds.",
    "answerType": "TASK_FLUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true,
    "options": {
      "category": "Places in a town",
      "durationSeconds": 30
    }
  },
  {
    "id": "FLU-06",
    "domain": "language",
    "questionText": "Name as many things you wear as you can in 30 seconds.",
    "answerType": "TASK_FLUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true,
    "options": {
      "category": "Things you wear",
      "durationSeconds": 30
    }
  },
  {
    "id": "FLU-07",
    "domain": "language",
    "questionText": "Name as many things you do in the morning as you can in 30 seconds.",
    "answerType": "TASK_FLUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true,
    "options": {
      "category": "Things you do in the morning",
      "durationSeconds": 30
    }
  },
  {
    "id": "FLU-08",
    "domain": "language",
    "questionText": "Name as many people who help in a community as you can in 30 seconds.",
    "answerType": "TASK_FLUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true,
    "options": {
      "category": "People who help in a community",
      "durationSeconds": 30
    }
  },
  {
    "id": "FLU-09",
    "domain": "language",
    "questionText": "Name as many things you might take to an appointment as you can in 30 seconds.",
    "answerType": "TASK_FLUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true,
    "options": {
      "category": "Things you might take to an appointment",
      "durationSeconds": 30
    }
  },
  {
    "id": "FLU-10",
    "domain": "language",
    "questionText": "Name as many fruits and vegetables as you can in 30 seconds.",
    "answerType": "TASK_FLUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true,
    "options": {
      "category": "Fruits and vegetables",
      "durationSeconds": 30
    }
  },
  {
    "id": "FLU-11",
    "domain": "language",
    "questionText": "Name as many things found in a living room as you can in 30 seconds.",
    "answerType": "TASK_FLUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true,
    "options": {
      "category": "Things found in a living room",
      "durationSeconds": 30
    }
  },
  {
    "id": "FLU-12",
    "domain": "language",
    "questionText": "Name as many ways to stay connected with people as you can in 30 seconds.",
    "answerType": "TASK_FLUENCY",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "language",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true,
    "options": {
      "category": "Ways to stay connected with people",
      "durationSeconds": 30
    }
  },
  {
    "id": "PM-01",
    "domain": "prospective_memory",
    "questionText": "At the end, remind me that you chose a small step.",
    "answerType": "TASK_PROSPECTIVE",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "prospective_memory",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "PM-02",
    "domain": "prospective_memory",
    "questionText": "At the end, I’ll ask what you wanted VYVA to help with.",
    "answerType": "TASK_PROSPECTIVE",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "prospective_memory",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "PM-03",
    "domain": "prospective_memory",
    "questionText": "At the end, I’ll ask who you might like to contact.",
    "answerType": "TASK_PROSPECTIVE",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "prospective_memory",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "PM-04",
    "domain": "prospective_memory",
    "questionText": "At the end, I’ll ask what reminder would help next week.",
    "answerType": "TASK_PROSPECTIVE",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "prospective_memory",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "PM-05",
    "domain": "prospective_memory",
    "questionText": "At the end, I’ll ask what felt harder this week.",
    "answerType": "TASK_PROSPECTIVE",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "prospective_memory",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "PM-06",
    "domain": "prospective_memory",
    "questionText": "At the end, I’ll ask what helped you feel better.",
    "answerType": "TASK_PROSPECTIVE",
    "cadence": "WEEKLY",
    "burdenLevel": "MEDIUM",
    "preventionDomain": "prospective_memory",
    "triggerRule": null,
    "cooldownDays": 28,
    "active": true
  },
  {
    "id": "ACT-01",
    "domain": "social",
    "questionText": "Would you like VYVA to help you plan one short call this week?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "social",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "ACT-02",
    "domain": "routine",
    "questionText": "Would a morning routine reminder help tomorrow?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "routine",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "ACT-03",
    "domain": "hydration",
    "questionText": "Would a water reminder after breakfast help?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "hydration",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "ACT-04",
    "domain": "mobility",
    "questionText": "Would a gentle movement reminder help when you feel safe?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "mobility",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "ACT-05",
    "domain": "planning",
    "questionText": "Would it help to make tomorrow simpler with just two tasks?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "planning",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "ACT-06",
    "domain": "nutrition",
    "questionText": "Would you like VYVA to remind you about meals?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "nutrition",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "ACT-07",
    "domain": "hearing_vision",
    "questionText": "Would you like VYVA to speak more slowly or repeat reminders?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "hearing_vision",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "ACT-08",
    "domain": "hearing_vision",
    "questionText": "Would larger text or fewer buttons make VYVA easier?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "hearing_vision",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "ACT-09",
    "domain": "global_wellbeing",
    "questionText": "Would you like to share this week’s summary with your caregiver?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "caregiver_share",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "ACT-10",
    "domain": "routine",
    "questionText": "Would you like VYVA to check in again tomorrow?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "routine",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "ACT-11",
    "domain": "global_wellbeing",
    "questionText": "Would you like to tell your caregiver that this week felt harder?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "caregiver_share",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  },
  {
    "id": "ACT-12",
    "domain": "sleep",
    "questionText": "Would you like help making a small plan for sleep tonight?",
    "answerType": "ACTION_PREFERENCE",
    "cadence": "WEEKLY",
    "burdenLevel": "LOW",
    "preventionDomain": "sleep",
    "triggerRule": null,
    "cooldownDays": 14,
    "active": true,
    "options": [
      "Yes, please",
      "Maybe later",
      "No, thank you",
      "I want to tell my caregiver",
      "I want help now"
    ]
  }
];

export const VYVA_WEEKLY_FORMS: VyvaWeeklyFormSeed[] = [
  {
    "weekNumber": 1,
    "title": "Baseline and routine",
    "questionIds": [
      "CORE-01",
      "CORE-06",
      "FOOD-01",
      "CORE-04",
      "PLAN-01",
      "PLAN-TASK-01",
      "CORE-02",
      "ACT-02"
    ]
  },
  {
    "weekNumber": 2,
    "title": "Social connection and loneliness",
    "questionIds": [
      "MOOD-01",
      "SOC-06",
      "SOC-03",
      "SOC-04",
      "SENS-03",
      "FLU-08",
      "LANG-05",
      "ACT-01"
    ]
  },
  {
    "weekNumber": 3,
    "title": "Sleep, energy, and mood",
    "questionIds": [
      "SLEEP-01",
      "PAIN-02",
      "SLEEP-03",
      "SLEEP-08",
      "MOOD-03",
      "STORY-01",
      "MOOD-08",
      "ACT-12"
    ]
  },
  {
    "weekNumber": 4,
    "title": "Mobility and confidence",
    "questionIds": [
      "MOB-01",
      "MOB-02",
      "MOB-03",
      "MOB-04",
      "MOB-05",
      "PLAN-TASK-04",
      "MOB-06",
      "ACT-04"
    ]
  },
  {
    "weekNumber": 5,
    "title": "Memory in daily life",
    "questionIds": [
      "MEM-01",
      "MEM-02",
      "MEM-04",
      "MEM-05",
      "MEM-06",
      "PM-02",
      "LANG-06",
      "MEM-07"
    ]
  },
  {
    "weekNumber": 6,
    "title": "Hearing, vision, and access",
    "questionIds": [
      "SENS-01",
      "SENS-02",
      "SENS-04",
      "SENS-05",
      "SENS-06",
      "FLU-03",
      "SENS-03",
      "SENS-08"
    ]
  },
  {
    "weekNumber": 7,
    "title": "Mood, purpose, and pleasure",
    "questionIds": [
      "MOOD-01",
      "MOOD-02",
      "MOOD-03",
      "SOC-08",
      "CORE-02",
      "STORY-03",
      "MOOD-07",
      "CORE-07"
    ]
  },
  {
    "weekNumber": 8,
    "title": "Food, hydration, and household function",
    "questionIds": [
      "FOOD-01",
      "FOOD-02",
      "FOOD-03",
      "FOOD-04",
      "FOOD-05",
      "PLAN-TASK-02",
      "FOOD-07",
      "ACT-06"
    ]
  },
  {
    "weekNumber": 9,
    "title": "Planning and independence",
    "questionIds": [
      "PLAN-01",
      "PLAN-02",
      "PLAN-03",
      "PLAN-04",
      "PLAN-05",
      "PM-04",
      "PLAN-08",
      "ACT-05"
    ]
  },
  {
    "weekNumber": 10,
    "title": "Pain, fatigue, and routine adaptation",
    "questionIds": [
      "PAIN-01",
      "PAIN-02",
      "PAIN-03",
      "PAIN-05",
      "PAIN-04",
      "FLU-07",
      "PAIN-08",
      "PAIN-07"
    ]
  },
  {
    "weekNumber": 11,
    "title": "Conversation and language",
    "questionIds": [
      "LANG-01",
      "LANG-02",
      "LANG-03",
      "LANG-07",
      "LANG-08",
      "STORY-05",
      "LANG-05",
      "ACT-09"
    ]
  },
  {
    "weekNumber": 12,
    "title": "Review and prevention plan",
    "questionIds": [
      "CORE-01",
      "CORE-02",
      "CORE-03",
      "MEM-06",
      "SOC-08",
      "PLAN-TASK-05",
      "ACT-05",
      "CORE-07"
    ]
  }
];

export const VYVA_WEEKLY_FORM_MIN_QUESTIONS = 7;
export const VYVA_WEEKLY_FORM_MAX_QUESTIONS = 9;

export type VyvaQuestionBankValidation = {
  ok: boolean;
  errors: string[];
};

export type VyvaRecentSignal = {
  domain: string;
  currentValue?: number;
  previousValue?: number;
  change?: number;
  higherIsWorse?: boolean;
  trend?: "improved" | "steady" | "worsened";
  worsened?: boolean;
  noteText?: string;
};

export type VyvaQuestionSelectionInput = {
  weekNumber: number;
  recentlyUsedQuestionIds?: string[];
  recentSignals?: VyvaRecentSignal[];
  maxQuestions?: number;
};

export type VyvaSelectedWeeklyQuestion = {
  question: VyvaQuestionSeed;
  source: "weekly_form" | "rotation_alternative" | "triggered_follow_up";
  reason: string;
};

export const VYVA_CLINICAL_CONDITION_WORDING_PATTERNS = [
  /\bdementia\b/i,
  /\balzheimer'?s?\b/i,
  /\bMCI\b/,
  /\bdiagnos(?:is|tic|e|ed|ing)\b/i,
  /\bclinical[- ]risk\b/i,
  /\bcognitive[- ]impairment\b/i,
];

const questionById = new Map(VYVA_WEEKLY_QUESTION_BANK.map((question) => [question.id, question]));
const burdenOrder = new Map([
  ["LOW", 0],
  ["MEDIUM", 1],
  ["HIGH", 2],
]);
const signalDomainAliases: Record<string, string[]> = {
  food: ["nutrition", "hydration"],
  memory: ["subjective_memory"],
  pain: ["pain_fatigue"],
  fatigue: ["pain_fatigue"],
  vision: ["hearing_vision"],
  hearing: ["hearing_vision"],
};

function normalizedWeekNumber(weekNumber: number) {
  const safeWeekNumber = Number.isFinite(weekNumber) && weekNumber > 0 ? Math.floor(weekNumber) : 1;
  return ((safeWeekNumber - 1) % VYVA_WEEKLY_FORMS.length) + 1;
}

function hasWorsened(signal: VyvaRecentSignal) {
  if (signal.worsened || signal.trend === "worsened") return true;

  if (typeof signal.change === "number") {
    return signal.change > 0;
  }

  if (typeof signal.currentValue === "number" && typeof signal.previousValue === "number") {
    const delta = signal.currentValue - signal.previousValue;
    return signal.higherIsWorse === false ? delta < 0 : delta > 0;
  }

  return false;
}

function mentionsDomain(signal: VyvaRecentSignal) {
  if (!signal.noteText) return false;

  const note = signal.noteText.toLowerCase();
  return domainsForSignal(signal).some((domain) => {
    const domainWords = domain.toLowerCase().replace(/_/g, " ");
    return note.includes(domainWords) || note.includes(domain.toLowerCase());
  });
}

function domainsForSignal(signal: VyvaRecentSignal) {
  return [signal.domain, ...(signalDomainAliases[signal.domain] ?? [])];
}

function worsenedDomainsFrom(signals: VyvaRecentSignal[] = []) {
  const domains = new Set<string>();

  for (const signal of signals) {
    if (!hasWorsened(signal) && !mentionsDomain(signal)) continue;

    for (const domain of domainsForSignal(signal)) {
      domains.add(domain);
    }
  }

  return domains;
}

function findRotationAlternative(
  originalQuestion: VyvaQuestionSeed,
  recentlyUsedQuestionIds: Set<string>,
  selectedQuestionIds: Set<string>,
) {
  const candidates = VYVA_WEEKLY_QUESTION_BANK
    .filter((question) => question.active)
    .filter((question) => question.cadence === "WEEKLY")
    .filter((question) => question.id !== originalQuestion.id)
    .filter((question) => question.domain === originalQuestion.domain)
    .filter((question) => !question.triggerRule)
    .filter((question) => !recentlyUsedQuestionIds.has(question.id))
    .filter((question) => !selectedQuestionIds.has(question.id))
    .sort((a, b) => {
      const burdenDelta = (burdenOrder.get(a.burdenLevel) ?? 99) - (burdenOrder.get(b.burdenLevel) ?? 99);
      return burdenDelta || a.cooldownDays - b.cooldownDays || a.id.localeCompare(b.id);
    });

  return candidates[0] ?? null;
}

function triggeredQuestionCandidates(domains: Set<string>, recentlyUsedQuestionIds: Set<string>) {
  return VYVA_WEEKLY_QUESTION_BANK
    .filter((question) => question.active)
    .filter((question) => question.triggerRule)
    .filter((question) => domains.has(question.domain))
    .sort((a, b) => {
      const recentDelta = Number(recentlyUsedQuestionIds.has(a.id)) - Number(recentlyUsedQuestionIds.has(b.id));
      const burdenDelta = (burdenOrder.get(a.burdenLevel) ?? 99) - (burdenOrder.get(b.burdenLevel) ?? 99);
      return recentDelta || burdenDelta || a.cooldownDays - b.cooldownDays || a.id.localeCompare(b.id);
    });
}

export function getVyvaWeeklyFormForWeek(weekNumber: number) {
  const formWeekNumber = normalizedWeekNumber(weekNumber);
  const form = VYVA_WEEKLY_FORMS.find((weeklyForm) => weeklyForm.weekNumber === formWeekNumber);

  if (!form) {
    throw new Error(`Missing VYVA weekly form for week ${formWeekNumber}.`);
  }

  return form;
}

export function findClinicalConditionWording(questionText: string) {
  return VYVA_CLINICAL_CONDITION_WORDING_PATTERNS.some((pattern) => pattern.test(questionText));
}

export function validateVyvaWeeklyQuestionBank(): VyvaQuestionBankValidation {
  const errors: string[] = [];

  for (const form of VYVA_WEEKLY_FORMS) {
    if (form.questionIds.length === 0) {
      errors.push(`Weekly form ${form.weekNumber} is empty.`);
    }

    if (
      form.questionIds.length < VYVA_WEEKLY_FORM_MIN_QUESTIONS ||
      form.questionIds.length > VYVA_WEEKLY_FORM_MAX_QUESTIONS
    ) {
      errors.push(
        `Weekly form ${form.weekNumber} has ${form.questionIds.length} questions; expected ${VYVA_WEEKLY_FORM_MIN_QUESTIONS}-${VYVA_WEEKLY_FORM_MAX_QUESTIONS}.`,
      );
    }

    for (const questionId of form.questionIds) {
      const question = questionById.get(questionId);

      if (!question) {
        errors.push(`Weekly form ${form.weekNumber} references missing question ${questionId}.`);
        continue;
      }

      if (!question.active) {
        errors.push(`Weekly form ${form.weekNumber} references inactive question ${questionId}.`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function selectVyvaWeeklyQuestions(input: VyvaQuestionSelectionInput): VyvaSelectedWeeklyQuestion[] {
  const form = getVyvaWeeklyFormForWeek(input.weekNumber);
  const recentlyUsedQuestionIds = new Set(input.recentlyUsedQuestionIds ?? []);
  const selectedQuestionIds = new Set<string>();
  const selectedQuestions: VyvaSelectedWeeklyQuestion[] = [];
  const maxQuestions = Math.max(
    VYVA_WEEKLY_FORM_MIN_QUESTIONS,
    Math.min(input.maxQuestions ?? VYVA_WEEKLY_FORM_MAX_QUESTIONS, VYVA_WEEKLY_FORM_MAX_QUESTIONS),
  );

  for (const questionId of form.questionIds) {
    const question = questionById.get(questionId);
    if (!question || !question.active) continue;

    if (recentlyUsedQuestionIds.has(question.id)) {
      const alternative = findRotationAlternative(question, recentlyUsedQuestionIds, selectedQuestionIds);

      if (alternative) {
        selectedQuestionIds.add(alternative.id);
        selectedQuestions.push({
          question: alternative,
          source: "rotation_alternative",
          reason: `Used a ${alternative.domain.replace(/_/g, " ")} alternate to avoid a recent repeat.`,
        });
        continue;
      }
    }

    selectedQuestionIds.add(question.id);
    selectedQuestions.push({
      question,
      source: "weekly_form",
      reason: `Part of rotating week ${form.weekNumber} form: ${form.title}.`,
    });
  }

  const worsenedDomains = worsenedDomainsFrom(input.recentSignals);
  const triggeredQuestions = triggeredQuestionCandidates(worsenedDomains, recentlyUsedQuestionIds);

  for (const question of triggeredQuestions) {
    if (selectedQuestions.length >= maxQuestions) break;
    if (selectedQuestionIds.has(question.id)) continue;

    selectedQuestionIds.add(question.id);
    selectedQuestions.push({
      question,
      source: "triggered_follow_up",
      reason: `Follow-up because recent ${question.domain.replace(/_/g, " ")} signals worsened.`,
    });
  }

  return selectedQuestions.slice(0, maxQuestions);
}
