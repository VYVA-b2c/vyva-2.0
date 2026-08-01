// src/pages/onboarding/sections/AllergiesSection.tsx
import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero, seniorInputClassName } from "@/components/onboarding/ProfileSectionHero";
import { ProfileNoneOption, ProfileVoiceAction } from "@/components/onboarding/ProfileSectionControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAutoSave } from "@/hooks/useAutoSave";
import VoiceAllergiesModal from "@/components/VoiceAllergiesModal";
import { AlertTriangle, Plus, Mic } from "lucide-react";
import { friendlyError } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const COMMON_ALLERGENS = [
  { value: "Penicillin", key: "penicillin" },
  { value: "Aspirin", key: "aspirin" },
  { value: "Ibuprofen", key: "ibuprofen" },
  { value: "Sulfa drugs", key: "sulfaDrugs" },
  { value: "Codeine", key: "codeine" },
  { value: "Latex", key: "latex" },
  { value: "Peanuts", key: "peanuts" },
  { value: "Tree nuts", key: "treeNuts" },
  { value: "Shellfish", key: "shellfish" },
  { value: "Eggs", key: "eggs" },
  { value: "Milk / Dairy", key: "milkDairy" },
  { value: "Wheat / Gluten", key: "wheatGluten" },
  { value: "Soy", key: "soy" },
  { value: "Bee stings", key: "beeStings" },
] as const;

const ALLERGEN_ICON: Record<string, string> = {
  "Penicillin": "Rx",
  "Aspirin": "Rx",
  "Ibuprofen": "Rx",
  "Sulfa drugs": "Rx",
  "Codeine": "Rx",
  "Latex": "Lx",
  "Peanuts": "Nut",
  "Tree nuts": "Nut",
  "Shellfish": "Sea",
  "Eggs": "Egg",
  "Milk / Dairy": "Milk",
  "Wheat / Gluten": "Wheat",
  "Soy": "Soy",
  "Bee stings": "Bee",
};


export default function AllergiesSection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [allergies, setAllergies] = useState<string[]>([]);
  const [noKnownAllergies, setNoKnownAllergies] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const allergyLabel = (value: string) => {
    const common = COMMON_ALLERGENS.find((item) => item.value.toLowerCase() === value.toLowerCase());
    return common
      ? t(`onboarding.allergies.common.${common.key}`, common.value)
      : value;
  };

  const allergiesRef = useRef(allergies);
  useEffect(() => { allergiesRef.current = allergies; }, [allergies]);

  const { data, isLoading } = useQuery<{ profile: { known_allergies?: string[] | null; no_known_allergies?: boolean } | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    if (!data) return;
    const saved = data?.profile?.known_allergies;
    setAllergies(Array.isArray(saved) ? saved : []);
    setNoKnownAllergies(Boolean(data.profile?.no_known_allergies) && (!Array.isArray(saved) || saved.length === 0));
  }, [data]);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave } = useAutoSave(
    async () => {
      const res = await apiFetch("/api/onboarding/section/medications", {
        method: "POST",
        body: JSON.stringify({
          known_allergies: allergiesRef.current,
          no_known_allergies: noKnownAllergies && allergiesRef.current.length === 0,
        }),
      });
      if (!res.ok) {
        const msg = await friendlyError(new Error(), res);
        throw new Error(msg);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
    },
    1500,
  );

  const addAllergy = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const lower = value.toLowerCase();
    if (allergies.some((a) => a.toLowerCase() === lower)) {
      setInput("");
      return;
    }
    setNoKnownAllergies(false);
    const updated = [...allergies, value];
    setAllergies(updated);
    setInput("");
    scheduleAutoSave();
  };

  const removeAllergy = (name: string) => {
    setAllergies((prev) => prev.filter((a) => a !== name));
    scheduleAutoSave();
  };

  const toggleNoKnownAllergies = () => {
    const next = !noKnownAllergies;
    setNoKnownAllergies(next);
    if (next) {
      setAllergies([]);
      setInput("");
    }
    scheduleAutoSave();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addAllergy(input);
    }
  };

  const handleVoiceAddAllergies = (incoming: string[]) => {
    if (incoming.length === 0) return;
    const existing = new Set(allergies.map((a) => a.toLowerCase()));
    const novel = incoming.map((a) => a.trim()).filter((a) => a && !existing.has(a.toLowerCase()));
    if (novel.length === 0) {
      toast({
        title: t("onboarding.toast.allergensAlreadySaved.title", "Allergens already saved"),
        description: t("onboarding.toast.allergensAlreadySaved.description", "Everything you said is already on your allergy list."),
      });
      return;
    }
    setNoKnownAllergies(false);
    setAllergies((prev) => Array.from(new Set([...prev, ...novel])));
    scheduleAutoSave();
    toast({
      title: t("onboarding.toast.allergyListUpdated.title", "Allergy list updated"),
      description: t("onboarding.toast.allergyListUpdated.description", {
        count: novel.length,
        defaultValue: "{{count}} allergen was added to your profile.",
      }),
    });
  };

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/medications", {
        method: "POST",
        body: JSON.stringify({
          known_allergies: allergies,
          no_known_allergies: noKnownAllergies && allergies.length === 0,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
      navigate("/onboarding/complete/allergies");
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({
        title: t("onboarding.allergies.saveError", "Could not save allergies"),
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const suggestionsToShow = COMMON_ALLERGENS.filter(
    (item) => !allergies.some((x) => x.toLowerCase() === item.value.toLowerCase())
  );
  const hasAllergySectionContent = allergies.length > 0 || noKnownAllergies;

  return (
    <PhoneFrame
      subtitle={t("onboarding.allergies.title", "Allergies")}
      showBack
      onBack={() => navigate("/onboarding/profile")}
      showAllSections
      onAllSections={() => navigate("/onboarding/profile")}
    >
      <div className="flex flex-col gap-7 px-1 pb-6 pt-5 sm:px-2 md:px-3">
        <ProfileSectionHero
          icon={AlertTriangle}
          title={t("onboarding.allergies.title", "Allergies")}
          kicker={t("onboarding.allergies.kicker", "Important alerts")}
          description={t(
            "onboarding.allergies.description",
            "Add medicines, foods, or materials VYVA should remember before reminders, concierge help, or urgent support.",
          )}
          badges={[
            { label: t("onboarding.allergies.badges.medicines", "Medicines"), color: "red" },
            { label: t("onboarding.allergies.badges.foods", "Foods"), color: "amber" },
            { label: t("onboarding.allergies.badges.emergencyReady", "Emergency-ready"), color: "purple" },
          ]}
          iconBgClassName="bg-[#C9890A]"
          autoSave={{ autoSaveStatus, savedFading, retryCountdown, onRetryNow: retryNow, testId: "status-allergies-autosave" }}
        />

        <ProfileVoiceAction
          icon={Mic}
          title={t("onboarding.allergies.addByVoice", "Add by voice")}
          description={t(
            "onboarding.allergies.addByVoiceDescription",
            "Say what you react to. VYVA will add it to the list.",
          )}
          onClick={() => setVoiceModalOpen(true)}
          testId="button-allergies-voice"
          tone="amber"
        />

        {/* Voice allergies modal */}
        <VoiceAllergiesModal
          open={voiceModalOpen}
          onOpenChange={setVoiceModalOpen}
          onAddAllergies={handleVoiceAddAllergies}
        />

        <ProfileNoneOption
          title={t("onboarding.allergies.noneButton", "No known allergies")}
          description={t(
            "onboarding.allergies.noneDescription",
            "Choose this if there are no known allergies right now.",
          )}
          selected={noKnownAllergies}
          onClick={toggleNoKnownAllergies}
          testId="button-allergies-no-known"
          tone="amber"
        />

        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-11 w-full rounded-lg" />
            <div className="flex flex-wrap gap-1.5">
              {[80, 100, 70, 90, 60].map((w, i) => (
                <Skeleton key={i} className="h-7 rounded-full" style={{ width: w }} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Added allergies */}
            {allergies.length > 0 && (
              <div
                data-testid="list-allergies-tags"
                className="flex min-h-[64px] flex-wrap items-center gap-2 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3"
              >
                {allergies.map((a) => (
                  <span
                    key={a}
                    data-testid={`tag-allergy-${a.replace(/\s+/g, "-").toLowerCase()}`}
                    className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-3 py-1.5 text-[14px] font-black text-white"
                  >
                    {allergyLabel(a)}
                    <button
                      type="button"
                      data-testid={`button-remove-allergy-${a.replace(/\s+/g, "-").toLowerCase()}`}
                      onClick={() => removeAllergy(a)}
                      className="opacity-80 hover:opacity-100 ml-0.5 leading-none"
                      aria-label={t("onboarding.allergies.remove", {
                        allergy: allergyLabel(a),
                        defaultValue: "Remove {{allergy}}",
                      })}
                    >x</button>
                  </span>
                ))}
              </div>
            )}

            {allergies.length === 0 && (
              <div className="flex min-h-[64px] items-center rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3">
                <span className="text-[15px] font-semibold text-amber-500">
                  {t("onboarding.allergies.empty", "No allergies added yet")}
                </span>
              </div>
            )}

            {/* Text input */}
            <div className="flex gap-2">
              <Input
                data-testid="input-allergies-new"
                placeholder={t("onboarding.allergies.inputPlaceholder", "Type an allergy and press Enter or Add")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`${seniorInputClassName} flex-1`}
              />
              <button
                type="button"
                data-testid="button-allergies-add"
                onClick={() => addAllergy(input)}
                disabled={!input.trim()}
                className="flex h-14 shrink-0 items-center gap-2 rounded-[18px] bg-[#6b21a8] px-4 text-[15px] font-black text-white shadow-[0_10px_22px_rgba(107,33,168,0.18)] disabled:opacity-40"
              >
                <Plus size={14} />
                {t("onboarding.allergies.add", "Add")}
              </button>
            </div>

            {/* Common allergens icon-card grid */}
            {suggestionsToShow.length > 0 && (
              <div>
                <p className="mb-3 text-[13px] font-black uppercase tracking-[0.08em] text-gray-500">
                  {t("onboarding.allergies.commonHeading", "Common allergens - tap to add")}
                </p>
                <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
                  {suggestionsToShow.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      data-testid={`card-allergen-${item.value.replace(/\s+/g, "-").toLowerCase()}`}
                      onClick={() => addAllergy(item.value)}
                      className="flex min-h-[72px] items-center gap-3 rounded-[22px] px-4 py-3 text-left shadow-[0_10px_22px_rgba(53,28,87,0.05)] transition-all"
                      style={{ background: "#FFFBEB", border: "1px solid #FDE68A", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                    >
                      <span className="flex-shrink-0 text-[24px] leading-none">{ALLERGEN_ICON[item.value] ?? "!"}</span>
                      <span className="font-body text-[16px] font-black leading-tight text-vyva-text-1">
                        {t(`onboarding.allergies.common.${item.key}`, item.value)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button
            data-testid="button-allergies-save"
            onClick={handleSave}
            disabled={saving || isLoading || !hasAllergySectionContent}
            className="h-14 w-full rounded-full bg-[#6b21a8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5b1a8f] disabled:opacity-40"
          >
            {saving
              ? t("onboarding.allergies.saving", "Saving...")
              : t("onboarding.allergies.save", "Save allergies")}
          </Button>
          <button
            data-testid="button-allergies-skip"
            onClick={() => navigate("/onboarding/profile")}
            className="py-2 text-center text-[15px] font-bold text-gray-500"
          >
            {t("onboarding.allergies.skip", "Skip for now")}
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}
