import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import RoomPromptsAdminPage from "./RoomPromptsAdminPage";

vi.mock("@/lib/queryClient", () => ({ apiFetch: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "admin@example.com", role: "admin" }, logout: vi.fn() }),
}));

const apiFetchMock = vi.mocked(apiFetch);
const prompt = {
  id: "prompt-1",
  roomId: "room-1",
  roomSlug: "music-salon",
  roomName: "Music Salon",
  sessionDate: "2026-07-17",
  topicEn: "Songs we remember",
  topicEs: "Canciones que recordamos",
  topicDe: "Lieder, an die wir uns erinnern",
  openerEn: "Which song takes you back?",
  openerEs: "Que cancion te lleva al pasado?",
  openerDe: "Welches Lied erinnert dich?",
  activityType: "conversation",
  isLive: true,
  createdAt: "2026-07-17T08:00:00.000Z",
};

afterEach(() => apiFetchMock.mockReset());

describe("RoomPromptsAdminPage", () => {
  it("loads and saves localized room prompts", async () => {
    apiFetchMock.mockImplementation(async (input, init) => {
      if (String(input) === "/api/admin/social/room-prompts" && !init?.method) {
        return new Response(JSON.stringify({ prompts: [prompt] }), { status: 200 });
      }
      if (String(input) === "/api/admin/social/room-prompts/prompt-1" && init?.method === "PATCH") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "Unexpected request" }), { status: 500 });
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/room-prompts"]}>
        <RoomPromptsAdminPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Music Salon")).toBeInTheDocument();
    const englishTopic = screen.getByDisplayValue("Songs we remember");
    fireEvent.change(englishTopic, { target: { value: "Songs that stay with us" } });
    fireEvent.click(screen.getByRole("button", { name: "Save prompt" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/admin/social/room-prompts/prompt-1",
      expect.objectContaining({ method: "PATCH", body: expect.stringContaining("Songs that stay with us") }),
    ));
    expect(await screen.findByText("Music Salon prompt saved.")).toBeInTheDocument();
  });
});
