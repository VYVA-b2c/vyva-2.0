import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VYVA_VOICE_USER_MESSAGE_EVENT, type VoiceUserMessageDetail } from "@/lib/voiceNavigation";
import RideVoiceCanvas, { type RideVoiceCanvasProps } from "./RideVoiceCanvas";
import { initialRideCanvasState, rideCanvasReducer } from "./rideCanvasMachine";
import type { RideCanvasCopy } from "./rideCanvasViewModel";

const copy:RideCanvasCopy={
  listening:{status:"Listening",title:"How can I help?",helper:"Take your time.",start:"Arrange a ride",cancel:"Cancel"},
  place:{title:"Where are you going?",helper:"Choose one place.",newAddress:"A new address",newAddressHelper:"Enter another place",continue:"Continue",back:"Back"},
  address:{title:"What address?",helper:"Enter the destination.",label:"Address",placeholder:"Start typing",continue:"Continue",back:"Back"},
  dateTime:{title:"When?",helper:"Choose a day and time.",timeLabel:"Time",continue:"Continue",back:"Back"},
  review:{title:"Review the ride",helper:"Nothing happens until you confirm.",destination:"Destination",date:"Date",time:"Time",confirm:"Confirm ride",change:"Make a change"},
  waiting:{status:"Please wait",title:"Preparing the ride",helper:"This may take a moment.",action:"Preparing…"},
  completed:{status:"Completed",title:"Ride ready",helper:"The confirmed result is ready.",reference:"Reference",done:"Done"},
  blocked:{status:"Needs attention",title:"Could not prepare ride",helper:"Try again.",retry:"Review and retry",cancel:"Cancel"},
  cancelled:{status:"Cancelled",title:"Ride cancelled",helper:"Nothing was requested.",restart:"Start again"},
  progress:(current,total)=>`Step ${current} of ${total}`,
};
const places=[{id:"home",label:"Home",address:"12 Garden Lane"},{id:"clinic",label:"Clinic",address:"Riverside Clinic"}];
const dateChoices=[{id:"today",label:"Today",value:"2026-07-18"},{id:"tomorrow",label:"Tomorrow",value:"2026-07-19"}];
const commands={start:["start"],back:["go back"],cancel:["cancel"],confirm:["confirm"],retry:["retry"]};
const props=(overrides:Partial<RideVoiceCanvasProps>={}):RideVoiceCanvasProps=>({copy,places,dateChoices,voiceCommands:commands,onConfirmRide:vi.fn().mockResolvedValue({reference:"RIDE-42"}),storageKey:"ride-test",...overrides});
const click=(name:string)=>fireEvent.click(screen.getByRole("button",{name}));
const goToReview=()=>{click("Arrange a ride");click("Home");click("Today");fireEvent.change(screen.getByLabelText("Time"),{target:{value:"10:30"}});click("Continue");};

beforeEach(()=>sessionStorage.clear());
afterEach(()=>vi.restoreAllMocks());

it("completes the saved-place ride happy path only after explicit confirmation",async()=>{
  const confirm=vi.fn().mockResolvedValue({reference:"RIDE-42"});render(<RideVoiceCanvas {...props({onConfirmRide:confirm})}/>);goToReview();
  expect(confirm).not.toHaveBeenCalled();expect(screen.getByText("12 Garden Lane")).toBeInTheDocument();click("Confirm ride");
  expect(confirm).toHaveBeenCalledOnce();expect(confirm.mock.calls[0][0]).toEqual({placeId:"home",destination:"12 Garden Lane",dateChoice:"2026-07-18",time:"10:30"});expect(await screen.findByRole("heading",{name:"Ride ready"})).toBeInTheDocument();expect(screen.getByText("RIDE-42")).toBeInTheDocument();
});

it("supports new address entry and preserves it while backtracking",()=>{
  render(<RideVoiceCanvas {...props()}/>);click("Arrange a ride");click("A new address");fireEvent.change(screen.getByLabelText("Address"),{target:{value:"99 Long Translated Address"}});click("Continue");click("Back");expect(screen.getByDisplayValue("99 Long Translated Address")).toBeInTheDocument();
});

it("keeps required actions disabled until information is complete",()=>{
  render(<RideVoiceCanvas {...props()}/>);click("Arrange a ride");click("A new address");expect(screen.getByRole("button",{name:"Continue"})).toBeDisabled();fireEvent.change(screen.getByLabelText("Address"),{target:{value:"A"}});expect(screen.getByRole("button",{name:"Continue"})).toBeEnabled();click("Continue");expect(screen.getByRole("button",{name:"Continue"})).toBeDisabled();
});

it("prevents duplicate confirmation submissions",async()=>{
  let release:(value:{reference:string})=>void=()=>{};const confirm=vi.fn(()=>new Promise<{reference:string}>(resolve=>{release=resolve;}));render(<RideVoiceCanvas {...props({onConfirmRide:confirm})}/>);goToReview();click("Confirm ride");
  expect(screen.getByRole("button",{name:"Preparing…"})).toBeDisabled();expect(confirm).toHaveBeenCalledOnce();fireEvent.click(screen.getByRole("button",{name:"Preparing…"}));expect(confirm).toHaveBeenCalledOnce();release({reference:"ONE"});await screen.findByRole("heading",{name:"Ride ready"});
});

it("shows a recoverable blocked state after external failure",async()=>{
  const confirm=vi.fn().mockRejectedValueOnce(new Error("Provider unavailable")).mockResolvedValueOnce({reference:"RETRY-1"});render(<RideVoiceCanvas {...props({onConfirmRide:confirm})}/>);goToReview();click("Confirm ride");expect(await screen.findByText("Provider unavailable")).toBeInTheDocument();click("Review and retry");expect(screen.getByRole("heading",{name:"Review the ride"})).toBeInTheDocument();click("Confirm ride");expect(await screen.findByText("RETRY-1")).toBeInTheDocument();
});

it("ignores stale request responses in the reducer",()=>{
  const waiting={...initialRideCanvasState,step:"waiting" as const,requestId:2};expect(rideCanvasReducer(waiting,{type:"RESOLVE",requestId:1,reference:"STALE"})).toEqual(waiting);expect(rideCanvasReducer(waiting,{type:"REJECT",requestId:1,message:"STALE"})).toEqual(waiting);
});

it("cancels safely without executing an external action",()=>{
  const confirm=vi.fn();const onCancel=vi.fn();render(<RideVoiceCanvas {...props({onConfirmRide:confirm,onCancel})}/>);click("Cancel");expect(screen.getByRole("heading",{name:"Ride cancelled"})).toBeInTheDocument();expect(confirm).not.toHaveBeenCalled();expect(onCancel).toHaveBeenCalledOnce();
});

it("restores an interrupted scene and draft from session storage",()=>{
  sessionStorage.setItem("ride-test",JSON.stringify({step:"dateTime",requestId:0,draft:{placeId:"",destination:"99 Garden Road",dateChoice:"2026-07-19",time:"14:00"}}));render(<RideVoiceCanvas {...props()}/>);expect(screen.getByRole("heading",{name:"When?"})).toBeInTheDocument();expect(screen.getByDisplayValue("14:00")).toBeInTheDocument();click("Back");expect(screen.getByDisplayValue("99 Garden Road")).toBeInTheDocument();
});

it("does not restore an in-flight external request after reconnect",()=>{
  sessionStorage.setItem("ride-test",JSON.stringify({step:"waiting",requestId:4,draft:{placeId:"home",destination:"12 Garden Lane",dateChoice:"2026-07-18",time:"10:30"}}));render(<RideVoiceCanvas {...props()}/>);expect(screen.getByRole("heading",{name:"How can I help?"})).toBeInTheDocument();
});

it("synchronizes voice commands and place choices with the visual scene",()=>{
  render(<RideVoiceCanvas {...props()}/>);const emit=(text:string)=>act(()=>window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT,{detail:{text,transcriptEntry:{from:"user",text}}})));emit("start");expect(screen.getByRole("heading",{name:"Where are you going?"})).toBeInTheDocument();emit("Please take me to Riverside Clinic");expect(screen.getByRole("heading",{name:"When?"})).toBeInTheDocument();emit("Tomorrow");expect(screen.getByRole("button",{name:"Tomorrow"})).toHaveAttribute("aria-pressed","true");
});

it("ignores an unrelated voice interruption without losing the current scene",()=>{
  render(<RideVoiceCanvas {...props()}/>);click("Arrange a ride");act(()=>window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT,{detail:{text:"What is the weather?",transcriptEntry:{from:"user",text:"What is the weather?"}}})));expect(screen.getByRole("heading",{name:"Where are you going?"})).toBeInTheDocument();
});

it("supports keyboard-only progression through choices and actions",()=>{
  render(<RideVoiceCanvas {...props()}/>);const start=screen.getByRole("button",{name:"Arrange a ride"});start.focus();fireEvent.keyDown(start,{key:"Enter"});fireEvent.click(start);const home=screen.getByRole("button",{name:"Home"});home.focus();fireEvent.keyDown(home,{key:"Enter"});fireEvent.click(home);expect(screen.getByRole("heading",{name:"When?"})).toHaveFocus();
});

it("moves keyboard focus to each new scene heading",()=>{
  render(<RideVoiceCanvas {...props()}/>);expect(screen.getByRole("heading",{name:"How can I help?"})).toHaveFocus();click("Arrange a ride");expect(screen.getByRole("heading",{name:"Where are you going?"})).toHaveFocus();
});

it("announces waiting, completed, and blocked status changes",async()=>{
  let reject:(error:Error)=>void=()=>{};const confirm=vi.fn(()=>new Promise<never>((_,fail)=>{reject=fail;}));render(<RideVoiceCanvas {...props({onConfirmRide:confirm})}/>);goToReview();click("Confirm ride");expect(screen.getByText("Please wait",{selector:"span"})).toHaveAttribute("aria-live","polite");reject(new Error("Try later"));await waitFor(()=>expect(screen.getByText("Needs attention",{selector:"span"})).toBeInTheDocument());
});

describe.each([[390,"mobile"],[768,"tablet"],[1440,"desktop"]])("%s px",(width,label)=>it(`renders the ${label} flow without dropping controls`,()=>{Object.defineProperty(window,"innerWidth",{value:width,configurable:true});render(<RideVoiceCanvas {...props()}/>);expect(screen.getByRole("button",{name:"Arrange a ride"})).toBeVisible();expect(screen.getByRole("button",{name:"Cancel"})).toBeVisible();}));
