import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import {
  HOME_FAST_HELP_JOURNEY_EVENT,
  homeFastHelpJourneyStorageKey,
} from "@/lib/homeFastHelpOutcome";
import { syncHomeFastHelpOutcomes } from "@/lib/homeFastHelpSyncClient";

export default function HomeFastHelpSyncBridge() {
  const { token, user } = useAuth();
  const { profile } = useProfile();
  const inFlightRef = useRef(false);
  const rerunRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const enabled = Boolean(token && user?.id && user.activeProfileRole === "elder");
  const storageKey = homeFastHelpJourneyStorageKey(profile?.profileId ?? user?.activeProfileId);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let active = true;

    const run = async () => {
      if (!active || !window.navigator.onLine) return;
      if (inFlightRef.current) {
        rerunRef.current = true;
        return;
      }
      inFlightRef.current = true;
      try {
        await syncHomeFastHelpOutcomes(storageKey);
      } catch {
        // Local outcomes remain authoritative until the next online retry.
      } finally {
        inFlightRef.current = false;
        if (active && rerunRef.current) {
          rerunRef.current = false;
          window.setTimeout(() => void run(), 0);
        }
      }
    };

    const schedule = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void run(), 350);
    };
    const onJourneyChange = (event: Event) => {
      const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
      if (!detail?.storageKey || detail.storageKey === storageKey) schedule();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) schedule();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") schedule();
    };

    window.addEventListener(HOME_FAST_HELP_JOURNEY_EVENT, onJourneyChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener("online", schedule);
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", onVisibility);
    schedule();

    return () => {
      active = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      window.removeEventListener(HOME_FAST_HELP_JOURNEY_EVENT, onJourneyChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("online", schedule);
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, storageKey]);

  return null;
}
