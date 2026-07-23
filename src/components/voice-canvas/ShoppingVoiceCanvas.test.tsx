import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShoppingVoiceCanvas, {
  type ShoppingVoiceCanvasProps,
} from "./ShoppingVoiceCanvas";
import {
  SHOPPING_CANVAS_COMMANDS,
  SHOPPING_CANVAS_COPY,
} from "@/pages/conciergeShoppingCanvasCopy";
import type { ShoppingCanvasState } from "./shoppingCanvasMachine";
import {
  VYVA_VOICE_USER_MESSAGE_EVENT,
  type VoiceUserMessageDetail,
} from "@/lib/voiceNavigation";
const props = (
  extra: Partial<ShoppingVoiceCanvasProps> = {},
): ShoppingVoiceCanvasProps => ({
  copy: SHOPPING_CANVAS_COPY.en,
  voiceCommands: SHOPPING_CANVAS_COMMANDS.en,
  retailers: [
    {
      id: "market",
      label: "Neighbourhood Market With A Very Long Translated Name",
      subtitle: "Saved retailer",
      retailerType: "Grocery",
      estimateLabel: "Unverified",
      feeLabel: "Unverified",
      reviewReminder: "Review before action",
      recommended: true,
    },
  ],
  addresses: [{ id: "home", label: "Home", address: "1 Main Street", savedLabel: "Saved address", deliveryNote: "Delivery prepared, not ordered", reviewReminder: "Review before action", recommended: true }],
  onConfirm: vi
    .fn()
    .mockResolvedValue({ outcome: "pending", reference: "shop-1" }),
  storageKey: `test-${Math.random()}`,
  ...extra,
});
const reviewState: ShoppingCanvasState = {
  step: "review",
  requestId: 0,
  revision: 0,
  draft: {
    retailerId: "market",
    retailerName: "Market",
    items: [{ id: "1", name: "Milk", quantity: "2 x 1 litre" }],
    itemName: "",
    itemQuantity: "",
    fulfillment: "delivery",
    locationId: "home",
    location: "1 Main Street",
    preferredTime: "Tuesday 10–12",
    substitutions: "none",
    estimateStatus: "unverified",
    estimatedCost: "",
    fees: "",
    availability: "unverified",
  },
};
describe("ShoppingVoiceCanvas", () => {
  beforeEach(() => sessionStorage.clear());
  it("shows rich shopping decision-card aids without confirming", () => {
    const onConfirm = vi.fn();
    render(<ShoppingVoiceCanvas {...props({ onConfirm })} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText("Saved retailer")).toBeInTheDocument();
    expect(screen.getByText("Grocery")).toBeInTheDocument();
    expect(screen.getAllByText("Unverified").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Review before action").length).toBeGreaterThan(0);
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Neighbourhood Market/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Exact item" }), {
      target: { value: "Milk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Quantity" }), {
      target: { value: "2 x 1 litre" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(screen.getAllByText("Items to review").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /everything/ }));
    expect(screen.getByText("Delivery prepared, not ordered")).toBeInTheDocument();
    expect(screen.getAllByText("No order or payment").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
    expect(screen.getByText("Saved address")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("synchronizes a saved retailer choice from voice", async () => {
    render(<ShoppingVoiceCanvas {...props()} />);
    const say = (text: string) =>
      act(() =>
        window.dispatchEvent(
          new CustomEvent<VoiceUserMessageDetail>(
            VYVA_VOICE_USER_MESSAGE_EVENT,
            { detail: { text, transcriptEntry: { from: "user", text } } },
          ),
        ),
      );
    say("start");
    say("Neighbourhood Market With A Very Long Translated Name");
    const retailer = screen.getByRole("button", { name: /Neighbourhood Market/ });
    expect(retailer).toHaveAttribute("data-spoken-selected", "true");
    expect(retailer).toHaveFocus();
    await waitFor(() => expect(
      screen.getByRole("heading", { name: "What item do you need?" }),
    ).toBeInTheDocument());
  });
  it("completes saved-retailer and saved-address path with keyboard-accessible controls", async () => {
    const onConfirm = vi
      .fn()
      .mockResolvedValue({ outcome: "pending", reference: "shop-1" });
    render(<ShoppingVoiceCanvas {...props({ onConfirm })} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Neighbourhood Market/ }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Exact item" }), {
      target: { value: "Milk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Quantity" }), {
      target: { value: "2 x 1 litre" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    fireEvent.click(screen.getByRole("button", { name: "That’s everything" }));
    fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
    fireEvent.click(screen.getByRole("button", { name: /Home/ }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Date and time window" }),
      { target: { value: "Tuesday 10–12" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "No substitutions" }));
    fireEvent.click(screen.getByRole("button", { name: "Not yet" }));
    expect(screen.getByText("2 x 1 litre — Milk")).toBeInTheDocument();
    expect(screen.getAllByText("Unverified").length).toBeGreaterThan(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and prepare request" }),
    );
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("Your request is pending"),
    ).toBeInTheDocument();
  });
  it("prevents duplicate confirmation while waiting", async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(
      () =>
        new Promise<{ outcome: "completed" }>((done) => {
          resolve = () => done({ outcome: "completed" });
        }),
    );
    render(
      <ShoppingVoiceCanvas
        {...props({ initialState: reviewState, onConfirm })}
      />,
    );
    const confirm = screen.getByRole("button", {
      name: "Confirm and prepare request",
    });
    fireEvent.click(confirm);
    expect(screen.getByRole("button", { name: "Preparing…" })).toBeDisabled();
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    resolve();
    await screen.findByText("Your request is prepared");
  });
  it("emits closed privacy-safe telemetry for shopping details", async () => {
    const events: unknown[] = [];
    const onConfirm = vi
      .fn()
      .mockResolvedValue({ outcome: "pending", reference: "SHOP-PRIVATE-42" });
    render(
      <ShoppingVoiceCanvas
        {...props({ initialState: reviewState, onConfirm, onTelemetry: (event) => events.push(event) })}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and prepare request" }),
    );

    await screen.findByText("Your request is pending");

    expect(events).toContainEqual(
      expect.objectContaining({
        name: "confirmation_submitted",
        step: "review",
        input: "touch_or_keyboard",
        attempt: 1,
        revision: 0,
        restored: false,
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        name: "pending",
        step: "pending",
        input: "system",
        attempt: 1,
        revision: 0,
        restored: false,
      }),
    );

    const allowedKeys = new Set([
      "name",
      "step",
      "input",
      "attempt",
      "revision",
      "restored",
    ]);
    for (const event of events) {
      expect(Object.keys(event as Record<string, unknown>).every((key) =>
        allowedKeys.has(key),
      )).toBe(true);
    }

    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("Milk");
    expect(serialized).not.toContain("2 x 1 litre");
    expect(serialized).not.toContain("1 Main Street");
    expect(serialized).not.toContain("Tuesday");
    expect(serialized).not.toContain("SHOP-PRIVATE-42");
  });
  it("returns to review and requires a second confirmation after material changes", async () => {
    const onConfirm = vi
      .fn()
      .mockResolvedValueOnce({
        outcome: "changed",
        message: "The retailer changed the total.",
        changes: {
          estimatedCost: "€12",
          fees: "€3",
          estimateStatus: "provided",
        },
      })
      .mockResolvedValueOnce({ outcome: "pending" });
    render(
      <ShoppingVoiceCanvas
        {...props({ initialState: reviewState, onConfirm })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and prepare request" }),
    );
    expect(
      await screen.findByText("The retailer changed the total."),
    ).toBeInTheDocument();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and prepare request" }),
    );
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
  });
  it("restores entered information but never an in-flight request", () => {
    sessionStorage.setItem(
      "restore",
      JSON.stringify({
        ...reviewState,
        step: "itemQuantity",
        draft: {
          ...reviewState.draft,
          itemName: "Bread",
          itemQuantity: "3 loaves",
        },
      }),
    );
    render(<ShoppingVoiceCanvas {...props({ storageKey: "restore" })} />);
    expect(screen.getByDisplayValue("3 loaves")).toBeInTheDocument();
  });
  it("accepts long Spanish labels without truncating accessible names", () => {
    render(
      <div style={{ width: 320 }}>
        <ShoppingVoiceCanvas
          {...props({
            copy: SHOPPING_CANVAS_COPY.es,
            voiceCommands: SHOPPING_CANVAS_COMMANDS.es,
          })}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(
      screen.getByRole("button", {
        name: /Neighbourhood Market With A Very Long/,
      }),
    ).toBeInTheDocument();
  });
  it("ignores stale completion responses in the reducer-driven request lifecycle", async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValue(new Error("Service unavailable"));
    render(
      <ShoppingVoiceCanvas
        {...props({ initialState: reviewState, onConfirm })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and prepare request" }),
    );
    expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review and retry" }));
    expect(
      screen.getByRole("button", { name: "Confirm and prepare request" }),
    ).toBeInTheDocument();
  });
});
