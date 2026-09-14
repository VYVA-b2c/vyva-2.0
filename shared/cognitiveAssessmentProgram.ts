export const COGNITIVE_ASSESSMENT_PROGRAM_FREQUENCIES = [
  "weekly",
  "every_2_weeks",
  "monthly",
] as const;

export type CognitiveAssessmentProgramFrequency = typeof COGNITIVE_ASSESSMENT_PROGRAM_FREQUENCIES[number];

export type CognitiveAssessmentProgramEnrollment = {
  status: "active" | "paused" | "cancelled";
  startDate: string;
  frequency: CognitiveAssessmentProgramFrequency;
  reminderTime: string;
  timezone: string;
  joinedAt: string | null;
  updatedAt: string | null;
  nextRunAt: string | null;
  scheduledInteractionId: string | null;
};

export type CognitiveAssessmentProgramSessionSummary = {
  sessionId: string;
  startedAt?: string | null;
  completedAt?: string | null;
  tasksCompleted: number;
  totalTasks: number;
};

export type CognitiveAssessmentProgramReminderState = "not_scheduled" | "upcoming" | "due";

export type CognitiveAssessmentProgramReminderStatus = {
  state: CognitiveAssessmentProgramReminderState;
  nextRunAt: string | null;
  dueSince: string | null;
};

export type CognitiveAssessmentProgramStatusResponse = {
  joined: boolean;
  enrollment: CognitiveAssessmentProgramEnrollment | null;
  reminderStatus: CognitiveAssessmentProgramReminderStatus;
  latestUnfinishedSession: CognitiveAssessmentProgramSessionSummary | null;
  latestReport: CognitiveAssessmentProgramSessionSummary | null;
  completedReportCount: number;
  totalTasks: number;
};

export type CognitiveAssessmentProgramJoinRequest = {
  startDate: string;
  frequency?: CognitiveAssessmentProgramFrequency;
  reminderTime: string;
  timezone: string;
};

export type CognitiveAssessmentProgramJoinResponse = {
  program: CognitiveAssessmentProgramStatusResponse;
};

export function cognitiveAssessmentFrequencyLabel(frequency: CognitiveAssessmentProgramFrequency) {
  if (frequency === "weekly") return "Weekly check";
  if (frequency === "every_2_weeks") return "Every 2 weeks";
  return "Monthly check";
}
