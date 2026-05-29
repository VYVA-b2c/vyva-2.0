import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { apiFetch } from "@/lib/queryClient";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";

export const DOCTOR_AGENT_ID = "agent_9201knfm6ep0fpp958kdyt0hev1b";

const FALLBACK_DOCTOR_USER_ID = "vyva-local-user";

type VoiceDynamicVariables = Record<string, string | number | boolean>;

export type DoctorVoiceContextHint = {
  latestSymptomReport?: string;
};

function createDoctorConversationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `doctor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function fetchDoctorContextVariables(conversationId: string): Promise<VoiceDynamicVariables> {
  const params = new URLSearchParams({ conversation_id: conversationId });
  const res = await apiFetch(`/api/profile/doctor-context?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Doctor context failed: ${res.status}`);
  }

  const data = await res.json() as { dynamicVariables?: VoiceDynamicVariables };
  return data.dynamicVariables ?? {};
}

export function useDoctorVoice() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { profile, firstName } = useProfile();
  const voice = useVyvaVoice();
  const {
    beginUserTurn,
    endUserTurn,
    hasMicrophone,
    isConnecting,
    isSpeaking,
    isUserSpeaking,
    startVoice,
    status,
    stopVoice,
  } = voice;
  const [startAttempted, setStartAttempted] = useState(false);
  const [userStopped, setUserStopped] = useState(false);
  const [startListeningWhenReady, setStartListeningWhenReady] = useState(false);

  const isVoiceLive =
    status === "connecting" ||
    status === "connected" ||
    isConnecting ||
    isSpeaking ||
    isUserSpeaking;

  const startDoctorVoice = useCallback(async (contextHint?: DoctorVoiceContextHint) => {
    setUserStopped(false);
    setStartAttempted(true);
    setStartListeningWhenReady(true);

    const conversationId = createDoctorConversationId();
    let doctorContext: VoiceDynamicVariables = {};
    try {
      doctorContext = await fetchDoctorContextVariables(conversationId);
    } catch (error) {
      console.warn("[DoctorVoice] Starting doctor voice without profile context:", error);
      doctorContext = {
        health_context: "The user's health profile could not be loaded before this call.",
      };
    }

    await startVoice(undefined, undefined, {
      agentId: DOCTOR_AGENT_ID,
      dynamicVariables: {
        ...doctorContext,
        ...(contextHint?.latestSymptomReport
          ? {
              latest_symptom_report: contextHint.latestSymptomReport,
              health_session_context: contextHint.latestSymptomReport,
            }
          : {}),
        first_name: firstName?.trim() || profile?.firstName?.trim() || "there",
        user_id: user?.id ?? FALLBACK_DOCTOR_USER_ID,
        conversation_id: conversationId,
        language: i18n.language?.slice(0, 2) || "en",
      },
    });
  }, [firstName, i18n.language, profile?.firstName, startVoice, user?.id]);

  const stopDoctorVoice = useCallback(() => {
    setUserStopped(true);
    setStartListeningWhenReady(false);
    endUserTurn();
    stopVoice();
  }, [endUserTurn, stopVoice]);

  useEffect(() => {
    if (status !== "connected" || !startListeningWhenReady || !hasMicrophone) return;
    setStartListeningWhenReady(false);
    void beginUserTurn();
  }, [beginUserTurn, hasMicrophone, startListeningWhenReady, status]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  return useMemo(() => ({
    ...voice,
    isVoiceLive,
    startDoctorVoice,
    stopDoctorVoice,
    startAttempted,
    userStopped,
  }), [isVoiceLive, startAttempted, startDoctorVoice, stopDoctorVoice, userStopped, voice]);
}
