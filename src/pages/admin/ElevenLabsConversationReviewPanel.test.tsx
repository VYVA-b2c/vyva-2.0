import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ElevenLabsConversationReviewPanel from "./ElevenLabsConversationReviewPanel";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  details: vi.fn(),
  audio: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@/lib/elevenLabsConversationReviews", () => ({
  ELEVENLABS_REVIEW_STATUSES: ["unreviewed", "reviewed", "needs_follow_up", "quality_issue"],
  fetchElevenLabsConversations: api.list,
  fetchElevenLabsConversationDetails: api.details,
  fetchElevenLabsConversationAudio: api.audio,
  saveElevenLabsConversationReview: api.save,
}));

const conversation = {
  id: "row-1",
  providerConversationId: "conv_123",
  vyvaSessionId: "vyva-session-1",
  userId: "user-1",
  agentId: "agent-1",
  agentName: "Dr. AI",
  status: "done",
  locale: "fr",
  callSuccessful: "success",
  hasAudio: true,
  hasTranscript: true,
  consentStatus: "granted",
  consentVersion: "v1",
  consentRecordedAt: 1_780_000_000_000,
  startedAt: 1_780_000_000_000,
  completedAt: 1_780_000_060_000,
  durationSeconds: 60,
  retentionDeleteAt: Date.now() + 86_400_000,
  reviewStatus: "unreviewed",
  reviewNote: "",
  reviewedBy: null,
  reviewedAt: null,
  availability: { details: true, audio: true, reason: null },
};

describe("ElevenLabsConversationReviewPanel", () => {
  beforeEach(() => {
    api.list.mockReset().mockResolvedValue([conversation]);
    api.details.mockReset().mockResolvedValue({
      providerConversationId: "conv_123",
      status: "done",
      summary: "A short summary",
      callSuccessful: "success",
      transcript: [{ role: "agent", message: "Bonjour", timeInCallSeconds: 1, interrupted: false }],
    });
    api.audio.mockReset().mockResolvedValue(new Blob(["audio"], { type: "audio/mpeg" }));
    api.save.mockReset().mockResolvedValue({ ...conversation, reviewStatus: "reviewed" });
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:review-audio"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("requires an audit reason before retrieving protected content", async () => {
    render(<ElevenLabsConversationReviewPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /Dr\. AI/i }));
    expect(screen.getByRole("button", { name: "Load transcript" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Load recording" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Access reason/i), { target: { value: "Investigating user report" } });
    fireEvent.click(screen.getByRole("button", { name: "Load transcript" }));
    expect(await screen.findByText("Bonjour")).toBeInTheDocument();
    expect(api.details).toHaveBeenCalledWith("conv_123", "Investigating user report");
  });

  it("fetches audio as a protected blob and records review updates", async () => {
    render(<ElevenLabsConversationReviewPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /Dr\. AI/i }));
    fireEvent.change(screen.getByLabelText(/Access reason/i), { target: { value: "Routine quality review" } });
    fireEvent.click(screen.getByRole("button", { name: "Load recording" }));
    await waitFor(() => expect(api.audio).toHaveBeenCalledWith("conv_123", "Routine quality review"));
    expect(document.querySelector("audio")?.getAttribute("src")).toBe("blob:review-audio");

    fireEvent.change(screen.getByLabelText("Review status"), { target: { value: "reviewed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save review" }));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "conv_123",
      status: "reviewed",
      reason: "Routine quality review",
    })));
  });
});
