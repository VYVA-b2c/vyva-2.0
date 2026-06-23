import React, { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageControllerProvider, LanguageFrameBoundary, useLanguage } from "@/i18n";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { VoiceActionProvider } from "@/contexts/VoiceActionContext";
import { VyvaVoiceProvider } from "@/hooks/useVyvaVoice";
import { recordAgentButtonClick, recordAgentPageChange } from "@/lib/agentAppContext";
import { shouldShowPwaInstallPromptForRoute } from "@/lib/pwaInstallRoutes";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import LoginPage from "@/pages/LoginPage";
import LandingPage from "@/pages/LandingPage";
import InviteLandingPage from "@/pages/InviteLandingPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import AccessLinkPage from "@/pages/AccessLinkPage";
import CareTeamInvitePage from "@/pages/CareTeamInvitePage";
import ProfileSelectPage from "@/pages/ProfileSelectPage";
import AppShell from "./components/AppShell";
import ServiceGateRoute from "./components/ServiceGateRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import OnboardingGuard from "./components/OnboardingGuard";
import HomeScreen from "./pages/HomeScreen";
import ChatScreen from "./pages/ChatScreen";
import HealthScreen from "./pages/HealthScreen";
import MedsScreen from "./pages/MedsScreen";
import AdherenceReportScreen from "./pages/AdherenceReportScreen";
import ActivitiesScreen from "./pages/ActivitiesScreen";
import ActivityScreen from "./pages/ActivityScreen";
import RelaxBreatheScreen from "./pages/RelaxBreatheScreen";
import SpatialNavigator from "./games/SpatialNavigator";
import FaceNameMatch from "./games/FaceNameMatch";
import AttentionBoostersPage from "./games/AttentionBoostersPage";
import ExecutiveFunctionPage from "./games/ExecutiveFunctionPage";
import LanguageGamesPage from "./games/LanguageGamesPage";
import SensesPage from "./games/SensesPage";
import MemoryGamesPage from "./games/memory/MemoryGamesPage";
import MemoryGameRunner from "./games/memory/MemoryGameRunner";
import DualTaskWalk from "./games/DualTaskWalk";
import CategorySort from "./games/CategorySort";
import NumberTrails from "./games/NumberTrails";
import RememberLater from "./games/RememberLater";
import CuriousMinds from "./games/CuriousMinds";
import ScentMemory from "./games/ScentMemory";
import ListenClosely from "./games/ListenClosely";
import BreathGarden from "./games/BreathGarden";
import ConciergeScreen from "./pages/ConciergeScreen";
import ConciergeShoppingScreen from "./pages/ConciergeShoppingScreen";
import SafeHomeScreen from "./pages/SafeHomeScreen";
import ScamGuardScreen from "./pages/ScamGuardScreen";
import SettingsScreen from "./pages/SettingsScreen";
import NotFound from "./pages/NotFound";

import WelcomeScreen from "./pages/onboarding/WelcomeScreen";
import WhoForStep from "./pages/onboarding/WhoForStep";
import BasicsStep from "./pages/onboarding/BasicsStep";
import ChannelStep from "./pages/onboarding/ChannelStep";
import DataConsentStep from "./pages/onboarding/DataConsentStep";
import ActivationStep from "./pages/onboarding/ActivationStep";
import ProfileOverview from "./pages/onboarding/ProfileOverview";
import SectionCompleteScreen from "./pages/onboarding/SectionCompleteScreen";
import ProxySetupStep from "./pages/onboarding/ProxySetupStep";
import ElderConfirmStep from "./pages/onboarding/ElderConfirmStep";
import ElderConfirmByToken from "./pages/onboarding/ElderConfirmByToken";

import GPSection from "./pages/onboarding/sections/GPSection";
import ProvidersSection from "./pages/onboarding/sections/ProvidersSection";
import AddressSection from "./pages/onboarding/sections/AddressSection";
import AllergiesSection from "./pages/onboarding/sections/AllergiesSection";
import BasicsSection from "./pages/onboarding/sections/BasicsSection";
import CareTeamFlow from "./pages/onboarding/sections/CareTeamFlow";
import CognitiveSection from "./pages/onboarding/sections/CognitiveSection";
import ConditionsSection from "./pages/onboarding/sections/ConditionsSection";
import DevicesSection from "./pages/onboarding/sections/DevicesSection";
import DietSection from "./pages/onboarding/sections/DietSection";
import EmergencySection from "./pages/onboarding/sections/EmergencySection";
import HobbiesSection from "./pages/onboarding/sections/HobbiesSection";
import MedicationsSection from "./pages/onboarding/sections/MedicationsSection";

import PrivacySettings from "./pages/settings/PrivacySettings";
import DoctorChoiceScreen from "./pages/DoctorChoiceScreen";
import SymptomCheckScreen from "./pages/SymptomCheckScreen";
import CheckHowIFeelScreen from "./pages/CheckHowIFeelScreen";
import CheckinHistoryScreen from "./pages/CheckinHistoryScreen";
import SharedCheckinReport from "./pages/SharedCheckinReport";
import SignosScreen from "./pages/SignosScreen";
import InformesScreen from "./pages/InformesScreen";
import CompanionsScreen from "./pages/CompanionsScreen";
import HistoryScreen from "./pages/HistoryScreen";
import SubscriptionSettings from "./pages/settings/SubscriptionSettings";
import SettingsHome from "./pages/settings/SettingsHome";
import AccountSettings from "./pages/settings/AccountSettings";
import HealthDevicesSettings from "./pages/settings/HealthDevicesSettings";
import NotificationsSettings from "./pages/settings/NotificationsSettings";
import ScheduledSupportSettings from "./pages/settings/ScheduledSupportSettings";
import CaregiverDashboardPage from "./pages/CaregiverDashboardPage";
import SocialHub from "./social/SocialHub";
import MovementExerciseGuideScreen from "./social/MovementExerciseGuideScreen";
import RoomScreen from "./social/RoomScreen";

const ProxyPendingPage = lazy(() => import("./pages/admin/ProxyPendingPage"));
const LifecycleAdminPage = lazy(() => import("./pages/admin/LifecycleAdminPage"));
const AdminActivityPage = lazy(() => import("./pages/admin/AdminActivityPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const PhoneOnboardingPage = lazy(() => import("./pages/admin/PhoneOnboardingPage"));
const HomeCardsAdminPage = lazy(() => import("./pages/admin/HomeCardsAdminPage"));
const HeroMessagesAdminPage = lazy(() => import("./pages/admin/HeroMessagesAdminPage"));
const VoiceReadinessAdminPage = lazy(() => import("./pages/admin/VoiceReadinessAdminPage"));
const ConciergeSuppliesAdminPage = lazy(() => import("./pages/admin/ConciergeSuppliesAdminPage"));
const CuriousMindsReviewPage = lazy(() => import("./pages/admin/CuriousMindsReviewPage"));

const SECTION_MAP: Record<string, React.ComponentType> = {
  allergies: AllergiesSection,
  basics: BasicsSection,
  gp: GPSection,
  providers: ProvidersSection,
  address: AddressSection,
  "care-team": CareTeamFlow,
  cognitive: CognitiveSection,
  conditions: ConditionsSection,
  health: ConditionsSection,
  devices: DevicesSection,
  diet: DietSection,
  emergency: EmergencySection,
  hobbies: HobbiesSection,
  medications: MedicationsSection,
};

function SectionRouter() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const Section = id ? SECTION_MAP[id] : null;

  if (Section) return <Section />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f3f8] gap-4 px-6 text-center">
      <span className="text-5xl">🚧</span>
      <h2 className="text-xl font-bold text-gray-900">{t("onboarding.sectionFallback.title")}</h2>
      <p className="text-sm text-gray-500">{t("onboarding.sectionFallback.subtitle")}</p>
      <button
        onClick={() => navigate("/onboarding/profile")}
        className="mt-2 px-6 py-3 rounded-full bg-[#6b21a8] text-white text-sm font-semibold"
      >
        {t("onboarding.sectionFallback.back")}
      </button>
    </div>
  );
}

function SpatialNavigatorRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <SpatialNavigator
      userId={user?.id ?? ""}
      onExit={() => navigate("/activities")}
    />
  );
}

function FaceNameMatchRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <FaceNameMatch
      userId={user?.id ?? ""}
      onExit={() => navigate("/memory-games")}
    />
  );
}

function RememberLaterRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <RememberLater
      userId={user?.id ?? ""}
      onExit={() => navigate("/memory-games")}
    />
  );
}

function RememberLaterPreviewRoute() {
  const navigate = useNavigate();

  return (
    <RememberLater
      userId=""
      onExit={() => navigate("/login")}
    />
  );
}

function CuriousMindsRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <CuriousMinds
      userId={user?.id ?? ""}
      onExit={() => navigate("/memory-games")}
    />
  );
}

function CuriousMindsPreviewRoute() {
  const navigate = useNavigate();

  return (
    <CuriousMinds
      userId="dev-user"
      onExit={() => navigate("/login")}
    />
  );
}

function ScentMemoryRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <ScentMemory
      userId={user?.id ?? ""}
      onExit={() => navigate("/senses")}
    />
  );
}

function ListenCloselyRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <ListenClosely
      userId={user?.id ?? ""}
      onExit={() => navigate("/senses")}
    />
  );
}

function BreathGardenRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <BreathGarden
      userId={user?.id ?? ""}
      onExit={() => navigate("/senses")}
    />
  );
}

function ScentMemoryPreviewRoute() {
  const navigate = useNavigate();

  return (
    <ScentMemory
      userId=""
      onExit={() => navigate("/login")}
    />
  );
}

function ListenCloselyPreviewRoute() {
  const navigate = useNavigate();

  return (
    <ListenClosely
      userId=""
      onExit={() => navigate("/login")}
    />
  );
}

function BreathGardenPreviewRoute() {
  const navigate = useNavigate();

  return (
    <BreathGarden
      userId=""
      onExit={() => navigate("/login")}
    />
  );
}

function AdminLoadingScreen({ message = "Loading admin tools" }: { message?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f2eb] px-6 text-center text-[#2f2135]">
      <section className="w-full max-w-md rounded-3xl border border-[#eadfd5] bg-white p-6 shadow-sm">
        <VyvaWordmark className="mx-auto h-auto w-[132px] sm:w-[158px]" />
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.22em] text-purple-700">VYVA Admin</p>
        <h1 className="mt-2 font-serif text-3xl">{message}</h1>
        <p className="mt-2 text-sm text-[#7d6b65]">Preparing the admin workspace.</p>
      </section>
    </main>
  );
}

function AdminErrorScreen({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f2eb] px-6 text-center text-[#2f2135]">
      <section className="w-full max-w-md rounded-3xl border border-[#eadfd5] bg-white p-6 shadow-sm">
        <VyvaWordmark className="mx-auto h-auto w-[132px] sm:w-[158px]" />
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.22em] text-purple-700">VYVA Admin</p>
        <h1 className="mt-2 font-serif text-3xl">Admin page could not load</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#7d6b65]">{message}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl bg-purple-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-800"
          >
            Try again
          </button>
          <a
            href="/admin/lifecycle"
            className="rounded-2xl border border-[#eadfd5] bg-white px-5 py-3 text-sm font-bold text-[#2f2135] transition hover:border-purple-200 hover:text-purple-700"
          >
            Admin menu
          </a>
        </div>
      </section>
    </main>
  );
}

class AdminRouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "The admin page could not load.",
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error("[admin-route]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <AdminErrorScreen message={this.state.message} />;
    }

    return this.props.children;
  }
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();

  if (isLoading) return <AdminLoadingScreen message="Checking admin access" />;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (user.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f2eb] px-6 text-center text-[#2f2135]">
        <section className="max-w-md rounded-3xl border border-[#eadfd5] bg-white p-6 shadow-sm">
          <VyvaWordmark className="mx-auto h-auto w-[132px] sm:w-[158px]" />
          <p className="mt-4 text-sm font-bold uppercase tracking-[0.22em] text-purple-700">VYVA Admin</p>
          <h1 className="mt-2 font-serif text-3xl">Admin access required</h1>
          <p className="mt-2 text-sm text-[#7d6b65]">Your account is signed in, but it does not have the admin role.</p>
          <button
            type="button"
            onClick={logout}
            className="mt-5 rounded-2xl bg-purple-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-800"
          >
            Sign out
          </button>
        </section>
      </main>
    );
  }

  return (
    <AdminRouteErrorBoundary>
      <Suspense fallback={<AdminLoadingScreen />}>
        {children}
      </Suspense>
    </AdminRouteErrorBoundary>
  );
}

function DualTaskWalkRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return <DualTaskWalk userId={user?.id ?? ""} onExit={() => navigate("/attention-boosters")} />;
}

function CategorySortRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return <CategorySort userId={user?.id ?? ""} onExit={() => navigate("/executive-function")} />;
}

function NumberTrailsRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return <NumberTrails userId={user?.id ?? ""} onExit={() => navigate("/executive-function")} />;
}

function RootRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen bg-[#F8F4EF]" />;
  if (!user) return <LandingPage />;

  return (
    <AppShell>
      <HomeScreen />
    </AppShell>
  );
}

function getInteractiveLabel(element: Element): string {
  const explicitLabel =
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.getAttribute("data-testid");

  if (explicitLabel) return explicitLabel;

  return (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function AgentAppContextTracker() {
  const location = useLocation();

  React.useEffect(() => {
    recordAgentPageChange(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const interactiveElement = target?.closest("button,a,[role='button']");
      if (!interactiveElement || interactiveElement.hasAttribute("data-agent-context-ignore")) return;

      const label = getInteractiveLabel(interactiveElement);
      if (!label) return;

      recordAgentButtonClick({
        label,
        path: `${window.location.pathname}${window.location.search}`,
      });
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}

function PwaInstallPromptGate() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading || !shouldShowPwaInstallPromptForRoute(location.pathname, Boolean(user))) return null;
  return <PwaInstallPrompt />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageControllerProvider>
      <AuthProvider>
        <ProfileProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <LanguageFrameBoundary>
                <VyvaVoiceProvider>
                  <VoiceActionProvider>
                    <AgentAppContextTracker />
                    <Routes>
                <Route path="/" element={<RootRoute />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/invite" element={<InviteLandingPage />} />
                <Route path="/admin/login" element={<LoginPage adminOnly />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/access/:token" element={<AccessLinkPage />} />
                <Route path="/care-team/invite/:token" element={<CareTeamInvitePage />} />
                <Route path="/confirm/:token" element={<ElderConfirmByToken />} />
                <Route path="/shared/check-in/:token" element={<SharedCheckinReport />} />
                {import.meta.env.DEV ? (
                  <Route path="/dev/remember-later" element={<RememberLaterPreviewRoute />} />
                ) : null}
                {import.meta.env.DEV ? (
                  <Route path="/dev/curious-minds" element={<CuriousMindsPreviewRoute />} />
                ) : null}
                {import.meta.env.DEV ? (
                  <Route path="/dev/scent-memory" element={<ScentMemoryPreviewRoute />} />
                ) : null}
                {import.meta.env.DEV ? (
                  <Route path="/dev/listen-closely" element={<ListenCloselyPreviewRoute />} />
                ) : null}
                {import.meta.env.DEV ? (
                  <Route path="/dev/breath-garden" element={<BreathGardenPreviewRoute />} />
                ) : null}
                <Route path="/admin/proxy-pending" element={<AdminRoute><ProxyPendingPage /></AdminRoute>} />
                <Route path="/admin/lifecycle" element={<AdminRoute><LifecycleAdminPage /></AdminRoute>} />
                <Route path="/admin/activity" element={<AdminRoute><AdminActivityPage /></AdminRoute>} />
                <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
                <Route path="/admin/phone-onboarding" element={<AdminRoute><PhoneOnboardingPage /></AdminRoute>} />
                <Route path="/admin/home-cards" element={<AdminRoute><HomeCardsAdminPage /></AdminRoute>} />
                <Route path="/admin/hero-messages" element={<AdminRoute><HeroMessagesAdminPage /></AdminRoute>} />
                <Route path="/admin/voice-readiness" element={<AdminRoute><VoiceReadinessAdminPage /></AdminRoute>} />
                <Route path="/admin/concierge-supplies" element={<AdminRoute><ConciergeSuppliesAdminPage /></AdminRoute>} />
                <Route path="/admin/curious-minds" element={<AdminRoute><CuriousMindsReviewPage /></AdminRoute>} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/profiles/select" element={<ProfileSelectPage />} />
                  <Route element={<OnboardingGuard />}>
                    <Route path="/onboarding" element={<WelcomeScreen />} />
                    <Route path="/onboarding/who-for" element={<WhoForStep />} />
                    <Route path="/onboarding/basics" element={<BasicsStep />} />
                    <Route path="/onboarding/channel" element={<ChannelStep />} />
                    <Route path="/onboarding/proxy-setup" element={<ProxySetupStep />} />
                    <Route path="/onboarding/elder-confirm" element={<ElderConfirmStep />} />
                    <Route path="/onboarding/consent" element={<DataConsentStep />} />
                  </Route>
                  <Route path="/onboarding/activation" element={<ActivationStep />} />
                  <Route path="/onboarding/profile" element={<ProfileOverview />} />
                  <Route path="/onboarding/complete/:section" element={<SectionCompleteScreen />} />
                  <Route path="/onboarding/profile/:id" element={<SectionRouter />} />
                  <Route path="/onboarding/careteam" element={<CareTeamFlow />} />
                  <Route path="/settings/privacy" element={<PrivacySettings />} />
                  <Route path="/settings/subscription" element={<AppShell><SubscriptionSettings /></AppShell>} />
                  <Route path="/settings" element={<AppShell><SettingsHome /></AppShell>} />
                  <Route path="/settings/account" element={<AppShell><AccountSettings /></AppShell>} />
                  <Route path="/settings/health-devices" element={<AppShell><HealthDevicesSettings /></AppShell>} />
                  <Route path="/settings/notifications" element={<AppShell><NotificationsSettings /></AppShell>} />
                  <Route path="/settings/scheduled-support" element={<AppShell><ScheduledSupportSettings /></AppShell>} />
                  <Route path="/chat" element={<AppShell><ServiceGateRoute service="chat"><ChatScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/health" element={<AppShell><HealthScreen /></AppShell>} />
                  <Route path="/health/doctor" element={<AppShell><ServiceGateRoute service="doctor"><DoctorChoiceScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/health/check-in" element={<AppShell><CheckHowIFeelScreen /></AppShell>} />
                  <Route path="/health/check-ins" element={<AppShell><CheckinHistoryScreen /></AppShell>} />
                  <Route path="/health/symptom-check" element={<AppShell><ServiceGateRoute service="symptomCheck"><SymptomCheckScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/health/vitals" element={<AppShell><SignosScreen /></AppShell>} />
                  <Route path="/informes" element={<AppShell><InformesScreen /></AppShell>} />
                  <Route path="/informes/:id" element={<AppShell><InformesScreen /></AppShell>} />
                  <Route path="/companions" element={<AppShell><CompanionsScreen /></AppShell>} />
                  <Route path="/caregiver" element={<ServiceGateRoute service="caregiverDashboard"><CaregiverDashboardPage /></ServiceGateRoute>} />
                  <Route path="/caregiver-dashboard" element={<ServiceGateRoute service="caregiverDashboard"><CaregiverDashboardPage /></ServiceGateRoute>} />
                  <Route path="/social-rooms" element={<AppShell><SocialHub /></AppShell>} />
                  <Route path="/social-rooms/morning-movement/exercises/:exerciseId" element={<AppShell><MovementExerciseGuideScreen /></AppShell>} />
                  <Route path="/social-rooms/:slug" element={<AppShell><RoomScreen /></AppShell>} />
                  <Route path="/meds" element={<AppShell><ServiceGateRoute service="medications"><MedsScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/meds/adherence-report" element={<AppShell><ServiceGateRoute service="adherenceReport"><AdherenceReportScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/activities" element={<AppShell><ActivitiesScreen /></AppShell>} />
                  <Route path="/activities/relax-breathe" element={<AppShell><RelaxBreatheScreen /></AppShell>} />
                  <Route path="/activity" element={<AppShell><ActivityScreen /></AppShell>} />
                  <Route path="/attention-boosters" element={<AppShell><AttentionBoostersPage /></AppShell>} />
                  <Route path="/attention-boosters/rhythm-tap" element={<AppShell><MemoryGameRunner forcedGameType="sequence_memory" returnPath="/attention-boosters" /></AppShell>} />
                  <Route path="/senses" element={<AppShell><SensesPage /></AppShell>} />
                  <Route path="/senses/association" element={<AppShell><MemoryGameRunner forcedGameType="association_memory" returnPath="/senses" /></AppShell>} />
                  <Route path="/senses/scent-memory" element={<ScentMemoryRoute />} />
                  <Route path="/senses/listen-closely" element={<ListenCloselyRoute />} />
                  <Route path="/senses/breath-garden" element={<BreathGardenRoute />} />
                  <Route path="/executive-function" element={<AppShell><ExecutiveFunctionPage /></AppShell>} />
                  <Route path="/executive-function/category-sort" element={<CategorySortRoute />} />
                  <Route path="/executive-function/number-trails" element={<NumberTrailsRoute />} />
                  <Route path="/language" element={<AppShell><LanguageGamesPage /></AppShell>} />
                  <Route path="/spatial-navigator" element={<AppShell><SpatialNavigatorRoute /></AppShell>} />
                  <Route path="/face-name-match" element={<AppShell><FaceNameMatchRoute /></AppShell>} />
                  <Route path="/memory-games" element={<AppShell><MemoryGamesPage /></AppShell>} />
                  <Route path="/memory-games/remember-later" element={<AppShell><RememberLaterRoute /></AppShell>} />
                  <Route path="/memory-games/curious-minds" element={<AppShell><CuriousMindsRoute /></AppShell>} />
                  <Route path="/memory-games/:gameType" element={<AppShell><MemoryGameRunner /></AppShell>} />
                  <Route path="/dual-task-walk" element={<DualTaskWalkRoute />} />
                  <Route path="/concierge" element={<AppShell><ServiceGateRoute service="concierge"><ConciergeScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/concierge/shopping" element={<AppShell><ServiceGateRoute service="concierge"><ConciergeShoppingScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/safe-home" element={<AppShell><SafeHomeScreen /></AppShell>} />
                  <Route path="/scam-guard" element={<AppShell><ScamGuardScreen /></AppShell>} />
                  <Route path="/history" element={<AppShell><HistoryScreen /></AppShell>} />
                </Route>
                <Route path="*" element={<NotFound />} />
                    </Routes>
                    <PwaInstallPromptGate />
                  </VoiceActionProvider>
                </VyvaVoiceProvider>
              </LanguageFrameBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </ProfileProvider>
      </AuthProvider>
    </LanguageControllerProvider>
  </QueryClientProvider>
);

export default App;
