import type { BrainCoachProgress, BrainCoachSession } from "@/lib/brainCoachReport";
import {
  BRAIN_COACH_ACTIVITY_CATALOG,
  type BrainCoachModuleId,
} from "./brainCoachCatalog";

function activityModule(activityType: string): BrainCoachModuleId | null {
  const activity = BRAIN_COACH_ACTIVITY_CATALOG.find((candidate) => (
    candidate.status === "active"
    && (candidate.id === activityType || candidate.memoryGameType === activityType)
  ));
  return activity?.moduleId ?? null;
}

function playedAtValue(session: BrainCoachSession) {
  const value = session.playedAt ? new Date(session.playedAt).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}

export function latestCompletedSessionForModule(
  progress: BrainCoachProgress | null | undefined,
  moduleId: BrainCoachModuleId,
): BrainCoachSession | null {
  return [...(progress?.history ?? [])]
    .filter((session) => session.completed === true && activityModule(session.activityType) === moduleId)
    .sort((left, right) => playedAtValue(right) - playedAtValue(left))[0] ?? null;
}

export function brainCoachSessionBadge(session: BrainCoachSession) {
  const score = Math.max(0, Math.round(Number(session.score) || 0));
  const level = Math.max(1, Math.round(Number(session.difficulty) || 1));
  return {
    compact: `Score ${score} · L${level}`,
    accessible: `Last score ${score}. Level ${level} achieved.`,
  };
}
