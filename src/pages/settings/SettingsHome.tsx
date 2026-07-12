import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Bluetooth,
  CalendarClock,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  HeartPulse,
  Info,
  Lock,
  LogOut,
  MessageCircle,
  Shield,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero } from "@/components/onboarding/ProfileSectionHero";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n";
import { APP_VERSION } from "@/lib/appInfo";
import { apiFetch } from "@/lib/queryClient";

const TERMS_OF_SERVICE_URL = "https://vyva.life/terms-of-service";
const PRIVACY_POLICY_URL = "https://vyva.life/privacypolicy";
const SUPPORT_EMAIL = "support@vyva.life";

type BillingStatus = {
  status?: string | null;
  tier?: string | null;
  trial_days_remaining?: number | null;
  plan?: {
    name?: string | null;
  } | null;
};

function buildMailtoUrl(subject: string, body: string) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

interface RowProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  sub?: string;
  value?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  "data-testid"?: string;
}

function Row({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  sub,
  value,
  onClick,
  disabled,
  danger,
  "data-testid": testId,
}: RowProps) {
  const rowContent = (
    <>
      <div
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px] shadow-[0_10px_24px_rgba(53,28,87,0.08)]"
        style={{ background: iconBg, color: iconColor }}
      >
        <Icon size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[18px] font-black leading-tight ${danger ? "text-[#B0355A]" : "text-vyva-text-1"}`}>{title}</p>
        {sub ? <p className="mt-1 text-[14px] leading-snug text-vyva-text-2">{sub}</p> : null}
      </div>
      {value ? <span className="rounded-full bg-[#F5F0FF] px-3 py-1 text-[12px] font-black text-vyva-purple">{value}</span> : null}
      {onClick ? <ChevronRight className="h-5 w-5 flex-shrink-0 text-[#C4B5D8]" /> : null}
    </>
  );

  if (!onClick) {
    return (
      <div
        data-testid={testId}
        className="flex min-h-[86px] w-full items-center gap-4 rounded-[22px] px-4 py-4 text-left"
      >
        {rowContent}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="flex min-h-[86px] w-full items-center gap-4 rounded-[22px] px-4 py-4 text-left transition-colors hover:bg-[#FCF8FF] disabled:cursor-wait disabled:opacity-70"
    >
      {rowContent}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-[#EFE4D5] bg-white p-3 shadow-[0_14px_34px_rgba(53,28,87,0.06)]">
      <div className="px-3 pb-3 pt-2 text-[12px] font-black uppercase tracking-[0.08em] text-vyva-text-2">{title}</div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function formatPlanLabel(value: string | null | undefined) {
  if (!value) return "";
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function SettingsHome() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isDownloadingData, setIsDownloadingData] = useState(false);
  const { data: billingStatus, isLoading: billingLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    retry: false,
  });

  const planName = billingStatus?.plan?.name ?? formatPlanLabel(billingStatus?.tier);
  const isFreePlan = !billingStatus?.tier || billingStatus.tier === "free";
  const planBillingValue = billingLoading
    ? undefined
    : isFreePlan
      ? t("settings.home.rows.planBillingValue")
      : planName;
  const planBillingSub = billingLoading
    ? t("settings.home.rows.planBillingSubLoading", "Checking your plan...")
    : billingStatus?.status === "active" && !isFreePlan
      ? t("settings.home.rows.planBillingSubActive", "Subscription active")
      : billingStatus?.status === "trial" && (billingStatus.trial_days_remaining ?? 0) > 0
        ? t("settings.home.rows.planBillingSubTrial", "{{count}} trial days remaining").replace(
            "{{count}}",
            String(billingStatus.trial_days_remaining ?? 0),
          )
        : billingStatus?.status === "past_due"
          ? t("settings.home.rows.planBillingSubPastDue", "Payment needs attention")
          : t("settings.home.rows.planBillingSub");

  const handleSignOut = () => {
    logout();
    navigate("/login");
  };

  const openExternalLink = (url: string) => {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.href = url;
    }
  };

  const openSupportEmail = (subject: string, bodyIntro: string) => {
    const body = [
      bodyIntro,
      "",
      "Page:",
      window.location.href,
      "",
      "App version:",
      APP_VERSION,
      "",
      "Message:",
    ].join("\n");

    navigator.clipboard?.writeText(SUPPORT_EMAIL).catch(() => undefined);
    toast({
      title: t("settings.home.rows.supportEmailReady", "Opening email draft"),
      description: t("settings.home.rows.supportEmailCopied", "Support email copied: {{email}}").replace("{{email}}", SUPPORT_EMAIL),
    });
    window.setTimeout(() => {
      window.location.href = buildMailtoUrl(subject, body);
    }, 50);
  };

  const handleDownloadData = async () => {
    if (isDownloadingData) return;
    setIsDownloadingData(true);

    try {
      const response = await apiFetch("/api/profile/export");
      if (!response.ok) {
        const body = await response.clone().json().catch(() => null);
        const message = body?.detail
          ? `${body.error ?? "Export failed"}: ${body.detail}`
          : body?.error ?? `Export failed (${response.status})`;
        throw new Error(message);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `vyva-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({
        title: t("settings.home.rows.downloadDataStarted", "Your data export is downloading"),
        description: t("settings.home.rows.downloadDataStartedDesc", "VYVA started downloading your profile export."),
      });
    } catch (err) {
      toast({
        title: t("settings.home.rows.downloadDataError", "Could not download your data"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsDownloadingData(false);
    }
  };

  return (
    <PhoneFrame>
      <div data-testid="settings-home-grid" className="grid gap-5 px-1 pb-6 pt-5 sm:px-2 md:grid-cols-2 md:items-start md:px-3">
        <ProfileSectionHero
          icon={Shield}
          title={t("settings.home.title")}
          kicker="VYVA settings"
          description={t("settings.home.subtitle")}
          badges={[
            { label: t("settings.home.sections.account"), color: "purple" },
            { label: t("settings.home.sections.privacy"), color: "green" },
            { label: t("settings.home.sections.subscription"), color: "amber" },
          ]}
          className="md:col-span-2"
        />

        <Section title={t("settings.home.sections.account")}>
          <Row
            icon={UserRound}
            iconBg="#F5F0FF"
            iconColor="#6B21A8"
            title={t("settings.home.rows.myAccount")}
            sub={t("settings.home.rows.myAccountSub")}
            onClick={() => navigate("/settings/account")}
          />
          <Row
            icon={Bell}
            iconBg="#EEF4FF"
            iconColor="#2563EB"
            title={t("settings.home.rows.notifications")}
            sub={t("settings.home.rows.notificationsSub")}
            onClick={() => navigate("/settings/notifications")}
          />
          <Row
            icon={CalendarClock}
            iconBg="#F5F0FF"
            iconColor="#6B21A8"
            title={t("settings.home.rows.scheduledSupport")}
            sub={t("settings.home.rows.scheduledSupportSub")}
            onClick={() => navigate("/settings/scheduled-support")}
            data-testid="button-settings-scheduled-support"
          />
        </Section>

        <Section title={t("settings.home.sections.healthSetup", "Health setup")}>
          <Row
            icon={HeartPulse}
            iconBg="#FDECEC"
            iconColor="#D14D41"
            title={t("settings.home.rows.healthProfile")}
            sub={t("settings.home.rows.healthProfileSub")}
            onClick={() => navigate("/onboarding/profile")}
            data-testid="button-settings-health-profile"
          />
          <Row
            icon={Bluetooth}
            iconBg="#ECFDF5"
            iconColor="#047857"
            title={t("settings.home.rows.healthDevices", "Health devices")}
            sub={t("settings.home.rows.healthDevicesSub", "Set up Bluetooth devices and capture options")}
            onClick={() => navigate("/settings/health-devices")}
            data-testid="button-settings-health-devices"
          />
        </Section>

        <Section title={t("settings.home.sections.privacy")}>
          <Row
            icon={Lock}
            iconBg="#EEF8F2"
            iconColor="#0F766E"
            title={t("settings.home.rows.privacyConsent")}
            sub={t("settings.home.rows.privacyConsentSub")}
            onClick={() => navigate("/settings/privacy")}
          />
          <Row
            icon={Download}
            iconBg="#FFF7E8"
            iconColor="#C9890A"
            title={isDownloadingData ? t("settings.home.rows.downloadDataPreparing", "Preparing your data...") : t("settings.home.rows.downloadData")}
            sub={t("settings.home.rows.downloadDataSub")}
            onClick={handleDownloadData}
            disabled={isDownloadingData}
            data-testid="button-settings-download-data"
          />
        </Section>

        <Section title={t("settings.home.sections.subscription")}>
          <Row
            icon={CreditCard}
            iconBg="#FFF1EF"
            iconColor="#E05B4B"
            title={t("settings.home.rows.planBilling")}
            sub={planBillingSub}
            value={planBillingValue}
            onClick={() => navigate("/settings/subscription")}
          />
        </Section>

        <Section title={t("settings.home.sections.about")}>
          <Row
            icon={FileText}
            iconBg="#F7F2FF"
            iconColor="#7C3AED"
            title={t("settings.home.rows.termsOfService")}
            onClick={() => openExternalLink(TERMS_OF_SERVICE_URL)}
            data-testid="button-settings-terms-of-service"
          />
          <Row
            icon={Shield}
            iconBg="#EEF8F2"
            iconColor="#0F766E"
            title={t("settings.home.rows.privacyPolicy")}
            onClick={() => openExternalLink(PRIVACY_POLICY_URL)}
            data-testid="button-settings-privacy-policy"
          />
          <Row
            icon={MessageCircle}
            iconBg="#EEF4FF"
            iconColor="#2563EB"
            title={t("settings.home.rows.contactSupport")}
            onClick={() => openSupportEmail("VYVA support request", "Tell us what you need help with and we will get back to you.")}
            data-testid="button-settings-contact-support"
          />
          <Row
            icon={Star}
            iconBg="#FFF7E8"
            iconColor="#C9890A"
            title={t("settings.home.rows.sendFeedback")}
            onClick={() => openSupportEmail("VYVA app feedback", "Tell us what you liked, what felt confusing, or what you would improve.")}
            data-testid="button-settings-send-feedback"
          />
          <Row icon={Info} iconBg="#F5F5F4" iconColor="#57534E" title={t("settings.home.rows.appVersion")} value={APP_VERSION} />
        </Section>

        <Section title={t("settings.home.sections.dangerZone")}>
          <Row
            icon={LogOut}
            iconBg="#FFF1F2"
            iconColor="#B0355A"
            title={t("settings.home.rows.signOut")}
            danger
            onClick={handleSignOut}
            data-testid="button-settings-sign-out"
          />
          <Row
            icon={Trash2}
            iconBg="#FFF1F2"
            iconColor="#B0355A"
            title={t("settings.home.rows.deleteAccount")}
            sub={t("settings.home.rows.deleteAccountSub")}
            danger
            onClick={() => openSupportEmail(
              t("settings.home.rows.deleteAccountRequestSubject", "VYVA account deletion request"),
              t("settings.home.rows.deleteAccountRequestBody", "Please help me delete my VYVA account and all associated data. I understand this is permanent and cannot be undone."),
            )}
            data-testid="button-settings-delete-account"
          />
        </Section>
      </div>
    </PhoneFrame>
  );
}
