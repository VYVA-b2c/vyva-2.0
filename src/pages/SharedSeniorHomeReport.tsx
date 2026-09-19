import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Home, Loader2 } from "lucide-react";

type SharedSeniorHomeFinderPayload = {
  report: {
    name?: string;
    language?: string;
    summary?: string;
  };
  created_at?: string;
  expires_at?: string;
};

function formatSharedDate(value?: string, language = "en") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export default function SharedSeniorHomeReport() {
  const token = window.location.pathname.split("/").pop() ?? "";
  const { data, isLoading, isError } = useQuery<SharedSeniorHomeFinderPayload>({
    queryKey: [`/api/senior-home-finder/shared/${token}`],
    queryFn: async () => {
      const res = await fetch(`/api/senior-home-finder/shared/${token}`);
      if (!res.ok) throw new Error("Report not found");
      return res.json();
    },
    retry: false,
  });

  const report = data?.report;
  const language = report?.language ?? "en";
  const name = report?.name || "the family";
  const createdLabel = formatSharedDate(data?.created_at, language);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] px-6">
        <div className="rounded-[30px] bg-white p-8 text-center shadow-[0_18px_48px_rgba(63,45,35,0.12)]">
          <Loader2 className="mx-auto mb-4 animate-spin text-vyva-purple" size={36} />
          <p className="font-body text-[19px] font-semibold text-vyva-text-2">Preparing the shortlist...</p>
        </div>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] px-6">
        <div className="max-w-[520px] rounded-[32px] border border-vyva-border bg-white p-8 text-center shadow-[0_18px_48px_rgba(63,45,35,0.12)]">
          <AlertTriangle className="mx-auto mb-4 text-[#B91C1C]" size={42} />
          <h1 className="font-display text-[32px] leading-tight text-vyva-text-1">Shortlist not available</h1>
          <p className="mt-3 font-body text-[18px] leading-relaxed text-vyva-text-2">
            This link may have expired or is incorrect.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#EAF1FB_0%,transparent_35%),linear-gradient(180deg,#FAF7F2_0%,#F6EFE7_100%)] px-4 py-6">
      <article className="mx-auto max-w-[760px] overflow-hidden rounded-[36px] border border-white/80 bg-white shadow-[0_22px_70px_rgba(63,45,35,0.14)]">
        <header className="relative overflow-hidden bg-gradient-to-br from-[#E3EDF7] via-white to-[#FFF7ED] p-7">
          <div className="relative mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-[28px] bg-white text-[#3C6E9E] shadow-[0_12px_30px_rgba(60,110,158,0.14)]">
            <Home size={38} />
          </div>
          <p className="relative font-body text-[14px] font-bold uppercase tracking-[0.16em] text-[#3C6E9E]">
            Senior Home Finder
          </p>
          <h1 className="relative mt-2 font-display text-[36px] leading-tight text-vyva-text-1">
            Shortlist shared by {name}
          </h1>
          {createdLabel ? (
            <p className="relative mt-3 font-body text-[15px] font-semibold text-vyva-text-2">{createdLabel}</p>
          ) : null}
        </header>
        <div className="p-7">
          <p className="whitespace-pre-line font-body text-[18px] leading-relaxed text-vyva-text-1">
            {report.summary}
          </p>
          <p className="mt-6 font-body text-[14px] leading-relaxed text-vyva-text-2">
            This is general information from VYVA's Senior Home Finder, not a guarantee of availability or cost — confirm details directly with each provider.
          </p>
        </div>
      </article>
    </main>
  );
}
