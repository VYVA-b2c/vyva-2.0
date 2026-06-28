import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const SUPER_ADMIN_EMAIL = (import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();

const adminItems = [
  { label: "Lifecycle", path: "/admin/lifecycle", description: "Users, forms, consent and orgs" },
  { label: "Activity", path: "/admin/activity", description: "Admin audit trail" },
  { label: "Admins", path: "/admin/users", description: "Manage admin access" },
  { label: "Phone onboarding", path: "/admin/phone-onboarding", description: "Inbound caller intake" },
  { label: "Home cards", path: "/admin/home-cards", description: "Personalized Today cards" },
  { label: "Hero messages", path: "/admin/hero-messages", description: "Banner copy and rules" },
  { label: "Learning library", path: "/admin/learning-library", description: "Daily lessons and interests" },
  { label: "Curated activities", path: "/admin/curated-activities", description: "Upload and review activities" },
  { label: "Voice readiness", path: "/admin/voice-readiness", description: "Agent context contracts" },
  { label: "Supply packages", path: "/admin/concierge-supplies", description: "Concierge supplies and kits" },
  { label: "Caregivers", path: "/admin/proxy-pending", description: "Elder assignments and support" },
];

export default function AdminMenu() {
  const location = useLocation();
  const { user } = useAuth();
  const items = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL
    ? adminItems
    : adminItems.filter((item) => item.path !== "/admin/users");

  return (
    <nav className="mt-3 flex flex-wrap gap-2 rounded-2xl border border-[#eadfd5] bg-white p-2 shadow-sm">
      {items.map((item) => {
        const active = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`rounded-xl px-4 py-2.5 transition ${
              active
                ? "bg-[#2f2135] text-white"
                : "text-[#4f4352] hover:bg-[#fbf8f5] hover:text-purple-700"
            }`}
          >
            <span className="block text-sm font-black">{item.label}</span>
            <span className={`hidden text-xs lg:block ${active ? "text-white/70" : "text-[#8b7a73]"}`}>
              {item.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
