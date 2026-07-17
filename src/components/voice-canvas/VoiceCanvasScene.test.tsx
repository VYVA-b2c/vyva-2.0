import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceCanvasScene } from "./VoiceCanvasScene";
import type { VoiceCanvasSceneKind, VoiceCanvasViewModel } from "./types";

vi.mock("@/components/ZamoraVoiceOrb", () => ({ default: () => <div data-testid="mock-vyva-orb" /> }));

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

it("supports arrow-key navigation between choices", () => {
  render(<VoiceCanvasScene viewModel={base("choice",{choices:[{id:"a",label:"First"},{id:"b",label:"Second"},{id:"c",label:"Disabled",disabled:true}]})} />);
  const first=screen.getByRole("button",{name:"First"}),second=screen.getByRole("button",{name:"Second"}); first.focus(); fireEvent.keyDown(first,{key:"ArrowRight"}); expect(second).toHaveFocus(); fireEvent.keyDown(second,{key:"ArrowDown"}); expect(first).toHaveFocus();
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
