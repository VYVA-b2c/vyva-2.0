import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Camera, CheckCircle2, ChevronDown, User } from "lucide-react";
import { ProfileSectionHero } from "@/components/onboarding/ProfileSectionHero";
import { SiFacebook, SiInstagram, SiWhatsapp } from "react-icons/si";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";
import { LANGUAGES } from "@/i18n/languages";
import {
  buildOnboardingIdentityPayload,
  compressAvatarFile,
  createEmptyIdentityForm,
  identityFromOnboardingProfile,
  joinFullName,
  splitFullName,
  splitPhoneNumber,
  validateIdentityBasics,
  type IdentityBasicsForm,
  type OnboardingIdentityProfile,
} from "@/lib/profileIdentity";

const MONTHS = [
  { value: "01", label: "January"  },
  { value: "02", label: "February" },
  { value: "03", label: "March"    },
  { value: "04", label: "April"    },
  { value: "05", label: "May"      },
  { value: "06", label: "June"     },
  { value: "07", label: "July"     },
  { value: "08", label: "August"   },
  { value: "09", label: "September"},
  { value: "10", label: "October"  },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const CHANNELS = [
  { value: "email",    label: "Email"    },
  { value: "in-app",  label: "In-app"   },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms",     label: "SMS"      },
] as const;

type ChannelValue = "email" | "in-app" | "whatsapp" | "sms";

const CHANNEL_ROWS: { key: "channel_reports" | "channel_chats" | "channel_notifications"; label: string; icon: string }[] = [
  { key: "channel_reports",      label: "Reports",       icon: "Info" },
  { key: "channel_chats",        label: "Chats",         icon: "Info" },
  { key: "channel_notifications",label: "Notifications", icon: "Info" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 101 }, (_, i) => String(CURRENT_YEAR - 10 - i));
const DAYS  = Array.from({ length: 31  }, (_, i) => String(i + 1));

function parseDob(dob: string): { day: string; month: string; year: string } {
  if (!dob || !dob.includes("-")) return { day: "", month: "", year: "" };
  const [y, m, d] = dob.split("-");
  return { day: String(parseInt(d || "0", 10)), month: m ?? "", year: y ?? "" };
}

function assembleDob(day: string, month: string, year: string): string {
  if (!day || !month || !year) return "";
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

type BasicsForm = IdentityBasicsForm & {
  channel_reports:        ChannelValue;
  channel_chats:          ChannelValue;
  channel_notifications:  ChannelValue;
  hybrid_channel_mode:    boolean;
  facebook_url:           string;
  instagram_url:          string;
  whatsapp_number:        string;
};

type ServerProfile = OnboardingIdentityProfile & Partial<{
  channel_reports:        ChannelValue;
  channel_chats:          ChannelValue;
  channel_notifications:  ChannelValue;
  hybrid_channel_mode:    boolean;
  facebook_url:           string | null;
  instagram_url:          string | null;
  whatsapp_number:        string | null;
}>;

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body text-[11px] font-semibold text-vyva-text-3 uppercase tracking-wider px-1 mb-1.5">
      {children}
    </p>
  );
}

function Toggle({
  on,
  onChange,
  testId,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => onChange(!on)}
      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${
        on ? "bg-vyva-purple" : "bg-gray-300"
      }`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function BasicsSection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [form, setForm] = useState<BasicsForm>(() => ({
    ...createEmptyIdentityForm(),
    channel_reports: "email",
    channel_chats: "in-app",
    channel_notifications: "whatsapp",
    hybrid_channel_mode: false,
    facebook_url: "", instagram_url: "", whatsapp_number: "",
  }));

  const [dobDay,   setDobDay]   = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear,  setDobYear]  = useState("");

  const [facebookOn,     setFacebookOn]     = useState(false);
  const [instagramOn,    setInstagramOn]    = useState(false);
  const [whatsappOn,     setWhatsappOn]     = useState(false);
  const [socialExpanded, setSocialExpanded] = useState(false);

  const [saving,       setSaving]       = useState(false);
  const [saveSuccess,  setSaveSuccess]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const { data, isLoading } = useQuery<{ profile: ServerProfile | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    if (data?.profile) {
      const p = data.profile;
      const identity = identityFromOnboardingProfile(p);
      setForm((prev) => ({
        ...prev,
        ...identity,
        channel_reports:       p.channel_reports ?? prev.channel_reports,
        channel_chats:         p.channel_chats ?? prev.channel_chats,
        channel_notifications: p.channel_notifications ?? prev.channel_notifications,
        hybrid_channel_mode:   typeof p.hybrid_channel_mode === "boolean" ? p.hybrid_channel_mode : prev.hybrid_channel_mode,
        facebook_url:          p.facebook_url ?? prev.facebook_url,
        instagram_url:         p.instagram_url ?? prev.instagram_url,
        whatsapp_number:       p.whatsapp_number ?? prev.whatsapp_number,
      }));
      const parsed = parseDob(identity.dateOfBirth);
      setDobDay(parsed.day);
      setDobMonth(parsed.month);
      setDobYear(parsed.year);
      setFacebookOn(Boolean(p.facebook_url));
      setInstagramOn(Boolean(p.instagram_url));
      setWhatsappOn(Boolean(p.whatsapp_number));
    }
  }, [data]);

  const buildPayload = (f: BasicsForm) => ({
    ...buildOnboardingIdentityPayload(f),
    channel_reports:        f.channel_reports,
    channel_chats:          f.channel_chats,
    channel_notifications:  f.channel_notifications,
    hybrid_channel_mode:    f.hybrid_channel_mode,
    facebook_url:           f.facebook_url.trim()    || null,
    instagram_url:          f.instagram_url.trim()   || null,
    whatsapp_number:        f.whatsapp_number.trim() || null,
  });

  const completePath = () => {
    const returnTo = searchParams.get("returnTo");
    return returnTo
      ? `/onboarding/complete/basics?returnTo=${encodeURIComponent(returnTo)}`
      : "/onboarding/complete/basics";
  };

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave } = useAutoSave(
    async () => {
      const f = formRef.current;
      if (validateIdentityBasics(f).firstName) return;
      const res = await apiFetch("/api/onboarding/basics", {
        method: "POST",
        body: JSON.stringify(buildPayload(f)),
      });
      if (!res.ok) {
        const msg = await friendlyError(new Error(), res);
        throw new Error(msg);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
    },
    2000,
  );

  const avatarMutation = useMutation({
    mutationFn: async (dataUrl: string | null) => {
      const res = await apiFetch("/api/profile/avatar", {
        method: "PATCH",
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_data, dataUrl) => {
      setForm((prev) => ({ ...prev, avatarUrl: dataUrl }));
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
    },
    onError: () => {
      toast({ title: "Could not update photo", variant: "destructive" });
    },
  });

  const set = <K extends keyof BasicsForm>(field: K, value: BasicsForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    scheduleAutoSave();
  };

  const setFullName = (value: string) => {
    setForm((prev) => ({ ...prev, ...splitFullName(value) }));
    scheduleAutoSave();
  };

  const setPhoneNumber = (value: string) => {
    const phone = splitPhoneNumber(value, form.phoneCountry);
    setForm((prev) => ({ ...prev, ...phone }));
    scheduleAutoSave();
  };

  const handleDobChange = (day: string, month: string, year: string) => {
    const assembled = assembleDob(day, month, year);
    setForm((prev) => ({ ...prev, dateOfBirth: assembled }));
    scheduleAutoSave();
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await compressAvatarFile(file);
      avatarMutation.mutate(dataUrl);
    } catch {
      toast({ title: "Could not update photo", variant: "destructive" });
    } finally {
      e.target.value = "";
    }
  };

  const isValid = !validateIdentityBasics(form).firstName;

  const handleSave = async () => {
    if (saving || !isValid) return;
    cancelAutoSave();
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/basics", {
        method: "POST",
        body: JSON.stringify(buildPayload(form)),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
      setSaveSuccess(true);
      setTimeout(() => navigate(completePath()), 1500);
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save basics", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const FieldSkeleton = () => <Skeleton className="h-11 w-full rounded-lg" />;

  const greetingName = form.preferredName.trim() || form.firstName.trim();
  const greeting = greetingName
    ? `Hi, ${greetingName}!`
    : "Hi there!";

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col">
      {/* Nav header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          data-testid="button-basics-back"
          onClick={() => navigate("/onboarding/profile")}
          className="p-2 -ml-2 rounded-full text-vyva-text-2 hover:bg-vyva-warm transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="flex-1 font-display text-[20px] font-semibold text-vyva-text-1">
          Your basics
        </h1>
      </div>

      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col space-y-7 overflow-y-auto px-4 pb-8 sm:px-5">
        <ProfileSectionHero
          icon={User}
          title="About you"
          kicker="Personal setup"
          description="Add the basics VYVA needs to speak to you properly, use the right language, and keep contact details clear."
          badges={[
            { label: "Your name", color: "purple" },
            { label: "Language", color: "blue" },
            { label: "Contact", color: "green" },
          ]}
          autoSave={{ autoSaveStatus, savedFading, retryCountdown, onRetryNow: retryNow, testId: "status-basics-autosave" }}
        />
        {/* Avatar + greeting card */}
        <div className="bg-white rounded-[22px] border border-vyva-border px-5 py-5 flex flex-col items-center gap-3"
             style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <button
            data-testid="button-basics-avatar"
            type="button"
            onClick={handleAvatarClick}
            className="relative w-[88px] h-[88px] rounded-full bg-vyva-warm2 flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ring-vyva-purple/20 hover:ring-vyva-purple/50 transition-all"
          >
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <Camera size={28} className="text-vyva-text-3" />
            )}
            <span className="absolute inset-0 flex items-end justify-center pb-2 bg-gradient-to-t from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity">
              <span className="font-body text-[10px] text-white font-medium">Change</span>
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid="input-basics-avatar-file"
            onChange={handleAvatarFile}
            disabled={avatarMutation.isPending}
          />
          <div className="text-center">
            <p className="font-display text-[18px] font-semibold text-vyva-text-1">
              {greeting}
            </p>
            <p className="font-body text-[13px] text-vyva-text-2 mt-0.5">
              Let's get your basics set up.
            </p>
          </div>
        </div>

        {/* About you */}
        <div>
          <SectionHeader>About you</SectionHeader>
          <div className="bg-white rounded-[22px] border border-vyva-border overflow-hidden"
               style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            {/* Full name */}
            <div className="px-4 py-3 border-b border-vyva-border space-y-1">
              <Label className="font-body text-[15px] font-extrabold text-vyva-text-2">
                Full name <span className="text-red-400">*</span>
              </Label>
              {isLoading ? <FieldSkeleton /> : (
                <Input
                  data-testid="input-basics-full-name"
                  placeholder="Your full legal name"
                  value={joinFullName(form.firstName, form.lastName)}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12 rounded-[16px] border-[#DDC7FF] px-4 text-[17px] shadow-[0_8px_20px_rgba(53,28,87,0.05)] focus-visible:ring-4 focus-visible:ring-vyva-purple/15"
                />
              )}
            </div>

            {/* Preferred name */}
            <div className="px-4 py-3 border-b border-vyva-border space-y-1">
              <Label className="font-body text-[15px] font-extrabold text-vyva-text-2">
                Preferred name <span className="font-normal text-vyva-text-3">(optional)</span>
              </Label>
              {isLoading ? <FieldSkeleton /> : (
                <Input
                  data-testid="input-basics-preferred-name"
                  placeholder="What should VYVA call you?"
                  value={form.preferredName}
                  onChange={(e) => set("preferredName", e.target.value)}
                  className="h-12 rounded-[16px] border-[#DDC7FF] px-4 text-[17px] shadow-[0_8px_20px_rgba(53,28,87,0.05)] focus-visible:ring-4 focus-visible:ring-vyva-purple/15"
                />
              )}
            </div>

            {/* Email */}
            <div className="px-4 py-3 border-b border-vyva-border space-y-1">
              <Label className="font-body text-[15px] font-extrabold text-vyva-text-2">
                Email address <span className="font-normal text-vyva-text-3">(optional)</span>
              </Label>
              {isLoading ? <FieldSkeleton /> : (
                <>
                  <Input
                    data-testid="input-basics-email"
                    type="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className="h-12 rounded-[16px] border-[#DDC7FF] px-4 text-[17px] shadow-[0_8px_20px_rgba(53,28,87,0.05)] focus-visible:ring-4 focus-visible:ring-vyva-purple/15"
                  />
                  <p className="font-body text-[11px] text-vyva-text-3">
                    Optional - we'll only use this to send you updates.
                  </p>
                </>
              )}
            </div>

            {/* Phone */}
            <div className="px-4 py-3 space-y-1">
              <Label className="font-body text-[15px] font-extrabold text-vyva-text-2">
                Phone number
              </Label>
              {isLoading ? <FieldSkeleton /> : (
                <Input
                  data-testid="input-basics-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="e.g. +34 612 345 678"
                  value={form.phoneLocal}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="h-12 rounded-[16px] border-[#DDC7FF] px-4 text-[17px] shadow-[0_8px_20px_rgba(53,28,87,0.05)] focus-visible:ring-4 focus-visible:ring-vyva-purple/15"
                />
              )}
            </div>
          </div>
        </div>

        {/* Date of birth */}
        <div>
          <SectionHeader>Date of birth</SectionHeader>
          <div className="bg-white rounded-[22px] border border-vyva-border px-4 py-3"
               style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            {isLoading ? <FieldSkeleton /> : (
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
                <div className="space-y-1">
                  <p className="font-body text-[11px] text-vyva-text-3">Day</p>
                  <Select
                    value={dobDay}
                    onValueChange={(v) => { setDobDay(v); handleDobChange(v, dobMonth, dobYear); }}
                  >
                    <SelectTrigger data-testid="select-basics-dob-day" className="h-12 rounded-[16px] border-[#DDC7FF] px-4 text-[16px]">
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="font-body text-[11px] text-vyva-text-3">Month</p>
                  <Select
                    value={dobMonth}
                    onValueChange={(v) => { setDobMonth(v); handleDobChange(dobDay, v, dobYear); }}
                  >
                    <SelectTrigger data-testid="select-basics-dob-month" className="h-12 rounded-[16px] border-[#DDC7FF] px-4 text-[16px]">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="font-body text-[11px] text-vyva-text-3">Year</p>
                  <Select
                    value={dobYear}
                    onValueChange={(v) => { setDobYear(v); handleDobChange(dobDay, dobMonth, v); }}
                  >
                    <SelectTrigger data-testid="select-basics-dob-year" className="h-12 rounded-[16px] border-[#DDC7FF] px-4 text-[16px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* How to reach you */}
        <div>
          <SectionHeader>How should VYVA reach you?</SectionHeader>
          <div className="bg-white rounded-[22px] border border-vyva-border overflow-hidden"
               style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            {isLoading ? (
              <div className="px-4 py-3"><FieldSkeleton /></div>
            ) : (
              <>
                {/* Per-type channel rows */}
                <div className={form.hybrid_channel_mode ? "opacity-40 pointer-events-none" : ""}>
                  {CHANNEL_ROWS.map((row, idx) => (
                    <div
                      key={row.key}
                      className={`px-4 py-3 ${idx < CHANNEL_ROWS.length - 1 ? "border-b border-vyva-border" : ""}`}
                    >
                      <p className="mb-3 flex items-center gap-1.5 font-body text-[15px] font-extrabold text-vyva-text-2">
                        <span>{row.icon}</span>
                        {row.label}
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {CHANNELS.map((ch) => (
                          <button
                            key={ch.value}
                            type="button"
                            data-testid={`button-basics-${row.key}-${ch.value}`}
                            onClick={() => set(row.key, ch.value)}
                            className={`min-h-11 rounded-full px-3 font-body text-[15px] font-black transition-colors ${
                              form[row.key] === ch.value
                                ? "bg-vyva-purple text-white"
                                : "bg-vyva-warm text-vyva-text-2 hover:bg-vyva-warm2"
                            }`}
                          >
                            {ch.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Hybrid mode toggle */}
                <div className="px-4 py-4 border-t border-vyva-border bg-vyva-cream/50">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-[14px] font-semibold text-vyva-text-1 flex items-center gap-1.5">
                        <span>Smart</span>
                        Hybrid mode
                      </p>
                      <p className="font-body text-[12px] text-vyva-text-3 leading-[1.45] mt-0.5">
                        VYVA picks the best channel for each message based on your habits and time of day.
                      </p>
                    </div>
                    <Toggle
                      on={form.hybrid_channel_mode}
                      onChange={(v) => set("hybrid_channel_mode", v)}
                      testId="toggle-basics-hybrid-mode"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Preferred language */}
        <div>
          <SectionHeader>Preferred language</SectionHeader>
          <div className="bg-white rounded-[22px] border border-vyva-border px-4 py-3"
               style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            {isLoading ? <FieldSkeleton /> : (
              <Select value={form.language} onValueChange={(v) => set("language", v as BasicsForm["language"])}>
                <SelectTrigger data-testid="select-basics-language" className="h-12 rounded-[16px] border-[#DDC7FF] px-4 text-[17px] shadow-[0_8px_20px_rgba(53,28,87,0.05)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Social connections */}
        <div>
          <button
            type="button"
            data-testid="button-basics-social-expand"
            onClick={() => setSocialExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-1 mb-1.5"
          >
            <span className="font-body text-[11px] font-semibold text-vyva-text-3 uppercase tracking-wider">
              Let VYVA speak for you (optional)
            </span>
            <ChevronDown
              size={14}
              className={`text-vyva-text-3 transition-transform ${socialExpanded ? "rotate-180" : ""}`}
            />
          </button>
          <div
            className={`bg-white rounded-[22px] border border-vyva-border overflow-hidden transition-all ${
              socialExpanded ? "block" : "hidden"
            }`}
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>

            {/* Facebook */}
            <div className="px-4 py-4 border-b border-vyva-border" data-testid="social-card-facebook">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
                     style={{ background: "#EEF2FF" }}>
                  <SiFacebook size={18} style={{ color: "#1877F2" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[14px] font-medium text-vyva-text-1">Facebook</p>
                  <p className="font-body text-[12px] text-vyva-text-3 leading-[1.4] mt-0.5">
                    Summarise a meaningful day out, share a big life moment, send condolences on your behalf
                  </p>
                </div>
                <Toggle
                  on={facebookOn}
                  onChange={(v) => {
                    setFacebookOn(v);
                    if (!v) { set("facebook_url", ""); }
                  }}
                  testId="toggle-basics-facebook"
                />
              </div>
              {facebookOn && (
                <div className="mt-3 ml-12">
                  <Input
                    data-testid="input-basics-facebook-url"
                    placeholder="Your Facebook page URL"
                    value={form.facebook_url}
                    onChange={(e) => set("facebook_url", e.target.value)}
                    className="h-10 text-[13px]"
                  />
                </div>
              )}
            </div>

            {/* Instagram */}
            <div className="px-4 py-4 border-b border-vyva-border" data-testid="social-card-instagram">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
                     style={{ background: "#FFF0F6" }}>
                  <SiInstagram size={18} style={{ color: "#C13584" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[14px] font-medium text-vyva-text-1">Instagram</p>
                  <p className="font-body text-[12px] text-vyva-text-3 leading-[1.4] mt-0.5">
                    Share your kids' big day at the hairdresser, celebrate a grandchild's first steps
                  </p>
                </div>
                <Toggle
                  on={instagramOn}
                  onChange={(v) => {
                    setInstagramOn(v);
                    if (!v) { set("instagram_url", ""); }
                  }}
                  testId="toggle-basics-instagram"
                />
              </div>
              {instagramOn && (
                <div className="mt-3 ml-12">
                  <Input
                    data-testid="input-basics-instagram-url"
                    placeholder="Your Instagram handle, e.g. @yourname"
                    value={form.instagram_url}
                    onChange={(e) => set("instagram_url", e.target.value)}
                    className="h-10 text-[13px]"
                  />
                </div>
              )}
            </div>

            {/* WhatsApp */}
            <div className="px-4 py-4" data-testid="social-card-whatsapp">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
                     style={{ background: "#ECFDF5" }}>
                  <SiWhatsapp size={18} style={{ color: "#25D366" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[14px] font-medium text-vyva-text-1">WhatsApp</p>
                  <p className="font-body text-[12px] text-vyva-text-3 leading-[1.4] mt-0.5">
                    Pass on condolences from a friend, wish a loved one happy birthday in your own words
                  </p>
                </div>
                <Toggle
                  on={whatsappOn}
                  onChange={(v) => {
                    setWhatsappOn(v);
                    if (!v) { set("whatsapp_number", ""); }
                  }}
                  testId="toggle-basics-whatsapp"
                />
              </div>
              {whatsappOn && (
                <div className="mt-3 ml-12">
                  <Input
                    data-testid="input-basics-whatsapp-number"
                    type="tel"
                    inputMode="tel"
                    placeholder="Your WhatsApp number, e.g. +44 7700 900123"
                    value={form.whatsapp_number}
                    onChange={(e) => set("whatsapp_number", e.target.value)}
                    className="h-10 text-[13px]"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="space-y-2 pt-1">
          <button
            data-testid="button-basics-save"
            type="button"
            onClick={handleSave}
            disabled={saving || isLoading || !isValid || saveSuccess}
            className="flex w-full items-center justify-center gap-2 rounded-full py-4 font-body text-[18px] font-black text-white shadow-[0_14px_28px_rgba(107,33,168,0.22)] transition-all disabled:opacity-40"
            style={{ background: saveSuccess ? "#16A34A" : "#6B21A8" }}
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 size={20} />
                Saved!
              </>
            ) : saving ? (
              "Saving..."
            ) : (
              "Looks good, save!"
            )}
          </button>
          <button
            data-testid="button-basics-skip"
            type="button"
            onClick={() => navigate("/onboarding/profile")}
            className="w-full py-2 text-center font-body text-[15px] font-bold text-vyva-text-3"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
