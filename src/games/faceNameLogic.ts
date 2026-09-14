import { BRAIN_COACH_MAX_LEVEL } from "./shared/brainCoachProgression";

export type FaceNameRecallMode = "name_to_face" | "face_to_name";

export type FaceNameRecallLogEntry = {
  persona_id: string;
  mode: FaceNameRecallMode;
  correct: boolean;
};

export function clampFaceNameTier(value: number) {
  return Math.min(BRAIN_COACH_MAX_LEVEL, Math.max(1, value));
}

export function getFaceNameFaceCount(tier: number) {
  if (tier >= 16) return 8;
  if (tier >= 11) return 7;
  if (tier >= 6) return 6;
  if (tier >= 3) return 5;
  return 4;
}

export function getFaceNameStudySeconds(tier: number) {
  if (tier >= 18) return 22;
  if (tier >= 14) return 25;
  if (tier >= 10) return 30;
  if (tier >= 6) return 35;
  if (tier >= 3) return 40;
  return 45;
}

export function getFaceNameRecallModes(tier: number): FaceNameRecallMode[] {
  if (tier >= 16) return ["name_to_face", "face_to_name", "face_to_name", "name_to_face"];
  if (tier >= 11) return ["name_to_face", "face_to_name", "face_to_name"];
  if (tier >= 6) return ["name_to_face", "face_to_name"];
  return ["name_to_face"];
}

export function getFaceNameDistractorCount(tier: number) {
  if (tier >= 16) return 3;
  if (tier >= 8) return 2;
  if (tier >= 3) return 1;
  return 0;
}

export function computeFaceNameScore(recallLog: FaceNameRecallLogEntry[], faceCount: number, recallModes: FaceNameRecallMode[]) {
  const nameToFace = recallLog.filter((entry) => entry.mode === "name_to_face");
  const faceToName = recallLog.filter((entry) => entry.mode === "face_to_name");
  const n2fCorrect = nameToFace.filter((entry) => entry.correct).length;
  const f2nCorrect = faceToName.filter((entry) => entry.correct).length;
  const n2fAttempts = nameToFace.length;
  const f2nAttempts = faceToName.length;
  const n2fAccuracyPct = n2fAttempts > 0 ? (n2fCorrect / n2fAttempts) * 100 : 0;
  const f2nAccuracyPct = f2nAttempts > 0 ? (f2nCorrect / f2nAttempts) * 100 : 0;
  const totalAttempts = Math.max(1, n2fAttempts + f2nAttempts);
  const overallAccuracyPct = ((n2fCorrect + f2nCorrect) / totalAttempts) * 100;
  const hasFaceToName = recallModes.includes("face_to_name");
  const n2fScore = n2fAttempts > 0 ? (n2fCorrect / n2fAttempts) * (hasFaceToName ? 500 : 1000) : 0;
  const f2nScore = hasFaceToName && f2nAttempts > 0 ? (f2nCorrect / f2nAttempts) * 500 : 0;
  const score = Math.round(n2fScore + f2nScore);
  const completedQuestions = recallModes.length * faceCount;

  return {
    n2fAttempts,
    n2fCorrect,
    n2fAccuracyPct,
    f2nAttempts,
    f2nCorrect,
    f2nAccuracyPct,
    overallAccuracyPct,
    score,
    completedQuestions,
  };
}

export function getFaceNamePersonaOutcomes(recallLog: FaceNameRecallLogEntry[], personaIds: string[]) {
  return personaIds.map((personaId) => {
    const attempts = recallLog.filter((entry) => entry.persona_id === personaId);
    return {
      personaId,
      mastered: attempts.length > 0 && attempts.every((entry) => entry.correct),
    };
  });
}
