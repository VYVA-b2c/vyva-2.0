import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ChevronLeft, Clock, Mic, Pencil, Pill, Plus, ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/queryClient";

type MyMedicine = {
  id: string;
  display_name: string;
  common_name?: string | null;
  dose_text?: string | null;
  purpose_text?: string | null;
  item_type: "prescription" | "otc" | "supplement";
  drug_class_tag?: string | null;
  photo_url?: string | null;
  prescriber_name?: string | null;
  refill_due_date?: string | null;
  schedule_times?: string[] | null;
  status: "active" | "paused" | "discontinued";
};

type MyMedicinesResponse = {
  medicines: MyMedicine[];
  classTags: string[];
};

type AddForm = {
  display_name: string;
  purpose_text: string;
  drug_class_tag: string;
  dose_text: string;
  item_type: "prescription" | "otc" | "supplement";
  added_via: "voice" | "manual" | "photo";
  photo_url: string;
};

const EMPTY_FORM: AddForm = {
  display_name: "",
  purpose_text: "",
  drug_class_tag: "other_uncategorized",
  dose_text: "",
  item_type: "prescription",
  added_via: "manual",
  photo_url: "",
};

const CLASS_LABELS: Record<string, string> = {
  blood_pressure_lowering: "Blood pressure",
  blood_thinner: "Blood thinner",
  nsaid_pain_reliever: "Pain reliever",
  opioid_pain_reliever: "Strong pain relief",
  sedative_sleep_aid: "Sleep aid",
  diabetes_blood_sugar: "Blood sugar",
  diuretic_water_pill: "Water pill",
  antidepressant: "Mood medicine",
  statin_cholesterol: "Cholesterol",
  supplement_herbal: "Herbal supplement",
  antihistamine_allergy: "Allergy",
  other_uncategorized: "Something else",
};

const FORM_STEPS = ["name", "purpose", "schedule", "confirm"] as const;

function truncateAtWord(value: string, maxLength: number) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) return trimmed;
  const slice = trimmed.slice(0, maxLength + 1);
  const lastSpace = slice.lastIndexOf(" ");
  const safeSlice = lastSpace > 0 ? slice.slice(0, lastSpace) : trimmed;
  return `${safeSlice.trimEnd()}...`;
}

export default function MyMedicines({
  onStartVoice,
  onOpenReminders,
  onOpenRefills,
}: {
  onStartVoice?: () => void;
  onOpenReminders?: () => void;
  onOpenRefills?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showPrevious, setShowPrevious] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<MyMedicine | null>(null);
  const [addChoiceOpen, setAddChoiceOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);

  const { data, isLoading } = useQuery<MyMedicinesResponse>({
    queryKey: ["/api/meds/my-medicines"],
  });

  const classTags = data?.classTags?.length ? data.classTags : Object.keys(CLASS_LABELS);
  const activeMedicines = useMemo(
    () => (data?.medicines ?? []).filter((medicine) => medicine.status === "active"),
    [data?.medicines],
  );
  const previousMedicines = useMemo(
    () => (data?.medicines ?? []).filter((medicine) => medicine.status !== "active"),
    [data?.medicines],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/api/meds/my-medicines", {
        method: "POST",
        body: JSON.stringify({
          display_name: form.display_name,
          purpose_text: form.purpose_text,
          drug_class_tag: form.drug_class_tag,
          dose_text: form.dose_text,
          item_type: form.item_type,
          added_via: form.added_via,
          photo_url: form.photo_url || null,
        }),
      });
      if (!response.ok) throw new Error("Failed to save medicine");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meds/my-medicines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/interactions"] });
      setForm(EMPTY_FORM);
      setStepIndex(0);
      setAddOpen(false);
    },
  });

  const discontinueMutation = useMutation({
    mutationFn: async (medicineId: string) => {
      const response = await apiFetch(`/api/meds/my-medicines/${medicineId}/discontinue`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to discontinue medicine");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meds/my-medicines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/interactions"] });
      setSelectedMedicine(null);
    },
  });

  const currentStep = FORM_STEPS[stepIndex];
  const canContinue = currentStep === "name"
    ? form.display_name.trim().length > 0
    : currentStep === "purpose"
      ? form.purpose_text.trim().length > 0
      : currentStep === "schedule"
        ? form.dose_text.trim().length > 0
        : true;

  function startAdd(addedVia: AddForm["added_via"]) {
    if (addedVia === "voice" && onStartVoice) {
      setAddChoiceOpen(false);
      onStartVoice();
      return;
    }
    setForm({ ...EMPTY_FORM, added_via: addedVia });
    setStepIndex(0);
    setAddChoiceOpen(false);
    setAddOpen(true);
  }

  function medicineDoseLine(medicine: MyMedicine) {
    return truncateAtWord(medicine.dose_text || t("meds.myMedicines.routineMissing", "Routine to add"), 82);
  }

  function medicinePurposeLine(medicine: MyMedicine) {
    return truncateAtWord(medicine.purpose_text || t("meds.myMedicines.purposeMissing", "Purpose to add"), 74);
  }

  const isAddingMedicine = addOpen || addChoiceOpen;

  if (selectedMedicine) {
    return (
      <section className="mt-5 rounded-[26px] border border-[#D9ECE4] bg-white p-5 shadow-[0_14px_32px_rgba(15,76,69,0.08)]" data-testid="section-my-medicines-detail">
        <button
          type="button"
          onClick={() => setSelectedMedicine(null)}
          className="vyva-tap inline-flex min-h-[52px] items-center gap-2 rounded-full border border-[#BDEBD8] bg-white px-4 font-body text-[18px] font-black text-[#0F766E]"
        >
          <ChevronLeft size={22} />
          {t("meds.myMedicines.back", "Back")}
        </button>
        <div className="mt-5 flex items-start gap-4">
          <div className="flex h-[84px] w-[84px] flex-shrink-0 items-center justify-center rounded-[24px] bg-[#F5F3FF] text-vyva-purple">
            <Pill size={38} />
          </div>
          <div className="min-w-0">
            <h2 className="font-body text-[34px] font-black leading-tight text-vyva-text-1">{selectedMedicine.display_name}</h2>
            <p className="mt-2 font-body text-[22px] font-black leading-snug text-[#0F4C45]">{selectedMedicine.dose_text || t("meds.myMedicines.noDose", "Routine not added yet")}</p>
            <p className="mt-2 font-body text-[20px] font-bold leading-snug text-vyva-text-2">{selectedMedicine.purpose_text || t("meds.myMedicines.noPurpose", "Purpose not added yet")}</p>
            {selectedMedicine.prescriber_name ? (
              <p className="mt-2 font-body text-[20px] font-bold text-vyva-text-2">{t("meds.myMedicines.prescriber", "Prescribed by")}: {selectedMedicine.prescriber_name}</p>
            ) : null}
            {selectedMedicine.refill_due_date ? (
              <p className="mt-1 font-body text-[20px] font-bold text-vyva-text-2">{t("meds.myMedicines.refillDue", "Next refill")}: {selectedMedicine.refill_due_date}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          data-testid="button-my-medicine-discontinue"
          onClick={() => discontinueMutation.mutate(selectedMedicine.id)}
          disabled={discontinueMutation.isPending}
          className="vyva-tap mt-6 inline-flex min-h-[70px] w-full items-center justify-center gap-2 rounded-full border border-[#FBCACA] bg-[#FEF2F2] px-5 font-body text-[20px] font-black text-[#B91C1C]"
        >
          <Check size={22} />
          {t("meds.myMedicines.discontinue", "Mark as discontinued")}
        </button>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-[26px] border border-[#D9ECE4] bg-white p-5 shadow-[0_14px_32px_rgba(15,76,69,0.08)]" data-testid="section-my-medicines">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-body text-[15px] font-black uppercase tracking-[0.08em] text-vyva-purple">{t("meds.myMedicines.kicker", "My Medicines")}</p>
          <h2 className="mt-1 font-body text-[34px] font-black leading-tight text-vyva-text-1">
            {isAddingMedicine ? t("meds.myMedicines.addTitle", "Add medicine") : t("meds.myMedicines.title", "My Medicines")}
          </h2>
        </div>
        {isAddingMedicine ? (
          <button
            type="button"
            data-testid="button-my-medicines-list"
            onClick={() => {
              setAddOpen(false);
              setAddChoiceOpen(false);
            }}
            className="vyva-tap inline-flex min-h-[60px] items-center justify-center gap-2 rounded-full border border-[#D8C4EE] bg-white px-5 font-body text-[19px] font-black text-vyva-purple"
          >
            <ChevronLeft size={22} aria-hidden="true" />
            {t("meds.myMedicines.list", "List")}
          </button>
        ) : (
          <button
            type="button"
            data-testid="button-my-medicines-add"
            onClick={() => {
              setAddOpen(false);
              setAddChoiceOpen(true);
            }}
            className="vyva-tap inline-flex min-h-[70px] items-center justify-center gap-2 rounded-full bg-vyva-purple px-6 font-body text-[20px] font-black text-white"
          >
            <Plus size={24} />
            {t("meds.myMedicines.add", "Add")}
          </button>
        )}
      </div>

      {addOpen ? (
        <div className="mt-5 rounded-[24px] border border-[#E7D9F8] bg-[#FBF8FF] p-4" data-testid="panel-my-medicines-add">
          <button
            type="button"
            onClick={() => {
              setAddOpen(false);
              setAddChoiceOpen(true);
            }}
            className="vyva-tap mb-4 inline-flex min-h-[52px] items-center gap-2 rounded-full border border-[#D8C4EE] bg-white px-4 font-body text-[17px] font-black text-vyva-purple"
          >
            <ChevronLeft size={22} aria-hidden="true" />
            {t("meds.myMedicines.method", "Method")}
          </button>
          {currentStep === "confirm" ? (
            <>
              <p className="font-body text-[22px] font-black leading-snug text-vyva-text-1">
                {t("meds.myMedicines.confirm", "I will add this medicine. Is it correct?")}
              </p>
              <p className="mt-3 rounded-[20px] bg-white p-4 font-body text-[22px] font-black leading-snug text-[#0F4C45]">
                {[form.display_name, form.dose_text, form.purpose_text].filter(Boolean).join(", ")}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setStepIndex(0)} className="vyva-tap min-h-[70px] rounded-full border border-[#D8C4EE] bg-white px-5 font-body text-[20px] font-black text-vyva-purple">
                  {t("meds.myMedicines.edit", "Edit")}
                </button>
                <button
                  type="button"
                  data-testid="button-my-medicines-save"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className="vyva-tap min-h-[70px] rounded-full bg-[#0F766E] px-5 font-body text-[20px] font-black text-white"
                >
                  {t("meds.myMedicines.save", "Yes, save")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="font-body text-[22px] font-black leading-snug text-vyva-text-1">
                {currentStep === "name"
                  ? t("meds.myMedicines.nameQuestion", "What do you call it?")
                  : currentStep === "purpose"
                    ? t("meds.myMedicines.purposeQuestion", "What is it for?")
                    : t("meds.myMedicines.scheduleQuestion", "When do you take it?")}
              </p>
              {currentStep === "name" ? (
                <input
                  value={form.display_name}
                  onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
                  placeholder={t("meds.myMedicines.namePlaceholder", "e.g. little white heart pill")}
                  className="mt-4 min-h-[70px] w-full rounded-[22px] border border-[#D8C4EE] bg-white px-5 font-body text-[22px] font-black text-vyva-text-1 outline-none"
                />
              ) : currentStep === "purpose" ? (
                <div className="mt-4 grid gap-3">
                  <input
                    value={form.purpose_text}
                    onChange={(event) => setForm((current) => ({ ...current, purpose_text: event.target.value }))}
                    placeholder={t("meds.myMedicines.purposePlaceholder", "e.g. for blood pressure")}
                    className="min-h-[70px] w-full rounded-[22px] border border-[#D8C4EE] bg-white px-5 font-body text-[22px] font-black text-vyva-text-1 outline-none"
                  />
                  <select
                    value={form.drug_class_tag}
                    onChange={(event) => setForm((current) => ({ ...current, drug_class_tag: event.target.value }))}
                    className="min-h-[70px] w-full rounded-[22px] border border-[#D8C4EE] bg-white px-5 font-body text-[22px] font-black text-vyva-text-1 outline-none"
                    aria-label={t("meds.myMedicines.classLabel", "Medicine type")}
                  >
                    {classTags.map((tag) => (
                      <option key={tag} value={tag}>{CLASS_LABELS[tag] ?? tag}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  value={form.dose_text}
                  onChange={(event) => setForm((current) => ({ ...current, dose_text: event.target.value }))}
                  placeholder={t("meds.myMedicines.schedulePlaceholder", "e.g. 1 pill in the morning")}
                  className="mt-4 min-h-[70px] w-full rounded-[22px] border border-[#D8C4EE] bg-white px-5 font-body text-[22px] font-black text-vyva-text-1 outline-none"
                />
              )}
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setStepIndex((current) => current + 1)}
                className="vyva-tap mt-4 min-h-[70px] w-full rounded-full bg-[#0F766E] px-5 font-body text-[20px] font-black text-white disabled:opacity-50"
              >
                {t("common.next", "Next")}
              </button>
            </>
          )}
        </div>
      ) : addChoiceOpen ? (
        <div
          className="mt-5 rounded-[24px] border border-[#E7D9F8] bg-[#FBF8FF] p-4"
          data-testid="panel-my-medicines-add-choice"
          aria-label={t("meds.myMedicines.addChoiceTitle", "Choose method")}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <button type="button" onClick={() => startAdd("voice")} className="vyva-tap min-h-[70px] rounded-[22px] border border-[#DDD6FE] bg-[#F5F3FF] px-4 font-body text-[20px] font-black text-vyva-purple">
              <Mic className="mx-auto mb-1" size={24} />
              {t("meds.myMedicines.voice", "Voice")}
            </button>
            <button type="button" onClick={() => startAdd("photo")} className="vyva-tap min-h-[70px] rounded-[22px] border border-[#BDEBD8] bg-[#F0FDFA] px-4 font-body text-[20px] font-black text-[#0F766E]">
              <Camera className="mx-auto mb-1" size={24} />
              {t("meds.myMedicines.photo", "Photo")}
            </button>
            <button type="button" onClick={() => startAdd("manual")} className="vyva-tap min-h-[70px] rounded-[22px] border border-[#FED7AA] bg-[#FFF7ED] px-4 font-body text-[20px] font-black text-[#B45309]">
              <Pencil className="mx-auto mb-1" size={24} />
              {t("meds.myMedicines.manual", "Manual")}
            </button>
          </div>
        </div>
      ) : null}

      {!addOpen && !addChoiceOpen ? (
        <>
          <div className="mt-5 grid gap-3" data-testid="list-my-medicines-active">
            {isLoading ? (
              <p className="font-body text-[20px] font-black text-vyva-text-2">{t("common.loading", "Loading...")}</p>
            ) : activeMedicines.length ? (
              activeMedicines.map((medicine) => (
                <button
                  key={medicine.id}
                  type="button"
                  onClick={() => setSelectedMedicine(medicine)}
                  className="vyva-tap flex min-h-[118px] items-center gap-4 rounded-[24px] border border-[#E3E6DD] bg-[#FFFCF8] p-4 text-left"
                >
                  <div className="flex h-[64px] w-[64px] flex-shrink-0 items-center justify-center rounded-[20px] bg-[#F5F3FF] text-vyva-purple">
                    <Pill size={30} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-body text-[24px] font-black leading-tight text-vyva-text-1">{medicine.display_name}</h3>
                    <p className="mt-1 break-words font-body text-[20px] font-black leading-snug text-[#0F4C45]">{medicineDoseLine(medicine)}</p>
                    <p className="mt-1 break-words font-body text-[20px] font-bold leading-snug text-vyva-text-2">{medicinePurposeLine(medicine)}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#D8C4EE] bg-[#FBF8FF] p-5">
                <p className="font-body text-[22px] font-black text-vyva-text-1">{t("meds.myMedicines.emptyTitle", "No medicines saved yet")}</p>
                <p className="mt-2 font-body text-[20px] font-bold leading-snug text-vyva-text-2">{t("meds.myMedicines.emptySub", "Add prescriptions, vitamins, and over-the-counter items here.")}</p>
              </div>
            )}
          </div>

          {previousMedicines.length ? (
            <div className="mt-5">
              <button type="button" onClick={() => setShowPrevious((value) => !value)} className="vyva-tap min-h-[60px] rounded-full border border-[#E3E6DD] bg-white px-5 font-body text-[19px] font-black text-vyva-text-2">
                {showPrevious ? t("meds.myMedicines.hidePrevious", "Hide previous medicines") : t("meds.myMedicines.showPrevious", "Show previous medicines")}
              </button>
              {showPrevious ? (
                <div className="mt-3 grid gap-2">
                  {previousMedicines.map((medicine) => (
                    <p key={medicine.id} className="rounded-[18px] bg-[#F6F2EA] px-4 py-3 font-body text-[18px] font-bold text-vyva-text-2">
                      {medicine.display_name}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={onOpenReminders} className="vyva-tap min-h-[70px] rounded-full border border-[#DDD6FE] bg-white px-5 font-body text-[20px] font-black text-vyva-purple">
              <Clock className="mr-2 inline" size={22} />
              {t("meds.myMedicines.reminders", "Go to My Reminders")}
            </button>
            <button type="button" onClick={onOpenRefills} className="vyva-tap min-h-[70px] rounded-full border border-[#FED7AA] bg-white px-5 font-body text-[20px] font-black text-[#B45309]">
              <ShoppingCart className="mr-2 inline" size={22} />
              {t("meds.myMedicines.refills", "Go to My Refills")}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
