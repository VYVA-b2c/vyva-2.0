import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  HeartHandshake,
  Home,
  MessageCircle,
  Pill,
  Send,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/queryClient";
import { VYVA_UI_COPY, textHasBannedVyvaUiTerm } from "@/lib/vyva-ui-copy";

type DemoInsight = {
  id: string;
  type: string;
  domain: string;
  title: string;
  summary: string;
  severity: "POSITIVE" | "NEUTRAL" | "WATCH" | "ATTENTION";
  confidence: number;
  evidenceSummary?: string | null;
  createdAt?: string;
};

type DemoRecommendation = {
  id: string;
  domain: string;
  title: string;
  body: string;
  actionType: string;
};

type DemoAlert = {
  id: string;
  type: string;
  severity: "INFO" | "ATTENTION" | "URGENT";
  message: string;
  status: "OPEN" | "REVIEWED";
  createdAt: string;
};

type SeniorHomeResponse = {
  senior: {
    id: string;
    key: string;
    name: string;
    firstName: string;
    caregiverName: string;
    consentCaregiverAlerts: boolean;
    consentShareDetails: boolean;
  };
  today: string;
  overview: {
    lastCheckIn: string;
    latestInsight: DemoInsight | null;
    latestRecommendation: DemoRecommendation | null;
    openAlertCount: number;
    moodStatus: string;
    socialStatus: string;
    routineStatus: string;
    medicationStatus: string;
    routineSummary: string;
  };
};

type WeeklyQuestion = {
  id: string;
  domain: string;
  questionText: string;
  answerType: string;
  options: string[] | null;
  reason: string;
};

type WeeklyStartResponse = {
  weekNumber: number;
  questions: WeeklyQuestion[];
};

type MyWeekResponse = {
  steady: DemoInsight[];
  changed: DemoInsight[];
  recommendations: DemoRecommendation[];
  shareEnabled: boolean;
};

type CaregiverDashboardResponse = {
  caregiver: { id: string; key: string; name: string };
  summary: {
    seniorsMonitored: number;
    checkInsThisWeek: number;
    openAlerts: number;
    medicationConfirmations: string;
  };
  seniors: Array<{
    id: string;
    name: string;
    firstName: string;
    lastCheckIn: string;
    moodStatus: string;
    socialStatus: string;
    routineStatus: string;
    medicationStatus: string;
    openAlertCount: number;
    consentCaregiverAlerts: boolean;
    consentShareDetails: boolean;
  }>;
};

type CaregiverDetailResponse = {
  senior: {
    id: string;
    name: string;
    firstName: string;
    consentCaregiverAlerts: boolean;
    consentShareDetails: boolean;
    canViewPrivateDetails: boolean;
  };
  overview: SeniorHomeResponse["overview"];
  insights: DemoInsight[];
  recommendations: DemoRecommendation[];
  checkIns: Array<{
    id: string;
    type: string;
    date: string;
    status: string;
    answers: Array<{ question: string; answer: string }>;
  }>;
  medications: Array<{
    id: string;
    name: string;
    doseLabel: string;
    scheduledTime: string;
    events: Array<{ id: string; status: string; scheduledFor: string }>;
  }>;
  routineEvents: Array<{
    id: string;
    status: string;
    scheduledFor: string;
    routine: { label: string };
  }>;
  alerts: DemoAlert[];
  notes: Array<{ id: string; note: string; concernTag: string | null; createdAt: string; caregiver: { name: string } }>;
  consentMessage: string | null;
};

type AnswerDraft = Record<string, { answerText?: string | null; answerValue?: number | null }>;

const seniorDailyQuestions = [
  { questionId: "daily_mood", label: "How are you feeling today?" },
  { questionId: "daily_sleep_quality", label: "How did you sleep?" },
  { questionId: "daily_social_connection", label: "Did you have a real conversation with someone today?" },
  { questionId: "FOOD-01", label: "Did you eat and drink water today?" },
  { questionId: "CORE-03", label: "Anything you want VYVA to remember?" },
];

const fallbackOptions: Record<string, string[]> = {
  SCALE_CHANGE: ["Better than usual", "About the same", "A little worse than usual", "Much worse than usual", "Not sure"],
  SCALE_FREQUENCY: ["Not this week", "Once or twice", "Several times", "Most days", "Not sure"],
  SCALE_DIFFICULTY: ["Easy", "A little difficult", "Very difficult", "I could not do it", "Not applicable"],
  SCALE_SOCIAL: ["Yes, meaningful conversation", "A short exchange only", "Not really", "I avoided contact", "Not sure"],
  ACTION_PREFERENCE: ["Yes, please", "Maybe later", "No, thank you", "I want to tell my caregiver", "I want help now"],
  YES_NO: ["Yes", "No", "Not sure"],
};

const confidenceLabel = (value: number) => (value >= 0.75 ? "Based on several recent check-ins" : "Based on recent check-ins");
const caregiverConfidenceLabel = (value: number) => (value >= 0.75 ? "High confidence" : "Moderate confidence");

async function jsonRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(url, options);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function useDemoQuery<T>(url: string) {
  return useQuery<T>({ queryKey: [url] });
}

function statusTone(status: string) {
  if (status === "Attention recommended" || status === "Follow-up may help") return "border-[#f2b7a4] bg-[#fff5f0] text-[#963f2f]";
  if (status === "Change from usual pattern") return "border-[#f0d28c] bg-[#fff9e8] text-[#7a5a12]";
  return "border-[#b9dfcf] bg-[#f0faf5] text-[#27624b]";
}

function severityClass(severity: string) {
  if (severity === "ATTENTION" || severity === "URGENT") return "bg-[#fff0ec] text-[#9b3324] border-[#f2b7a4]";
  if (severity === "WATCH") return "bg-[#fff8e8] text-[#7a5a12] border-[#f0d28c]";
  return "bg-[#eef8f4] text-[#27624b] border-[#b9dfcf]";
}

function concernStatus(severity: string) {
  if (severity === "ATTENTION" || severity === "URGENT") return "Attention recommended";
  if (severity === "WATCH") return "Change noticed";
  if (severity === "NEUTRAL") return "No clear change";
  return "Steady";
}

function DemoShell({ children, tone = "senior" }: { children: React.ReactNode; tone?: "senior" | "caregiver" }) {
  return (
    <main className={tone === "senior" ? "min-h-screen bg-[#f7f3ee] text-[#2c2430]" : "min-h-screen bg-[#f4f6f8] text-[#25303a]"}>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}

function LoadingBlock({ label = "Loading VYVA demo" }: { label?: string }) {
  return (
    <DemoShell>
      <div className="grid flex-1 place-items-center text-center">
        <div>
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-[#8767c8] border-t-transparent" />
          <p className="text-lg font-semibold">{label}</p>
        </div>
      </div>
    </DemoShell>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <DemoShell>
      <div className="grid flex-1 place-items-center text-center">
        <Card className="max-w-md border-[#efd3cb] bg-white">
          <CardContent className="p-6">
            <AlertTriangle className="mx-auto mb-3 text-[#a84834]" />
            <h1 className="text-2xl font-bold">VYVA demo needs a quick reset</h1>
            <p className="mt-2 text-[#695f68]">{message}</p>
          </CardContent>
        </Card>
      </div>
    </DemoShell>
  );
}

function SafetyFooter() {
  return (
    <div className="mt-5 rounded-xl border border-[#ded6cc] bg-white/80 p-4 text-sm leading-6 text-[#615a64]">
      <p>{VYVA_UI_COPY.disclaimers.wellbeing}</p>
      <p>{VYVA_UI_COPY.disclaimers.medication}</p>
      <p>{VYVA_UI_COPY.disclaimers.emergency}</p>
    </div>
  );
}

function TopNav({ label, backTo }: { label: string; backTo?: string }) {
  return (
    <div className="mb-5 flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {backTo ? (
          <Button asChild variant="ghost" className="h-11 w-11 rounded-full p-0" aria-label="Back">
            <Link to={backTo}>
              <ArrowLeft />
            </Link>
          </Button>
        ) : null}
        <Link to="/vyva-demo" className="text-xl font-bold tracking-tight text-[#4c327e]">
          {VYVA_UI_COPY.appName}
        </Link>
      </div>
      <span className="max-w-[52vw] truncate rounded-full border border-[#ddd1e9] bg-white px-3 py-1 text-right text-sm font-semibold text-[#5e4f6e]">{label}</span>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  body,
  to,
  buttonLabel,
  onClick,
}: {
  icon: typeof ClipboardList;
  title: string;
  body: string;
  to?: string;
  buttonLabel: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eee6fa] text-[#6847a8]">
        <Icon size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-xl font-bold text-[#2c2430]">{title}</h3>
        <p className="mt-1 text-base leading-6 text-[#615a64]">{body}</p>
      </div>
      <div className="flex items-center gap-2 text-sm font-bold text-[#6847a8]">
        {buttonLabel}
        <ChevronRight size={18} />
      </div>
    </>
  );

  return (
    <Card className="border-[#e5ded5] bg-white shadow-sm">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        {to ? (
          <Link to={to} className="contents">
            {content}
          </Link>
        ) : (
          <button type="button" onClick={onClick} className="contents text-left">
            {content}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export default function VyvaDemoEntry() {
  return (
    <DemoShell>
      <div className="grid flex-1 place-items-center">
        <section className="w-full max-w-2xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#4c327e] text-white">
            <HeartHandshake size={32} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">VYVA MVP demo</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-[#615a64]">
            Choose a demo path to see the weekly check-in, My Week insights, small steps, and caregiver follow-up.
          </p>
          <div className="mt-8 grid gap-3">
            <Button asChild className="h-auto rounded-xl bg-[#4c327e] px-6 py-5 text-lg text-white hover:bg-[#3d2865]">
              <Link to="/vyva-demo/senior/maria">{VYVA_UI_COPY.demoLogin.maria}</Link>
            </Button>
            <Button asChild className="h-auto rounded-xl bg-[#2f6f73] px-6 py-5 text-lg text-white hover:bg-[#25595c]">
              <Link to="/vyva-demo/senior/john">{VYVA_UI_COPY.demoLogin.john}</Link>
            </Button>
            <Button asChild variant="outline" className="h-auto rounded-xl border-[#c9bed8] bg-white px-6 py-5 text-lg text-[#4c327e]">
              <Link to="/vyva-demo/caregiver/ana">{VYVA_UI_COPY.demoLogin.ana}</Link>
            </Button>
          </div>
          <SafetyFooter />
        </section>
      </div>
    </DemoShell>
  );
}

export function VyvaSeniorHome() {
  const { seniorKey = "maria" } = useParams();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useDemoQuery<SeniorHomeResponse>(`/api/vyva-demo/senior/${seniorKey}/home`);
  const helpMutation = useMutation({
    mutationFn: () => jsonRequest(`/api/vyva-demo/senior/${seniorKey}/ask-help`, { method: "POST", body: "{}" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/vyva-demo/senior/${seniorKey}/home`] }),
  });
  const consentMutation = useMutation({
    mutationFn: (value: boolean) =>
      jsonRequest(`/api/vyva-demo/senior/${seniorKey}/consent`, { method: "PATCH", body: JSON.stringify({ value }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/vyva-demo/senior/${seniorKey}/home`] }),
  });

  if (isLoading) return <LoadingBlock label="Loading senior home" />;
  if (error || !data) return <ErrorBlock message="Run npm run db:seed, then reload the VYVA demo." />;

  return (
    <DemoShell>
      <TopNav label="Senior demo" backTo="/vyva-demo" />
      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-lg font-semibold text-[#746a73]">{data.today}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">{VYVA_UI_COPY.seniorHome.greeting(data.senior.firstName)}</h1>
          <p className="mt-4 max-w-2xl text-xl leading-8 text-[#615a64]">Let's check how your week is going. One small step can make tomorrow easier.</p>
        </div>
        <Card className="border-[#d6eadf] bg-[#f0faf5]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-[#27624b]" />
              <h2 className="text-xl font-bold">Wellbeing pattern</h2>
            </div>
            <p className="mt-3 text-lg text-[#315949]">{data.overview.latestInsight?.title ?? "Things look steady this week"}</p>
            <p className="mt-2 text-sm text-[#4d675b]">{data.overview.latestInsight?.summary ?? "VYVA will keep learning from your check-ins."}</p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-4">
        <ActionCard icon={CalendarDays} title={VYVA_UI_COPY.seniorHome.dailyCheckIn} body="A short daily note about mood, sleep, food, water, and connection." to={`/vyva-demo/senior/${seniorKey}/daily`} buttonLabel="Start" />
        <ActionCard icon={ClipboardList} title={VYVA_UI_COPY.seniorHome.weeklyCheckIn} body="A calm weekly check-in that helps VYVA notice what is steady and what changed." to={`/vyva-demo/senior/${seniorKey}/weekly`} buttonLabel="Begin" />
        <ActionCard icon={Pill} title={VYVA_UI_COPY.seniorHome.medicationRoutine} body={`${data.overview.medicationStatus}. ${data.overview.routineSummary}.`} to={`/vyva-demo/senior/${seniorKey}/my-week`} buttonLabel="View" />
        <ActionCard icon={CheckCircle2} title={VYVA_UI_COPY.seniorHome.smallStep} body={data.overview.latestRecommendation?.title ?? "Keep the steady routine going"} to={`/vyva-demo/senior/${seniorKey}/my-week`} buttonLabel="Open" />
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <label className="flex items-center justify-between gap-4 rounded-xl border border-[#e1d9d2] bg-white p-4 text-left">
          <span>
            <span className="block text-base font-bold">Share wellbeing summaries with {data.senior.caregiverName}</span>
            <span className="block text-sm text-[#615a64]">You can change this for the demo at any time.</span>
          </span>
          <input
            type="checkbox"
            className="h-6 w-6 accent-[#4c327e]"
            checked={data.senior.consentCaregiverAlerts}
            onChange={(event) => consentMutation.mutate(event.target.checked)}
          />
        </label>
        <Button
          className="h-auto rounded-xl bg-[#a63c2f] px-6 py-4 text-lg text-white hover:bg-[#873126]"
          onClick={() => helpMutation.mutate()}
        >
          <Bell />
          {VYVA_UI_COPY.seniorHome.askForHelp}
        </Button>
      </section>
      {helpMutation.isSuccess ? <p className="mt-3 rounded-xl bg-[#fff0ec] p-4 font-semibold text-[#9b3324]">Ana can now see a minimal help alert.</p> : null}
      <SafetyFooter />
    </DemoShell>
  );
}

export function VyvaSeniorDailyCheckIn() {
  const { seniorKey = "maria" } = useParams();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [complete, setComplete] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      jsonRequest(`/api/vyva-demo/senior/${seniorKey}/daily/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: seniorDailyQuestions.map((question) => ({
            questionId: question.questionId,
            answerText: answers[question.questionId] ?? "About the same",
          })),
        }),
      }),
    onSuccess: () => setComplete(true),
  });

  if (complete) {
    return (
      <DemoShell>
        <TopNav label="Daily Check-In" backTo={`/vyva-demo/senior/${seniorKey}`} />
        <div className="grid flex-1 place-items-center">
          <Card className="max-w-lg border-[#d6eadf] bg-white">
            <CardContent className="p-7 text-center">
              <CheckCircle2 className="mx-auto mb-4 text-[#2f7b5f]" size={44} />
              <h1 className="text-3xl font-bold">Thank you. Your daily check-in is complete.</h1>
              <p className="mt-3 text-lg text-[#615a64]">VYVA will keep using these notes to understand your usual pattern.</p>
              <Button className="mt-6 rounded-xl bg-[#4c327e] px-6 py-5 text-lg text-white" onClick={() => navigate(`/vyva-demo/senior/${seniorKey}`)}>
                Back home
              </Button>
            </CardContent>
          </Card>
        </div>
      </DemoShell>
    );
  }

  return (
    <DemoShell>
      <TopNav label="Daily Check-In" backTo={`/vyva-demo/senior/${seniorKey}`} />
      <section className="mx-auto w-full max-w-2xl">
        <h1 className="text-4xl font-bold">A short daily check-in</h1>
        <div className="mt-6 grid gap-4">
          {seniorDailyQuestions.map((question) => (
            <label key={question.questionId} className="block rounded-xl border border-[#e5ded5] bg-white p-5">
              <span className="text-lg font-bold">{question.label}</span>
              <Textarea
                className="mt-3 min-h-24 rounded-xl text-base"
                placeholder="Type a few words, or leave a short voice-note placeholder."
                value={answers[question.questionId] ?? ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.questionId]: event.target.value }))}
              />
            </label>
          ))}
        </div>
        <Button className="mt-5 h-auto w-full rounded-xl bg-[#4c327e] px-6 py-5 text-lg text-white" onClick={() => mutation.mutate()}>
          Save daily check-in
        </Button>
      </section>
    </DemoShell>
  );
}

export function VyvaSeniorWeeklyCheckIn() {
  const { seniorKey = "maria" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerDraft>({});
  const [complete, setComplete] = useState<MyWeekResponse | null>(null);
  const { data, isLoading, error } = useDemoQuery<WeeklyStartResponse>(`/api/vyva-demo/senior/${seniorKey}/weekly/start`);
  const mutation = useMutation({
    mutationFn: () =>
      jsonRequest<{ myWeek: MyWeekResponse }>(`/api/vyva-demo/senior/${seniorKey}/weekly/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, ...answer })),
          selectedReasons: Object.fromEntries((data?.questions ?? []).map((question) => [question.id, question.reason])),
        }),
      }),
    onSuccess: (result) => {
      setComplete(result.myWeek);
      queryClient.invalidateQueries({ queryKey: [`/api/vyva-demo/senior/${seniorKey}/home`] });
      queryClient.invalidateQueries({ queryKey: [`/api/vyva-demo/senior/${seniorKey}/my-week`] });
    },
  });

  if (isLoading) return <LoadingBlock label="Preparing weekly check-in" />;
  if (error || !data || data.questions.length === 0) return <ErrorBlock message="Weekly questions are not available. Run the database seed first." />;

  if (!started) {
    return (
      <DemoShell>
        <TopNav label="Weekly Check-In" backTo={`/vyva-demo/senior/${seniorKey}`} />
        <div className="grid flex-1 place-items-center">
          <section className="max-w-2xl text-center">
            <ClipboardList className="mx-auto mb-5 text-[#4c327e]" size={52} />
            <h1 className="text-4xl font-bold">{VYVA_UI_COPY.weekly.introTitle}</h1>
            <p className="mt-4 text-xl leading-8 text-[#615a64]">{VYVA_UI_COPY.weekly.introBody}</p>
            <Button className="mt-8 h-auto rounded-xl bg-[#4c327e] px-8 py-5 text-lg text-white" onClick={() => setStarted(true)}>
              Start weekly check-in
            </Button>
          </section>
        </div>
      </DemoShell>
    );
  }

  if (complete) {
    const smallStep = complete.recommendations[0];
    return (
      <DemoShell>
        <TopNav label="Weekly Check-In" backTo={`/vyva-demo/senior/${seniorKey}`} />
        <div className="grid flex-1 place-items-center">
          <Card className="max-w-xl border-[#d6eadf] bg-white">
            <CardContent className="p-7 text-center">
              <CheckCircle2 className="mx-auto mb-4 text-[#2f7b5f]" size={48} />
              <h1 className="text-3xl font-bold">{VYVA_UI_COPY.weekly.completeTitle}</h1>
              <p className="mt-3 text-lg text-[#615a64]">{VYVA_UI_COPY.weekly.completeBody}</p>
              {smallStep ? (
                <div className="mt-5 rounded-xl bg-[#f0faf5] p-4 text-left">
                  <p className="text-sm font-bold uppercase tracking-wide text-[#2f7b5f]">Small Step</p>
                  <p className="mt-1 text-xl font-bold">{smallStep.title}</p>
                  <p className="mt-1 text-[#52645d]">{smallStep.body}</p>
                </div>
              ) : null}
              <Button className="mt-6 h-auto rounded-xl bg-[#4c327e] px-7 py-5 text-lg text-white" onClick={() => navigate(`/vyva-demo/senior/${seniorKey}/my-week`)}>
                {VYVA_UI_COPY.weekly.viewMyWeek}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DemoShell>
    );
  }

  const question = data.questions[index];
  const optionList = Array.isArray(question.options) ? question.options : fallbackOptions[question.answerType] ?? [];
  const isNarrative = optionList.length === 0 || ["FREE_TEXT", "TASK_STORY", "TASK_PLANNING", "TASK_PROSPECTIVE", "TASK_FLUENCY"].includes(question.answerType);
  const currentAnswer = answers[question.id]?.answerText ?? "";
  const canMoveNext = Boolean(currentAnswer.trim());
  const isLast = index === data.questions.length - 1;

  return (
    <DemoShell>
      <TopNav label="Weekly Check-In" backTo={`/vyva-demo/senior/${seniorKey}`} />
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="mb-5">
          <p className="font-bold text-[#6847a8]">{VYVA_UI_COPY.weekly.progress(index + 1, data.questions.length)}</p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[#6847a8]" style={{ width: `${((index + 1) / data.questions.length) * 100}%` }} />
          </div>
        </div>
        <Card className="flex-1 border-[#e5ded5] bg-white">
          <CardContent className="flex min-h-[420px] flex-col p-6 sm:p-8">
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{question.questionText}</h1>
            <p className="mt-3 text-base text-[#746a73]">You can answer in your own words. There are no scores shown here.</p>
            {isNarrative ? (
              <Textarea
                className="mt-6 min-h-44 rounded-xl text-lg"
                placeholder="Type a note, or record a voice note later."
                value={currentAnswer}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: { answerText: event.target.value } }))}
              />
            ) : (
              <div className="mt-6 grid gap-3">
                {optionList.map((option) => {
                  const selected = currentAnswer === option;
                  return (
                    <button
                      type="button"
                      key={option}
                      className={selected ? "rounded-xl border-2 border-[#4c327e] bg-[#f1ebfb] px-5 py-4 text-left text-lg font-bold text-[#34214f]" : "rounded-xl border border-[#e4dcd4] bg-[#fbfaf8] px-5 py-4 text-left text-lg font-semibold text-[#2c2430]"}
                      onClick={() => setAnswers((current) => ({ ...current, [question.id]: { answerText: option } }))}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-auto flex gap-3 pt-6">
              <Button variant="outline" className="h-auto flex-1 rounded-xl px-5 py-4 text-base" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
                Back
              </Button>
              <Button
                className="h-auto flex-1 rounded-xl bg-[#4c327e] px-5 py-4 text-base text-white"
                disabled={!canMoveNext || mutation.isPending}
                onClick={() => {
                  if (!isLast) setIndex((value) => value + 1);
                  else mutation.mutate();
                }}
              >
                {isLast ? "Complete" : "Next"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </DemoShell>
  );
}

function InsightList({ insights, emptyLabel }: { insights: DemoInsight[]; emptyLabel: string }) {
  if (!insights.length) return <p className="rounded-xl border border-[#e4dcd4] bg-white p-4 text-[#615a64]">{emptyLabel}</p>;

  return (
    <div className="grid gap-3">
      {insights.map((insight) => (
        <Card key={insight.id} className="border-[#e4dcd4] bg-white">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold">{insight.title}</h3>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${severityClass(insight.severity)}`}>{concernStatus(insight.severity)}</span>
            </div>
            <p className="mt-2 text-base leading-7 text-[#615a64]">{insight.summary}</p>
            <p className="mt-3 text-sm font-semibold text-[#6b5b7d]">{confidenceLabel(insight.confidence)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function VyvaSeniorMyWeek() {
  const { seniorKey = "maria" } = useParams();
  const { data, isLoading, error } = useDemoQuery<MyWeekResponse>(`/api/vyva-demo/senior/${seniorKey}/my-week`);

  if (isLoading) return <LoadingBlock label="Loading My Week" />;
  if (error || !data) return <ErrorBlock message="My Week is not available yet." />;

  return (
    <DemoShell>
      <TopNav label="My Week" backTo={`/vyva-demo/senior/${seniorKey}`} />
      <section className="mx-auto w-full max-w-4xl">
        <h1 className="text-4xl font-bold">{VYVA_UI_COPY.myWeek.title}</h1>
        <p className="mt-3 text-lg text-[#615a64]">A calm summary of recent wellbeing patterns. No scores are shown.</p>
        <div className="mt-6 grid gap-6">
          <section>
            <h2 className="mb-3 text-2xl font-bold">{VYVA_UI_COPY.myWeek.steady}</h2>
            <InsightList insights={data.steady} emptyLabel="VYVA is still learning what looks steady this week." />
          </section>
          <section>
            <h2 className="mb-3 text-2xl font-bold">{VYVA_UI_COPY.myWeek.changed}</h2>
            <InsightList insights={data.changed} emptyLabel="No clear change from your usual pattern right now." />
          </section>
          <section>
            <h2 className="mb-3 text-2xl font-bold">{VYVA_UI_COPY.myWeek.smallStep}</h2>
            <div className="grid gap-3">
              {data.recommendations.map((recommendation) => (
                <Card key={recommendation.id} className="border-[#d6eadf] bg-[#f0faf5]">
                  <CardContent className="p-5">
                    <h3 className="text-xl font-bold text-[#27624b]">{recommendation.title}</h3>
                    <p className="mt-2 text-[#52645d]">{recommendation.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-[#ddd1e9] bg-white p-5">
            <h2 className="text-xl font-bold">{VYVA_UI_COPY.myWeek.share}</h2>
            <p className="mt-2 text-[#615a64]">{data.shareEnabled ? "Sharing summaries with Ana is enabled." : VYVA_UI_COPY.caregiver.consentOff}</p>
          </section>
        </div>
      </section>
    </DemoShell>
  );
}

export function VyvaCaregiverDashboard() {
  const { caregiverKey = "ana" } = useParams();
  const { data, isLoading, error } = useDemoQuery<CaregiverDashboardResponse>(`/api/vyva-demo/caregiver/${caregiverKey}/dashboard`);

  if (isLoading) return <LoadingBlock label="Loading caregiver dashboard" />;
  if (error || !data) return <ErrorBlock message="Caregiver dashboard is not available. Run the database seed first." />;

  return (
    <DemoShell tone="caregiver">
      <TopNav label="Caregiver demo" backTo="/vyva-demo" />
      <section>
        <h1 className="text-4xl font-bold">{VYVA_UI_COPY.caregiver.dashboardTitle}</h1>
        <p className="mt-2 text-lg text-[#5d6873]">Welcome, {data.caregiver.name}. Here are the demo wellbeing summaries you can review.</p>
      </section>
      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        <DashboardMetric label={VYVA_UI_COPY.caregiver.seniorsMonitored} value={String(data.summary.seniorsMonitored)} icon={Users} />
        <DashboardMetric label={VYVA_UI_COPY.caregiver.checkInsThisWeek} value={String(data.summary.checkInsThisWeek)} icon={ClipboardList} />
        <DashboardMetric label={VYVA_UI_COPY.caregiver.openAlerts} value={String(data.summary.openAlerts)} icon={Bell} />
        <DashboardMetric label={VYVA_UI_COPY.caregiver.medicationConfirmations} value="Recent" icon={Pill} />
      </section>
      <section className="mt-6 grid gap-4">
        {data.seniors.map((senior) => (
          <Link key={senior.id} to={`/vyva-demo/caregiver/${caregiverKey}/senior/${senior.id}`} className="block">
            <Card className="border-[#d8e0e7] bg-white hover:border-[#8aa7bd]">
              <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_2fr_auto] lg:items-center">
                <div>
                  <h2 className="text-2xl font-bold">{senior.name}</h2>
                  <p className="text-sm text-[#5d6873]">Last check-in: {senior.lastCheckIn}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  <StatusPill label="Mood" value={senior.moodStatus} />
                  <StatusPill label="Social" value={senior.socialStatus} />
                  <StatusPill label="Routine" value={senior.routineStatus} />
                  <StatusPill label="Medication" value={senior.medicationStatus} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full border px-3 py-1 text-sm font-bold ${senior.consentCaregiverAlerts ? "border-[#b9dfcf] bg-[#f0faf5] text-[#27624b]" : "border-[#e4c9c1] bg-[#fff5f0] text-[#963f2f]"}`}>
                    {senior.consentCaregiverAlerts ? "Consent enabled" : "Consent off"}
                  </span>
                  <span className="rounded-full bg-[#eef2f6] px-3 py-1 text-sm font-bold">{senior.openAlertCount} open</span>
                  <ChevronRight />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </DemoShell>
  );
}

function DashboardMetric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <Card className="border-[#d8e0e7] bg-white">
      <CardContent className="p-4">
        <Icon className="mb-3 text-[#40687d]" />
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-[#5d6873]">{label}</p>
      </CardContent>
    </Card>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <span className={`rounded-full border px-3 py-2 text-sm font-bold ${statusTone(value)}`}>
      {label}: {value}
    </span>
  );
}

export function VyvaCaregiverSeniorDetail() {
  const { caregiverKey = "ana", seniorId = "" } = useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("Overview");
  const [note, setNote] = useState("");
  const { data, isLoading, error } = useDemoQuery<CaregiverDetailResponse>(`/api/vyva-demo/caregiver/${caregiverKey}/seniors/${seniorId}`);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/vyva-demo/caregiver/${caregiverKey}/seniors/${seniorId}`] });
  const reviewMutation = useMutation({
    mutationFn: (alertId: string) => jsonRequest(`/api/vyva-demo/caregiver/${caregiverKey}/alerts/${alertId}/review`, { method: "PATCH", body: "{}" }),
    onSuccess: invalidate,
  });
  const noteMutation = useMutation({
    mutationFn: () => jsonRequest(`/api/vyva-demo/caregiver/${caregiverKey}/seniors/${seniorId}/notes`, { method: "POST", body: JSON.stringify({ note }) }),
    onSuccess: () => {
      setNote("");
      invalidate();
    },
  });

  if (isLoading) return <LoadingBlock label="Loading senior detail" />;
  if (error || !data) return <ErrorBlock message="Senior detail is not available." />;

  const tabs = ["Overview", "Insights", "Check-ins", "Medication / Routine", "Alerts", "Notes"];

  return (
    <DemoShell tone="caregiver">
      <TopNav label="Caregiver detail" backTo={`/vyva-demo/caregiver/${caregiverKey}`} />
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold">{data.senior.name}</h1>
          <p className="mt-2 text-lg text-[#5d6873]">{data.senior.canViewPrivateDetails ? "Wellbeing summaries and recent evidence are available." : VYVA_UI_COPY.caregiver.consentOff}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              className={tab === item ? "rounded-full bg-[#25303a] px-4 py-2 text-sm font-bold text-white" : "rounded-full border border-[#cfd8df] bg-white px-4 py-2 text-sm font-bold text-[#4a5864]"}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6">
        {tab === "Overview" ? <CaregiverOverview data={data} /> : null}
        {tab === "Insights" ? <CaregiverInsights data={data} /> : null}
        {tab === "Check-ins" ? <CaregiverCheckIns data={data} /> : null}
        {tab === "Medication / Routine" ? <MedicationRoutine data={data} /> : null}
        {tab === "Alerts" ? <CaregiverAlerts data={data} onReview={(id) => reviewMutation.mutate(id)} /> : null}
        {tab === "Notes" ? (
          <CaregiverNotes data={data} note={note} onNoteChange={setNote} onSubmit={() => noteMutation.mutate()} />
        ) : null}
      </section>
    </DemoShell>
  );
}

function CaregiverOverview({ data }: { data: CaregiverDetailResponse }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border-[#d8e0e7] bg-white lg:col-span-2">
        <CardContent className="p-5">
          <h2 className="text-2xl font-bold">Overview</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <StatusPill label="Mood" value={data.overview.moodStatus} />
            <StatusPill label="Social" value={data.overview.socialStatus} />
            <StatusPill label="Routine" value={data.overview.routineStatus} />
            <StatusPill label="Medication" value={data.overview.medicationStatus} />
          </div>
          {data.consentMessage ? <p className="mt-4 rounded-xl bg-[#fff5f0] p-4 font-semibold text-[#963f2f]">{data.consentMessage}</p> : null}
        </CardContent>
      </Card>
      <Card className="border-[#d8e0e7] bg-white">
        <CardContent className="p-5">
          <h2 className="text-2xl font-bold">Follow-up</h2>
          <p className="mt-3 text-[#5d6873]">{data.overview.openAlertCount} open alerts</p>
          <p className="mt-2 text-[#5d6873]">Last check-in: {data.overview.lastCheckIn}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function CaregiverInsights({ data }: { data: CaregiverDetailResponse }) {
  return (
    <div className="grid gap-4">
      {data.insights.map((insight) => {
        const recommendation = data.recommendations.find((item) => item.domain === insight.domain || insight.domain === "combined");
        return (
          <Card key={insight.id} className="border-[#d8e0e7] bg-white">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold">{insight.title}</h2>
                <span className={`rounded-full border px-3 py-1 text-sm font-bold ${severityClass(insight.severity)}`}>{concernStatus(insight.severity)}</span>
              </div>
              <p className="mt-2 text-[#4f5c67]">{insight.summary}</p>
              <p className="mt-3 rounded-xl bg-[#f4f6f8] p-3 text-sm font-semibold text-[#4f5c67]">
                {insight.evidenceSummary ?? VYVA_UI_COPY.caregiver.consentOff}
              </p>
              <p className="mt-3 text-sm font-bold text-[#40687d]">{caregiverConfidenceLabel(insight.confidence)}</p>
              {recommendation ? <p className="mt-2 text-[#4f5c67]">Suggested follow-up: {recommendation.title}.</p> : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CaregiverCheckIns({ data }: { data: CaregiverDetailResponse }) {
  if (!data.senior.canViewPrivateDetails) {
    return <p className="rounded-xl border border-[#e4c9c1] bg-[#fff5f0] p-5 font-semibold text-[#963f2f]">{VYVA_UI_COPY.caregiver.consentOff}</p>;
  }

  return (
    <div className="grid gap-3">
      {data.checkIns.map((checkIn) => (
        <Card key={checkIn.id} className="border-[#d8e0e7] bg-white">
          <CardContent className="p-5">
            <h2 className="text-xl font-bold">{checkIn.type} check-in</h2>
            <p className="text-sm text-[#5d6873]">{checkIn.date}</p>
            <div className="mt-3 grid gap-2">
              {checkIn.answers.map((answer, index) => (
                <p key={`${checkIn.id}-${index}`} className="rounded-lg bg-[#f4f6f8] p-3 text-sm">
                  <strong>{answer.question}</strong>
                  <br />
                  {answer.answer}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MedicationRoutine({ data }: { data: CaregiverDetailResponse }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-[#d8e0e7] bg-white">
        <CardContent className="p-5">
          <h2 className="text-2xl font-bold">Medication reminders</h2>
          <div className="mt-3 grid gap-3">
            {data.medications.map((medication) => (
              <div key={medication.id} className="rounded-xl bg-[#f4f6f8] p-4">
                <p className="font-bold">{medication.name}</p>
                <p className="text-sm text-[#5d6873]">{medication.doseLabel} at {medication.scheduledTime}</p>
                <p className="mt-2 text-sm">Recent confirmations: {medication.events.map((event) => event.status).join(", ")}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="border-[#d8e0e7] bg-white">
        <CardContent className="p-5">
          <h2 className="text-2xl font-bold">Routine</h2>
          <div className="mt-3 grid gap-3">
            {data.routineEvents.map((event) => (
              <div key={event.id} className="rounded-xl bg-[#f4f6f8] p-4">
                <p className="font-bold">{event.routine.label}</p>
                <p className="text-sm text-[#5d6873]">{event.status}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CaregiverAlerts({ data, onReview }: { data: CaregiverDetailResponse; onReview: (id: string) => void }) {
  return (
    <div className="grid gap-3">
      {data.alerts.map((alert) => (
        <Card key={alert.id} className="border-[#d8e0e7] bg-white">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className={`rounded-full border px-3 py-1 text-sm font-bold ${severityClass(alert.severity)}`}>{alert.severity}</span>
              <p className="mt-3 text-lg font-semibold">{alert.message}</p>
              <p className="mt-1 text-sm text-[#5d6873]">Status: {alert.status}</p>
            </div>
            {alert.status === "OPEN" ? (
              <Button className="rounded-xl bg-[#25303a] text-white" onClick={() => onReview(alert.id)}>
                {VYVA_UI_COPY.caregiver.markReviewed}
              </Button>
            ) : (
              <span className="rounded-full bg-[#eef8f4] px-3 py-1 text-sm font-bold text-[#27624b]">Reviewed</span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CaregiverNotes({
  data,
  note,
  onNoteChange,
  onSubmit,
}: {
  data: CaregiverDetailResponse;
  note: string;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="border-[#d8e0e7] bg-white">
        <CardContent className="p-5">
          <h2 className="text-2xl font-bold">{VYVA_UI_COPY.caregiver.addNote}</h2>
          <Textarea className="mt-3 min-h-32" value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="Add a calm follow-up note." />
          <Button className="mt-3 rounded-xl bg-[#25303a] text-white" disabled={!note.trim()} onClick={onSubmit}>
            <Send />
            Save note
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {data.notes.map((item) => (
          <Card key={item.id} className="border-[#d8e0e7] bg-white">
            <CardContent className="p-4">
              <p className="font-semibold">{item.note}</p>
              <p className="mt-1 text-sm text-[#5d6873]">By {item.caregiver.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function collectVyvaUiVisibleStrings() {
  const strings: string[] = [
    VYVA_UI_COPY.appName,
    VYVA_UI_COPY.subtitle,
    ...Object.values(VYVA_UI_COPY.disclaimers),
    ...Object.values(VYVA_UI_COPY.demoLogin),
    VYVA_UI_COPY.seniorHome.dailyCheckIn,
    VYVA_UI_COPY.seniorHome.weeklyCheckIn,
    VYVA_UI_COPY.seniorHome.myWeek,
    VYVA_UI_COPY.seniorHome.medicationRoutine,
    VYVA_UI_COPY.seniorHome.smallStep,
    VYVA_UI_COPY.seniorHome.askForHelp,
    VYVA_UI_COPY.weekly.introTitle,
    VYVA_UI_COPY.weekly.introBody,
    VYVA_UI_COPY.weekly.completeTitle,
    VYVA_UI_COPY.weekly.completeBody,
    VYVA_UI_COPY.weekly.viewMyWeek,
    ...Object.values(VYVA_UI_COPY.myWeek),
    ...Object.values(VYVA_UI_COPY.caregiver),
  ];

  return strings.filter((item) => typeof item === "string");
}

export function vyvaUiHasBannedTerms() {
  return collectVyvaUiVisibleStrings().some((text) => textHasBannedVyvaUiTerm(text));
}
