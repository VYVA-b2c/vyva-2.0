import { useEffect, useMemo, useState } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { useLanguage } from "@/i18n";
import {
  type HeroMessageContext,
  type HeroMessageDefinition,
  type HeroMessageResult,
  type HeroSurface,
  normalizeHeroLanguage,
  recordHeroEvent,
  recordHeroImpression,
  selectHeroMessage,
  setRuntimeHeroMessages,
} from "@/lib/heroMessages";

export type UseHeroMessageOptions = Omit<HeroMessageContext, "language" | "firstName"> & {
  language?: string | null;
  firstName?: string | null;
  trackImpression?: boolean;
};

let catalogLoadPromise: Promise<void> | null = null;
let catalogLoaded = false;

async function loadManagedHeroMessages(): Promise<void> {
  if (catalogLoaded || catalogLoadPromise) return catalogLoadPromise ?? Promise.resolve();

  catalogLoadPromise = fetch("/api/hero-messages")
    .then(async (res) => {
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const messages = data?.messages as HeroMessageDefinition[] | undefined;
      if (messages?.length) setRuntimeHeroMessages(messages);
      catalogLoaded = true;
    })
    .catch(() => {
      catalogLoaded = true;
    })
    .finally(() => {
      catalogLoadPromise = null;
    });

  return catalogLoadPromise;
}

export function useHeroMessage(
  surface?: HeroSurface | null,
  options: UseHeroMessageOptions = {},
): HeroMessageResult | null {
  const { language: appLanguage } = useLanguage();
  const { firstName: profileFirstName } = useProfile();
  const [catalogVersion, setCatalogVersion] = useState(0);
  const {
    language,
    firstName,
    date,
    safetyLevel,
    fallbackHeadline,
    fallbackSubtitle,
    fallbackSourceText,
    fallbackCtaLabel,
    fallbackContextHint,
    upcomingEventType,
    recentActivity,
    trackImpression,
  } = options;

  useEffect(() => {
    let cancelled = false;
    loadManagedHeroMessages().then(() => {
      if (!cancelled) setCatalogVersion((version) => version + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const message = useMemo(() => {
    void catalogVersion;
    if (!surface) return null;
    return selectHeroMessage(surface, {
      safetyLevel,
      fallbackHeadline,
      fallbackSubtitle,
      fallbackSourceText,
      fallbackCtaLabel,
      fallbackContextHint,
      upcomingEventType,
      recentActivity,
      language: language ?? appLanguage,
      firstName: firstName ?? profileFirstName,
      date: date ?? new Date(),
    });
  }, [
    surface,
    language,
    firstName,
    date,
    safetyLevel,
    fallbackHeadline,
    fallbackSubtitle,
    fallbackSourceText,
    fallbackCtaLabel,
    fallbackContextHint,
    upcomingEventType,
    recentActivity,
    appLanguage,
    profileFirstName,
    catalogVersion,
  ]);

  useEffect(() => {
    if (!message || trackImpression === false) return;
    recordHeroImpression(message.messageId);
    const eventLanguage = normalizeHeroLanguage(language ?? appLanguage);
    recordHeroEvent({
      messageId: message.messageId,
      surface: message.surface,
      language: eventLanguage,
      eventType: "impression",
      reason: message.reason,
      source: message.source,
    });
    if (message.source === "fallback") {
      recordHeroEvent({
        messageId: message.messageId,
        surface: message.surface,
        language: eventLanguage,
        eventType: "fallback",
        reason: message.reason,
        source: message.source,
      });
    }
  }, [appLanguage, language, message, trackImpression]);

  return message;
}
