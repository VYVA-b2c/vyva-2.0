import { ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { VyvaIcon } from "@/components/brand/VyvaIcon";
import { deriveCompletedSections } from "@/lib/profileCompletion";
import { deriveProfileGroupStatus, getProfileGroup } from "@/lib/profileGroups";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";

export default function ProfileGroupPage({ preview = false }: { preview?: boolean }) {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { isDark } = useHomeMasterTheme();
  const group = getProfileGroup(groupId);
  const { data } = useQuery<{ profile: Record<string, unknown> | null; onboardingState: Record<string, unknown> | null }>({
    queryKey: preview ? ["profile-group-preview", groupId] : ["/api/onboarding/state"],
    enabled: !preview,
    initialData: preview ? { profile: {}, onboardingState: {} } : undefined,
  });

  if (!group) return <Navigate to={preview ? "/dev/profile-overview" : "/onboarding/profile"} replace />;

  const completed = deriveCompletedSections(data?.profile ?? null, data?.onboardingState ?? null);
  const status = deriveProfileGroupStatus(group, completed);

  return (
    <div className="home-master-profile-page min-h-screen bg-vyva-cream px-3 py-3 sm:px-5 sm:py-6" data-home-master-theme={isDark ? "dark" : "light"}>
      <PhoneFrame
        layout="page"
        subtitle={group.title}
        showBack
        onBack={() => navigate(preview ? "/dev/profile-overview" : "/onboarding/profile")}
        showCompanionMode={false}
      >
        <main className="mx-auto w-full max-w-[760px]" data-testid={`profile-group-${group.id}`}>
          <div className="mb-5 flex items-center justify-between gap-4 border-b border-vyva-border pb-4">
            <p className="text-[15px] leading-relaxed text-vyva-text-2">{group.description}</p>
            <span className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-extrabold ${status === "complete" ? "bg-emerald-50 text-emerald-700" : status === "optional" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800"}`}>
              {status === "complete" ? "Complete" : status === "optional" ? "Optional" : "Needs information"}
            </span>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-vyva-border bg-white shadow-[0_12px_30px_rgba(53,28,87,0.06)]">
            {group.subsections.map((section, index) => {
              const done = completed.has(section.id);
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => navigate(preview
                    ? section.id === "accessibility"
                      ? "/dev/home-master/profile/preferences"
                      : `/dev/profile-overview/section/${section.id === "contact" ? "address" : section.id}`
                    : section.path)}
                  data-testid={`button-profile-subsection-${section.id}`}
                  className={`flex min-h-[84px] w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-vyva-purple/[0.035] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-vyva-purple/20 sm:px-5 ${index ? "border-t border-vyva-border" : ""}`}
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[17px] bg-[#F1E8FF] text-vyva-purple">
                    <VyvaIcon icon={section.icon} size={23} strokeWidth={2.35} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[17px] font-extrabold text-vyva-text-1">{section.title}</strong>
                    <span className="mt-0.5 block text-[14px] text-vyva-text-2">{section.description}</span>
                  </span>
                  <span className={`text-[12px] font-bold ${done ? "text-emerald-700" : section.required ? "text-amber-800" : "text-vyva-text-3"}`}>
                    {done ? "Complete" : section.required ? "Add info" : "Optional"}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-vyva-text-3" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </main>
      </PhoneFrame>
    </div>
  );
}
