// src/pages/onboarding/sections/EmergencySection.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero, seniorInputClassName } from "@/components/onboarding/ProfileSectionHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";
import { ShieldAlert } from "lucide-react";

type EmergencyForm = {
  name: string;
  relationship: string;
  primary_phone: string;
  secondary_phone: string;
  address: string;
};

export default function EmergencySection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [form, setForm] = useState<EmergencyForm>({
    name: "", relationship: "",
    primary_phone: "", secondary_phone: "", address: "",
  });
  const [saving, setSaving] = useState(false);

  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const buildEmergencyPayload = (current: EmergencyForm) => ({
    emergency_name: current.name,
    emergency_phone: current.primary_phone,
    emergency_role: current.relationship,
    secondary_phone: current.secondary_phone,
    address: current.address,
  });

  const completePath = () => {
    const returnTo = searchParams.get("returnTo");
    return returnTo
      ? `/onboarding/complete/emergency?returnTo=${encodeURIComponent(returnTo)}`
      : "/onboarding/complete/emergency";
  };

  const { data, isLoading } = useQuery<{ profile: { emergency_contact?: EmergencyForm } | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    const ec = (data?.profile as { emergency_contact?: EmergencyForm } | null)?.emergency_contact;
    if (ec) {
      setForm((prev) => ({
        name:            ec.name            ?? prev.name,
        relationship:    ec.relationship    ?? prev.relationship,
        primary_phone:   ec.primary_phone   ?? prev.primary_phone,
        secondary_phone: ec.secondary_phone ?? prev.secondary_phone,
        address:         ec.address         ?? prev.address,
      }));
    }
  }, [data]);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave } = useAutoSave(
    async () => {
      const res = await apiFetch("/api/onboarding/section/emergency", {
        method: "POST",
        body: JSON.stringify(buildEmergencyPayload(formRef.current)),
      });
      if (!res.ok) {
        const msg = await friendlyError(new Error(), res);
        throw new Error(msg);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
    },
    2000,
  );

  const set = (f: string, v: string) => {
    setForm((p) => ({ ...p, [f]: v }));
    scheduleAutoSave();
  };

  const isValid = form.name.trim() && form.primary_phone.trim();

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/emergency", {
        method: "POST",
        body: JSON.stringify(buildEmergencyPayload(form)),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
      navigate(completePath());
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save emergency contact", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const FieldSkeleton = () => <Skeleton className="h-11 w-full rounded-lg" />;

  return (
    <PhoneFrame subtitle="Emergency contact" showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-7 px-1 pb-6 pt-5 sm:px-2 md:px-3">
        <ProfileSectionHero
          icon={ShieldAlert}
          title="Emergency contact"
          kicker="Safety net"
          description="Choose the person VYVA should contact first if you need urgent help and cannot respond."
          badges={[
            { label: "24/7 reach", color: "red" },
            { label: "Urgent only", color: "amber" },
            { label: "Protected", color: "purple" },
          ]}
          iconBgClassName="bg-[#B91C1C]"
          autoSave={{ autoSaveStatus, savedFading, retryCountdown, onRetryNow: retryNow, testId: "status-emergency-autosave" }}
        />

        <div className="rounded-[24px] border border-red-100 bg-red-50 px-4 py-3 text-[15px] font-semibold leading-relaxed text-red-700">
          This person can be the same as your caregiver. Their number is shared with emergency services only when needed.
        </div>

        <div className="space-y-1.5">
          <Label className="text-[15px] font-extrabold text-gray-700">Full name</Label>
          {isLoading ? <FieldSkeleton /> : (
            <Input data-testid="input-emergency-name" placeholder="Name of emergency contact" value={form.name} onChange={(e) => set("name", e.target.value)} className={seniorInputClassName} />
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[15px] font-extrabold text-gray-700">Relationship to you</Label>
          {isLoading ? <FieldSkeleton /> : (
            <Input data-testid="input-emergency-relationship" placeholder="e.g. Daughter, Neighbour, Carer" value={form.relationship} onChange={(e) => set("relationship", e.target.value)} className={seniorInputClassName} />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 min-[620px]:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[15px] font-extrabold text-gray-700">Primary phone (24/7)</Label>
            {isLoading ? <FieldSkeleton /> : (
              <Input data-testid="input-emergency-primary-phone" type="tel" placeholder="Always reachable" value={form.primary_phone} onChange={(e) => set("primary_phone", e.target.value)} className={seniorInputClassName} />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[15px] font-extrabold text-gray-700">Secondary phone</Label>
            {isLoading ? <FieldSkeleton /> : (
              <Input data-testid="input-emergency-secondary-phone" type="tel" placeholder="Backup number" value={form.secondary_phone} onChange={(e) => set("secondary_phone", e.target.value)} className={seniorInputClassName} />
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[15px] font-extrabold text-gray-700">Their address (for emergency services)</Label>
          {isLoading ? <FieldSkeleton /> : (
            <Input data-testid="input-emergency-address" placeholder="If different from yours" value={form.address} onChange={(e) => set("address", e.target.value)} className={seniorInputClassName} />
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button data-testid="button-emergency-save" onClick={handleSave} disabled={!isValid || saving || isLoading} className="h-14 w-full rounded-full bg-[#6b21a8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5b1a8f] disabled:opacity-40">
            {saving ? "Saving..." : "Save emergency contact"}
          </Button>
          <button data-testid="button-emergency-skip" onClick={() => navigate("/onboarding/profile")} className="py-2 text-center text-[15px] font-bold text-gray-500">Skip for now</button>
        </div>
      </div>
    </PhoneFrame>
  );
}
