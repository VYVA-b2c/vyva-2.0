import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProviderReplyVoiceCanvas, {
  type ProviderReplyVoiceCanvasProps,
} from "./ProviderReplyVoiceCanvas";
import {
  initialProviderReplyCanvasState,
  providerReplyCanvasReducer,
  type ProviderReplyCanvasState,
} from "./providerReplyCanvasMachine";
import { VYVA_VOICE_USER_MESSAGE_EVENT, type VoiceUserMessageDetail } from "@/lib/voiceNavigation";

const copy: ProviderReplyVoiceCanvasProps["copy"] = {
  agentPresence: {
    idleLabel: "Voice ready",
    idleDescription: "Use voice or touch.",
    listeningLabel: "Listening with you",
    listeningDescription: "Say or type the provider reply.",
    speakingLabel: "VYVA is speaking",
    speakingDescription: "Follow the screen.",
    thinkingLabel: "Thinking through provider reply",
    thinkingDescription: "Checking provider reply details.",
    accessibleLabel: "VYVA provider reply voice status",
  },
  listening: {
    status: "Listening",
    title: "Review provider reply",
    helper: "Use voice, touch, or keyboard.",
    start: "Start",
    cancel: "Not now",
  },
  context: {
    title: "Provider context",
    helper: "Check the task before saving anything.",
    provider: "Provider",
    providerType: "Provider type",
    action: "Task",
    waiting: "Waiting",
    continue: "Continue",
    back: "Back",
  },
  reply: {
    title: "What did they say?",
    helper: "Record only the provider reply.",
    label: "Provider reply",
    placeholder: "Provider confirmed the visit",
    continue: "Continue",
    back: "Back",
  },
  scheduledFor: {
    title: "When is it scheduled?",
    helper: "A valid date and time is required.",
    label: "Confirmed date and time",
    continue: "Continue",
    back: "Back",
  },
  details: {
    title: "Any note for VYVA?",
    helper: "Optional.",
    label: "Notes",
    placeholder: "Optional note",
    continue: "Review",
    back: "Back",
  },
  review: {
    title: "Review before saving",
    helper: "This saves the reply but does not complete the task.",
    provider: "Provider",
    intent: "Reply intent",
    action: "Task",
    reply: "Reply",
    scheduledFor: "Scheduled for",
    notes: "Notes",
    noNotes: "None",
    save: "Save reply",
    back: "Back",
  },
  saving: {
    status: "Saving",
    title: "Saving the reply",
    helper: "No external message is sent.",
    action: "Saving...",
  },
  saved: {
    status: "Saved",
    title: "Reply saved",
    helper: "Now you can mark the task complete.",
    reference: "Reference",
    markComplete: "Mark complete",
    edit: "Edit reply",
  },
  completing: {
    status: "Completing",
    title: "Completing the task",
    helper: "Please wait.",
    action: "Completing...",
  },
  completed: {
    status: "Completed",
    title: "Task complete",
    helper: "The saved reply is in history.",
    reference: "Reference",
    done: "Done",
  },
  blocked: {
    status: "Needs attention",
    title: "Needs attention",
    helper: "Try again.",
    missingContextHelper: "Provider context is missing.",
    incompleteReplyHelper: "Add the provider reply before continuing.",
    incompleteScheduledForHelper: "Add a valid date and time before continuing.",
    urgentBoundaryHelper: "This may need urgent help. No message was sent.",
    retry: "Retry",
    cancel: "Cancel",
  },
  cancelled: {
    status: "Cancelled",
    title: "Nothing saved",
    helper: "The reply was not saved.",
    restart: "Start again",
  },
  detailLabels: {
    messagePurpose: "Message purpose",
    providerType: "Provider type",
    confidence: "Confidence",
    reviewNeeded: "Review needed",
    draftOnly: "Draft only",
    noMessageSent: "No message sent yet",
    reviewBeforeSend: "Review before send",
    recommended: "Recommended",
    urgentBoundary: "Urgent safety boundary",
    outgoingDraft: "Outgoing draft",
    editBeforeSend: "You can edit before anything is saved.",
  },
  progress: (current, total) => `Step ${current} of ${total}`,
};

const commands: ProviderReplyVoiceCanvasProps["voiceCommands"] = {
  start: ["start"],
  back: ["back"],
  cancel: ["cancel"],
  continue: ["continue"],
  save: ["save reply"],
  complete: ["mark complete"],
  retry: ["retry"],
  skip: ["skip"],
};

const context: ProviderReplyVoiceCanvasProps["context"] = {
  providerName: "Riverside Clinic",
  providerType: "Clinic",
  actionLabel: "Book appointment",
  waitingSinceLabel: "Waiting 2 hours",
};

const richIntentContext: ProviderReplyVoiceCanvasProps["context"] = {
  ...context,
  replyIntents: [
    {
      id: "confirm-appointment",
      label: "Confirm appointment",
      subtitle: "Appointment reply",
      description: "Save the provider confirmation for review.",
      purposeLabel: "Confirm appointment",
      confidenceLabel: "Review needed",
      draftOnlyLabel: "No message sent yet",
      reviewReminder: "Review before send",
      recommended: true,
      voiceAliases: ["confirm"],
    },
    {
      id: "reschedule-long",
      label: "Reschedule with a deliberately long translated provider reply intent label",
      subtitle: "Needs review",
      description: "Prepare a draft for review before anything is saved.",
      purposeLabel: "Reschedule",
      confidenceLabel: "Review needed",
      draftOnlyLabel: "No message sent yet",
    },
    {
      id: "urgent",
      label: "Urgent or safety concern",
      subtitle: "Stops this flow",
      description: "This path is blocked and safe.",
      urgent: true,
      boundaryLabel: "Do not use a normal provider reply for urgent help.",
      voiceAliases: ["urgent"],
    },
  ],
};

function props(
  overrides: Partial<ProviderReplyVoiceCanvasProps> = {},
): ProviderReplyVoiceCanvasProps {
  return {
    copy,
    context,
    voiceCommands: commands,
    onSaveReply: vi.fn().mockResolvedValue({ summary: "Reply saved.", reference: "SAVE-1" }),
    onMarkComplete: vi.fn().mockResolvedValue({ reference: "DONE-1" }),
    storageKey: "provider-reply-test",
    ...overrides,
  };
}

function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function keyboardActivate(name: string) {
  const button = screen.getByRole("button", { name });
  button.focus();
  expect(button).toHaveFocus();
  fireEvent.keyDown(button, { key: "Enter", code: "Enter" });
  fireEvent.click(button);
}

function toReview() {
  click("Start");
  click("Continue");
  fireEvent.change(screen.getByLabelText("Provider reply"), {
    target: { value: "Confirmed Friday at 10." },
  });
  click("Continue");
  click("Review");
}

function say(text: string) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: { text, transcriptEntry: { from: "user", text } },
      }),
    );
  });
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("ProviderReplyVoiceCanvas", () => {
  it("shows rich provider reply intent cards without saving or sending", () => {
    const onSaveReply = vi.fn();
    render(<ProviderReplyVoiceCanvas {...props({ context: richIntentContext, onSaveReply })} />);

    click("Start");

    expect(screen.getAllByText("Message purpose").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Provider type").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No message sent yet").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Review before send").length).toBeGreaterThan(0);
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Confirm appointment/ }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    click("Continue");

    expect(screen.getByRole("heading", { name: "What did they say?" })).toBeInTheDocument();
    expect(screen.getByText("Draft only")).toBeInTheDocument();
    expect(onSaveReply).not.toHaveBeenCalled();
  });

  it("shows the VYVA voice-status band on the first provider reply decision", () => {
    render(<ProviderReplyVoiceCanvas {...props({ context: richIntentContext })} />);

    click("Start");

    expect(screen.getByLabelText("VYVA provider reply voice status")).toHaveTextContent("Voice ready");
    expect(screen.getByLabelText("VYVA provider reply voice status")).toHaveTextContent("Use voice or touch.");
    expect(screen.getByTestId("voice-canvas-agent-orb-provider-reply-context")).toBeInTheDocument();
  });

  it("keeps urgent provider reply intent blocked and safe", () => {
    const onSaveReply = vi.fn();
    render(<ProviderReplyVoiceCanvas {...props({ context: richIntentContext, onSaveReply })} />);

    click("Start");
    fireEvent.click(screen.getByRole("button", { name: /Urgent or safety concern/ }));

    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByText("This may need urgent help. No message was sent.")).toBeInTheDocument();
    expect(onSaveReply).not.toHaveBeenCalled();
    click("Retry");
    expect(screen.getByRole("heading", { name: "Provider context" })).toBeInTheDocument();
  });

  it("supports voice intent selection before composing the draft", () => {
    render(<ProviderReplyVoiceCanvas {...props({ context: richIntentContext })} />);

    say("start");
    say("confirm");
    expect(screen.getByRole("button", { name: /Confirm appointment/ })).toHaveAttribute("aria-pressed", "true");
    say("continue");
    expect(screen.getByRole("heading", { name: "What did they say?" })).toBeInTheDocument();
  });

  it("saves a provider reply before separately marking the task complete", async () => {
    const onSaveReply = vi.fn().mockResolvedValue({ summary: "Reply saved.", reference: "SAVE-1" });
    const onMarkComplete = vi.fn().mockResolvedValue({ reference: "DONE-1" });
    render(<ProviderReplyVoiceCanvas {...props({ onSaveReply, onMarkComplete })} />);

    toReview();
    click("Save reply");

    expect(await screen.findByRole("heading", { name: "Reply saved" })).toBeInTheDocument();
    expect(onSaveReply).toHaveBeenCalledWith(
      expect.objectContaining({ providerReply: "Confirmed Friday at 10." }),
      expect.objectContaining({ requestId: 1 }),
    );
    expect(onMarkComplete).not.toHaveBeenCalled();

    click("Mark complete");
    expect(await screen.findByRole("heading", { name: "Task complete" })).toBeInTheDocument();
    expect(onMarkComplete).toHaveBeenCalledOnce();
  });

  it("requires a valid scheduled time for appointment-style provider replies", () => {
    render(<ProviderReplyVoiceCanvas {...props({ context: { ...context, requiresScheduledFor: true } })} />);

    click("Start");
    click("Continue");
    fireEvent.change(screen.getByLabelText("Provider reply"), {
      target: { value: "Confirmed." },
    });
    click("Continue");

    expect(screen.getByRole("heading", { name: "When is it scheduled?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Confirmed date and time"), {
      target: { value: "not a date" },
    });
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Confirmed date and time"), {
      target: { value: "2026-07-20T10:00" },
    });
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("preserves draft text when going back and restores it after reconnect", () => {
    const { unmount } = render(<ProviderReplyVoiceCanvas {...props()} />);
    click("Start");
    click("Continue");
    fireEvent.change(screen.getByLabelText("Provider reply"), {
      target: { value: "A long translated provider reply that should stay intact." },
    });
    click("Continue");
    click("Back");

    expect(screen.getByDisplayValue("A long translated provider reply that should stay intact.")).toBeInTheDocument();
    unmount();

    render(<ProviderReplyVoiceCanvas {...props()} />);
    expect(screen.getByDisplayValue("A long translated provider reply that should stay intact.")).toBeInTheDocument();
  });

  it("prevents duplicate save attempts and ignores stale save responses", async () => {
    let resolveSave: (value: { summary: string }) => void = () => {};
    const onSaveReply = vi.fn(() => new Promise<{ summary: string }>((resolve) => {
      resolveSave = resolve;
    }));
    render(<ProviderReplyVoiceCanvas {...props({ onSaveReply })} />);

    toReview();
    click("Save reply");
    click("Saving...");

    expect(onSaveReply).toHaveBeenCalledOnce();
    act(() => resolveSave({ summary: "Saved once." }));
    expect(await screen.findByText("Saved once.")).toBeInTheDocument();

    const waiting: ProviderReplyCanvasState = {
      ...initialProviderReplyCanvasState,
      step: "saving",
      requestId: 2,
      revision: 0,
      draft: { replyIntentId: "", replyIntentLabel: "", providerReply: "Reply", scheduledFor: "", notes: "" },
    };
    expect(providerReplyCanvasReducer(waiting, {
      type: "SAVE_RESOLVE",
      requestId: 1,
      summary: "Stale",
    })).toEqual(waiting);
  });

  it("supports voice-only completion without logging reply text in telemetry", async () => {
    const events: unknown[] = [];
    const onSaveReply = vi.fn().mockResolvedValue({ summary: "Saved by voice." });
    render(<ProviderReplyVoiceCanvas {...props({ onSaveReply, onTelemetry: (event) => events.push(event) })} />);

    say("start");
    say("continue");
    say("The provider confirmed Tuesday morning.");
    say("skip");
    say("save reply");

    expect(await screen.findByRole("heading", { name: "Reply saved" })).toBeInTheDocument();
    say("mark complete");
    expect(await screen.findByRole("heading", { name: "Task complete" })).toBeInTheDocument();
    expect(onSaveReply).toHaveBeenCalledOnce();
    expect(JSON.stringify(events)).not.toContain("Tuesday morning");
    expect(JSON.stringify(events)).not.toContain("Riverside Clinic");
    expect(JSON.stringify(events)).not.toContain("Book appointment");
  });

  it("blocks a voice continue attempt when required information is missing", () => {
    render(<ProviderReplyVoiceCanvas {...props({ context: { ...context, requiresScheduledFor: true } })} />);

    say("start");
    say("continue");
    say("continue");

    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByText("Add the provider reply before continuing.")).toBeInTheDocument();
    click("Retry");
    expect(screen.getByRole("heading", { name: "What did they say?" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Provider reply"), {
      target: { value: "Confirmed." },
    });
    say("continue");
    say("continue");

    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByText("Add a valid date and time before continuing.")).toBeInTheDocument();
    click("Retry");
    expect(screen.getByRole("heading", { name: "When is it scheduled?" })).toBeInTheDocument();
  });

  it("can be completed from the keyboard without completing before save", async () => {
    const onSaveReply = vi.fn().mockResolvedValue({ summary: "Reply saved.", reference: "SAVE-KEY" });
    const onMarkComplete = vi.fn().mockResolvedValue({ reference: "DONE-KEY" });
    render(<ProviderReplyVoiceCanvas {...props({ onSaveReply, onMarkComplete })} />);

    keyboardActivate("Start");
    keyboardActivate("Continue");
    fireEvent.change(screen.getByLabelText("Provider reply"), {
      target: { value: "Confirmed with a long translated provider response that should remain readable." },
    });
    keyboardActivate("Continue");
    keyboardActivate("Review");
    keyboardActivate("Save reply");

    expect(await screen.findByRole("heading", { name: "Reply saved" })).toBeInTheDocument();
    expect(onMarkComplete).not.toHaveBeenCalled();
    keyboardActivate("Mark complete");
    expect(await screen.findByRole("heading", { name: "Task complete" })).toBeInTheDocument();
    expect(onSaveReply).toHaveBeenCalledOnce();
    expect(onMarkComplete).toHaveBeenCalledOnce();
  });

  it("keeps dictated draft text after a voice back interruption", () => {
    render(<ProviderReplyVoiceCanvas {...props()} />);

    say("start");
    say("continue");
    say("The provider confirmed a very long translated reply that should survive an interruption.");
    expect(screen.getByRole("heading", { name: "Any note for VYVA?" })).toBeInTheDocument();

    say("back");
    expect(screen.getByRole("heading", { name: "What did they say?" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("The provider confirmed a very long translated reply that should survive an interruption.")).toBeInTheDocument();
  });

  it("shows blocked states for missing context, save failure, and complete failure", async () => {
    const failedSave = vi.fn().mockRejectedValueOnce(new Error("Save failed")).mockResolvedValueOnce({ summary: "Recovered" });
    const missing = render(<ProviderReplyVoiceCanvas {...props({ context: {}, onSaveReply: failedSave })} />);
    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByText("Provider context is missing.")).toBeInTheDocument();
    missing.unmount();

    sessionStorage.clear();
    const { unmount } = render(<ProviderReplyVoiceCanvas {...props({ onSaveReply: failedSave })} />);
    toReview();
    click("Save reply");
    expect(await screen.findByText("Save failed")).toBeInTheDocument();
    click("Retry");
    expect(screen.getByRole("heading", { name: "Review before saving" })).toBeInTheDocument();
    click("Save reply");
    expect(await screen.findByText("Recovered")).toBeInTheDocument();
    unmount();

    sessionStorage.clear();
    const failedComplete = vi.fn().mockRejectedValue(new Error("Complete failed"));
    render(<ProviderReplyVoiceCanvas {...props({ onMarkComplete: failedComplete })} />);
    toReview();
    click("Save reply");
    await screen.findByRole("heading", { name: "Reply saved" });
    click("Mark complete");
    expect(await screen.findByText("Complete failed")).toBeInTheDocument();
  });
});
