import { act, render, screen, within } from "@testing-library/react";
import { Brain, Heart, Mic, ShieldCheck, Users } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MasterDashboardLayout, { type MasterFastHelpAction } from "./MasterDashboardLayout";

function makeAction(id: string, label: string, pinned = false): MasterFastHelpAction {
  return {
    id,
    icon: id === "urgent" ? ShieldCheck : Users,
    label,
    detail: "Detail",
    tone: { iconBg: "#FFFFFF", iconColor: "#111827", border: "#E5E7EB" },
    onClick: vi.fn(),
    testId: `fast-${id}`,
    pinned,
  };
}

function renderLayout(actions: MasterFastHelpAction[]) {
  return render(
    <MasterDashboardLayout
      hero={{
        icon: Mic,
        eyebrow: "Today",
        title: "Ready",
        action: { label: "Talk", onClick: vi.fn() },
      }}
      cards={[
        { id: "one", icon: Heart, title: "One", detail: "Detail", tone: { iconBg: "#FFFFFF", iconColor: "#111827", border: "#E5E7EB" }, onClick: vi.fn() },
        { id: "two", icon: Brain, title: "Two", detail: "Detail", tone: { iconBg: "#FFFFFF", iconColor: "#111827", border: "#E5E7EB" }, onClick: vi.fn() },
      ]}
      fastHelpTitle="Fast help"
      fastHelpActions={actions}
      fastHelpTestId="fast-help"
    />,
  );
}

describe("MasterDashboardLayout Fast help rotation", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows three actions and keeps urgent pinned while rotating", () => {
    vi.useFakeTimers();
    renderLayout([
      makeAction("urgent", "Safety signs", true),
      makeAction("one", "First"),
      makeAction("two", "Second"),
      makeAction("three", "Third"),
      makeAction("four", "Fourth"),
    ]);

    const fastHelp = screen.getByTestId("fast-help");
    expect(within(fastHelp).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByTestId("fast-urgent")).toHaveTextContent("Safety signs");
    expect(screen.getByTestId("fast-one")).toHaveTextContent("First");
    expect(screen.getByTestId("fast-two")).toHaveTextContent("Second");

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(screen.getByTestId("fast-urgent")).toHaveTextContent("Safety signs");
    expect(screen.getByTestId("fast-three")).toHaveTextContent("Third");
    expect(screen.getByTestId("fast-four")).toHaveTextContent("Fourth");
  });

  it("does not rotate when reduced motion is preferred", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      })),
    });

    renderLayout([
      makeAction("urgent", "Safety signs", true),
      makeAction("one", "First"),
      makeAction("two", "Second"),
      makeAction("three", "Third"),
      makeAction("four", "Fourth"),
    ]);

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(screen.getByTestId("fast-urgent")).toHaveTextContent("Safety signs");
    expect(screen.getByTestId("fast-one")).toHaveTextContent("First");
    expect(screen.getByTestId("fast-two")).toHaveTextContent("Second");
    expect(screen.queryByTestId("fast-three")).not.toBeInTheDocument();
  });
});

describe("MasterDashboardLayout contextual message", () => {
  it("offers the message action and dismissal without adding another heading", () => {
    const onMessageAction = vi.fn();
    const onMessageDismiss = vi.fn();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(
      <MasterDashboardLayout
        hero={{
          icon: Mic,
          eyebrow: "Today",
          title: "Good morning, Karim",
          subtitle: "Your medicine is due soon.",
          action: { label: "Talk", onClick: vi.fn() },
          messageActionLabel: "View",
          onMessageAction,
          onMessageDismiss,
          messageDismissLabel: "Dismiss",
        }}
        cards={[]}
        fastHelpActions={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Good morning, Karim" })).toBeInTheDocument();
    expect(screen.getByText("Your medicine is due soon.")).toBeInTheDocument();

    screen.getByTestId("button-home-context-action").click();
    screen.getByTestId("button-home-context-dismiss").click();

    expect(onMessageAction).toHaveBeenCalledOnce();
    expect(onMessageDismiss).toHaveBeenCalledOnce();
  });
});
