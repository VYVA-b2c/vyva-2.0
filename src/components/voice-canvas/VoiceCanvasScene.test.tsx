import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceCanvasScene } from "./VoiceCanvasScene";
import type { VoiceCanvasSceneKind, VoiceCanvasViewModel } from "./types";

vi.mock("@/components/ZamoraVoiceOrb", () => ({ default: ({ testId }: { testId?: string }) => <div data-testid={testId ?? "mock-vyva-orb"} /> }));

const base = (kind: VoiceCanvasSceneKind, extra: Partial<VoiceCanvasViewModel> = {}): VoiceCanvasViewModel => ({ sceneId:kind,kind,title:`${kind} title`,helperText:`${kind} helper`,...extra });

describe.each([
  ["listening",{status:"listening",statusLabel:"Listening"}],
  ["choice",{choices:[{id:"a",label:"Option A"},{id:"b",label:"Option B"}]}],
  ["place",{choices:[{id:"home",label:"Home",description:"12 Garden Lane"}]}],
  ["date-time",{textEntry:{label:"Time",value:"10:30",type:"time"}}],
  ["text-entry",{textEntry:{label:"Address",value:""}}],
  ["review",{summaryRows:[{id:"date",label:"Date",value:"Tomorrow"}]}],
  ["waiting",{status:"loading",statusLabel:"Please wait"}],
  ["completed",{status:"success",statusLabel:"Completed"}],
  ["blocked",{status:"blocked",statusLabel:"More information needed"}],
] as const)("%s scene", (kind, extra) => {
  it("renders its supplied copy", () => { render(<VoiceCanvasScene viewModel={base(kind,extra as Partial<VoiceCanvasViewModel>)} />); expect(screen.getByRole("heading",{name:`${kind} title`})).toBeInTheDocument(); expect(screen.getByText(`${kind} helper`)).toBeInTheDocument(); });
});

it("reports choice, action, and text intents without side effects", () => {
  const onChoice=vi.fn(),onPrimary=vi.fn(),onSecondary=vi.fn(),onTextChange=vi.fn();
  render(<VoiceCanvasScene viewModel={base("text-entry",{choices:[{id:"one",label:"One"}],textEntry:{label:"Address",value:""},primaryAction:{label:"Continue"},secondaryAction:{label:"Back"}})} {...{onChoice,onPrimary,onSecondary,onTextChange}} />);
  fireEvent.click(screen.getByRole("button",{name:"One"})); fireEvent.change(screen.getByLabelText("Address"),{target:{value:"Madrid"}}); fireEvent.click(screen.getByRole("button",{name:"Continue"})); fireEvent.click(screen.getByRole("button",{name:"Back"}));
  expect(onChoice).toHaveBeenCalledWith("one"); expect(onTextChange).toHaveBeenCalledWith("Madrid"); expect(onPrimary).toHaveBeenCalledOnce(); expect(onSecondary).toHaveBeenCalledOnce();
});

it("accepts and removes an optional camera photo", () => {
  const onFileChange = vi.fn();
  render(<VoiceCanvasScene
    viewModel={base("text-entry", {
      textEntry: { label: "Problem", value: "Leaking sink" },
      fileEntry: { label: "Add a photo", accept: "image/*", capture: "environment", removeLabel: "Remove photo" },
    })}
    onFileChange={onFileChange}
  />);
  const file = new File(["photo"], "sink.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText("Add a photo"), { target: { files: [file] } });
  expect(onFileChange).toHaveBeenCalledWith(file);
});

it("supports arrow-key navigation between choices", () => {
  render(<VoiceCanvasScene viewModel={base("choice",{choices:[{id:"a",label:"First"},{id:"b",label:"Second"},{id:"c",label:"Disabled",disabled:true}]})} />);
  const first=screen.getByRole("button",{name:"First"}),second=screen.getByRole("button",{name:"Second"}); first.focus(); fireEvent.keyDown(first,{key:"ArrowRight"}); expect(second).toHaveFocus(); fireEvent.keyDown(second,{key:"ArrowDown"}); expect(first).toHaveFocus();
});

it("renders agent presence from supplied copy on non-listening scenes", () => {
  render(<VoiceCanvasScene viewModel={base("place", {
    agentPresence: {
      state: "listening",
      label: "Listening with you",
      description: "You can say Clinic or Pharmacy.",
      accessibleLabel: "VYVA is listening while you choose a ride destination",
      ariaLive: "polite",
    },
    choices: [{ id: "clinic", label: "Clinic" }],
  })} />);
  const region = screen.getByRole("region", { name: "place title" });
  expect(region).toHaveAttribute("data-agent-presence", "true");
  expect(region).toHaveAttribute("data-agent-state", "listening");
  const presence = screen.getByRole("status", { name: "VYVA is listening while you choose a ride destination" });
  expect(presence).toHaveTextContent("Listening with you");
  expect(presence).toHaveTextContent("You can say Clinic or Pharmacy.");
  expect(screen.getByTestId("voice-canvas-agent-orb-place")).toBeInTheDocument();
});

it("can render agent presence visually without announcing it", () => {
  render(<VoiceCanvasScene viewModel={base("review", {
    agentPresence: {
      state: "thinking",
      label: "Checking the ride details",
      ariaLive: "off",
    },
  })} />);
  expect(screen.getByText("Checking the ride details")).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("renders selectable option-card blocks with rich details", () => {
  const onChoice = vi.fn();
  render(<VoiceCanvasScene
    viewModel={base("choice", {
      blocks: [{
        kind: "option-card",
        id: "ride:carecab",
        title: "CareCab",
        subtitle: "Best reputation",
        badge: "Recommended",
        recommended: true,
        description: "Good for appointments",
        details: [
          { id: "pickup", label: "Estimated pickup", value: "12 min", tone: "good" },
          { id: "price", label: "Estimated price", value: "$18-$22" },
        ],
        accessibleLabel: "Choose CareCab, best reputation, estimated pickup 12 minutes",
      }],
    })}
    onChoice={onChoice}
  />);
  const card = screen.getByRole("button", { name: "Choose CareCab, best reputation, estimated pickup 12 minutes" });
  expect(card).toHaveTextContent("CareCab");
  expect(card).toHaveTextContent("Recommended");
  expect(card).toHaveTextContent("Estimated pickup");
  expect(card).toHaveTextContent("12 min");
  fireEvent.click(card);
  expect(onChoice).toHaveBeenCalledWith("ride:carecab");
});

it("supports keyboard navigation between option-card blocks and honors disabled cards", () => {
  render(<VoiceCanvasScene viewModel={base("choice", {
    blocks: [
      { kind: "option-card", id: "first", title: "First provider", accessibleLabel: "First provider" },
      { kind: "option-card", id: "second", title: "Second provider", accessibleLabel: "Second provider", selected: true },
      { kind: "option-card", id: "third", title: "Disabled provider", accessibleLabel: "Disabled provider", disabled: true },
    ],
  })} />);
  const first = screen.getByRole("button", { name: "First provider" });
  const second = screen.getByRole("button", { name: "Second provider" });
  const disabled = screen.getByRole("button", { name: "Disabled provider" });
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowRight" });
  expect(second).toHaveFocus();
  fireEvent.keyDown(second, { key: "ArrowDown" });
  expect(first).toHaveFocus();
  expect(second).toHaveAttribute("aria-pressed", "true");
  expect(disabled).toBeDisabled();
});

it("exposes progress and loading semantics", () => {
  render(<VoiceCanvasScene viewModel={base("waiting",{status:"loading",progress:{current:2,total:4,label:"Step 2 of 4"},primaryAction:{label:"Saving",loading:true}})} />);
  expect(screen.getByRole("progressbar",{name:"Step 2 of 4"})).toHaveAttribute("aria-valuenow","2"); expect(screen.getByRole("region")).toHaveAttribute("aria-busy","true"); expect(screen.getByRole("button",{name:"Saving"})).toBeDisabled();
});

it("keeps long translated labels intact at mobile widths", () => {
  window.innerWidth=320;
  const long="Seleccionar la dirección nueva que todavía no se ha guardado anteriormente";
  render(<VoiceCanvasScene viewModel={base("choice",{choices:[{id:"long",label:long}],primaryAction:{label:"Continuar con esta dirección especialmente larga"}})} />);
  expect(screen.getByRole("button",{name:long})).toHaveTextContent(long); expect(screen.getByRole("button",{name:/Continuar/})).toBeEnabled();
});

it("honours disabled controls and custom screen-reader labels", () => {
  render(<VoiceCanvasScene viewModel={base("text-entry",{textEntry:{label:"Visible",accessibleLabel:"Full destination address",value:"",disabled:true},primaryAction:{label:"Continue",accessibleLabel:"Continue to review",disabled:true}})} />);
  expect(screen.getByLabelText("Full destination address")).toBeDisabled(); expect(screen.getByRole("button",{name:"Continue to review"})).toBeDisabled();
});
