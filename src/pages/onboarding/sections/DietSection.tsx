// src/pages/onboarding/sections/DietSection.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero, seniorTextAreaClassName } from "@/components/onboarding/ProfileSectionHero";
import { ChipSelector } from "@/components/onboarding/ChipSelector";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";
import { Utensils } from "lucide-react";

const DIET_OPTIONS = [
  "Vegetarian","Vegan","Halal","Kosher","No pork","No shellfish",
  "Gluten-free","Dairy-free","Diabetic diet","Low salt","Low potassium","No restrictions",
];

export default function DietSection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedRef = useRef(selected);
  const notesRef = useRef(notes);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  const { data, isLoading } = useQuery<{ profile: { diet?: { preferences?: string[]; notes?: string } } | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    const saved = (data?.profile as { diet?: { preferences?: string[]; notes?: string } } | null)?.diet;
    if (saved) {
      if (saved.preferences) setSelected(saved.preferences);
      if (saved.notes) setNotes(saved.notes);
    }
  }, [data]);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave } = useAutoSave(
    async () => {
      const res = await apiFetch("/api/onboarding/section/diet", {
        method: "POST",
        body: JSON.stringify({ preferences: selectedRef.current, notes: notesRef.current }),
      });
      if (!res.ok) {
        const msg = await friendlyError(new Error(), res);
        throw new Error(msg);
      }
    },
    2000,
  );

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/diet", {
        method: "POST",
        body: JSON.stringify({ preferences: selected, notes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      navigate("/onboarding/complete/diet");
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save dietary preferences", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PhoneFrame subtitle="Dietary preferences" showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-7 px-1 pb-6 pt-5 sm:px-2 md:px-3">
        <ProfileSectionHero
          icon={Utensils}
          title="Food preferences"
          kicker="Comfort at meals"
          description="Tell VYVA what you avoid or prefer so food suggestions, reminders, and concierge help fit your daily life."
          badges={[
            { label: "Meal fit", color: "green" },
            { label: "Health-aware", color: "purple" },
            { label: "Concierge-ready", color: "amber" },
          ]}
          autoSave={{ autoSaveStatus, savedFading, retryCountdown, onRetryNow: retryNow, testId: "status-diet-autosave" }}
        />

        {isLoading ? (
          <div className="flex flex-col gap-3" data-testid="skeleton-diet-content">
            <div className="flex flex-wrap gap-2">
              {[80, 64, 72, 56, 88, 60, 76, 52].map((w, i) => (
                <Skeleton key={i} className="h-8 rounded-full" style={{ width: w }} />
              ))}
            </div>
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ) : (
          <>
            <ChipSelector
              options={DIET_OPTIONS}
              selected={selected}
              onChange={(val) => { setSelected(val); scheduleAutoSave(); }}
            />

            <div className="space-y-1.5">
              <Label className="text-[15px] font-extrabold text-gray-700">Other dietary notes (optional)</Label>
              <textarea
                data-testid="input-diet-notes"
                className={seniorTextAreaClassName}
                rows={3}
                placeholder="e.g. soft foods only, texture modified, low fibre..."
                value={notes}
                onChange={(e) => { setNotes(e.target.value); scheduleAutoSave(); }}
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button data-testid="button-diet-save" onClick={handleSave} disabled={saving || isLoading} className="h-14 w-full rounded-full bg-[#6b21a8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5b1a8f]">
            {saving ? "Saving..." : "Save dietary preferences"}
          </Button>
          <button data-testid="button-diet-skip" onClick={() => navigate("/onboarding/profile")} className="py-2 text-center text-[15px] font-bold text-gray-500">Skip for now</button>
        </div>
      </div>
    </PhoneFrame>
  );
}
