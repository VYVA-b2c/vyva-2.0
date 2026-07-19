import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";

export type ConciergeTaskNotificationItem = {
  id: string;
  eventType: "provider_reply" | "information_needed";
  title: string;
  body: string;
  taskPath: string;
  readAt: string | null;
  createdAt: string;
};

type ConciergeTaskNotificationResponse = {
  items: ConciergeTaskNotificationItem[];
  unreadCount: number;
};

const notificationQueryKey = ["/api/concierge/notifications"] as const;

export default function ConciergeTaskNotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const notificationQuery = useQuery<ConciergeTaskNotificationResponse>({
    queryKey: notificationQueryKey,
    queryFn: async () => {
      const response = await apiFetch(notificationQueryKey[0]);
      if (!response.ok) throw new Error("Could not load task updates");
      return response.json();
    },
    retry: false,
    refetchInterval: 30_000,
  });

  const readMutation = useMutation({
    mutationFn: async (item: ConciergeTaskNotificationItem) => {
      const response = await apiFetch(`/api/concierge/notifications/${item.id}/read`, { method: "POST" });
      if (!response.ok && response.status !== 404) throw new Error("Could not mark task update read");
      return item;
    },
    onMutate: (item) => {
      queryClient.setQueryData<ConciergeTaskNotificationResponse>(notificationQueryKey, (current) => current ? {
        items: current.items.map((candidate) => candidate.id === item.id
          ? { ...candidate, readAt: candidate.readAt ?? new Date().toISOString() }
          : candidate),
        unreadCount: Math.max(0, current.unreadCount - (item.readAt ? 0 : 1)),
      } : current);
      navigate(item.taskPath);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationQueryKey }),
  });

  const data = notificationQuery.data;
  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.items.slice(0, 5) ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="vyva-tap relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-vyva-text-2 hover:bg-vyva-warm"
          aria-label={t("concierge.notifications.title", "Task updates")}
          data-testid="button-concierge-task-notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span
              className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-vyva-purple px-1 font-body text-[10px] font-black leading-none text-white"
              data-testid="concierge-task-notification-count"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(340px,calc(100vw-24px))] rounded-[18px] border-[#E8DDD0] p-0 shadow-xl"
        data-testid="concierge-task-notification-panel"
      >
        <div className="border-b border-[#EFE7DE] px-4 py-3">
          <h2 className="font-body text-[16px] font-black text-vyva-text-1">
            {t("concierge.notifications.title", "Task updates")}
          </h2>
        </div>
        {items.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-5 text-vyva-text-2">
            <CheckCircle2 size={20} className="text-emerald-600" />
            <span className="font-body text-[14px] font-semibold">
              {t("concierge.notifications.empty", "You are up to date")}
            </span>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto py-1">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => readMutation.mutate(item)}
                className={`block w-full border-b border-[#F3ECE4] px-4 py-3 text-left last:border-b-0 hover:bg-[#FBF8F3] ${item.readAt ? "opacity-70" : "bg-[#FAF7FF]"}`}
                data-testid={`concierge-task-notification-${item.id}`}
              >
                <span className="flex items-start gap-2">
                  {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-vyva-purple" aria-hidden="true" />}
                  <span className="min-w-0">
                    <span className="block font-body text-[14px] font-black leading-snug text-vyva-text-1">
                      {item.title}
                    </span>
                    <span className="mt-1 line-clamp-2 block font-body text-[13px] leading-snug text-vyva-text-2">
                      {item.body}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate("/concierge/tasks")}
          className="w-full border-t border-[#EFE7DE] px-4 py-3 text-center font-body text-[14px] font-black text-vyva-purple hover:bg-[#FBF8F3]"
        >
          {t("concierge.notifications.viewTasks", "View Concierge tasks")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
