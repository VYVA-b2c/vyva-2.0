export type RideCanvasStep = "listening" | "place" | "address" | "provider" | "dateTime" | "review" | "waiting" | "completed" | "blocked" | "cancelled";

export interface RideRichOptionDetail {
  value?: string;
  tone?: "good" | "neutral" | "caution";
}
export interface RidePlace {
  id: string;
  label: string;
  address: string;
  subtitle?: string;
  pickupEstimate?: RideRichOptionDetail;
  arrivalEstimate?: RideRichOptionDetail;
  priceEstimate?: RideRichOptionDetail;
  reputation?: RideRichOptionDetail;
  accessibilityNote?: RideRichOptionDetail;
  recommended?: boolean;
  voiceAliases?: string[];
}
export interface RideProviderOption {
  id: string;
  label: string;
  subtitle?: string;
  description?: string;
  pickupEstimate?: RideRichOptionDetail;
  arrivalEstimate?: RideRichOptionDetail;
  priceEstimate?: RideRichOptionDetail;
  reputation?: RideRichOptionDetail;
  accessibilityNote?: RideRichOptionDetail;
  recommended?: boolean;
  voiceAliases?: string[];
}
export interface RideCanvasDraft { placeId: string; destination: string; providerId: string; providerName: string; dateChoice: string; time: string; }
export interface RideCanvasState {
  step: RideCanvasStep;
  draft: RideCanvasDraft;
  requestId: number;
  resultReference?: string;
  errorMessage?: string;
}

export type RideCanvasEvent =
  | { type:"START" }
  | { type:"CHOOSE_PLACE"; place?:RidePlace; newAddress?:boolean }
  | { type:"CHANGE_ADDRESS"; value:string }
  | { type:"CONTINUE_ADDRESS" }
  | { type:"CHOOSE_PROVIDER"; provider?:RideProviderOption }
  | { type:"CHOOSE_DATE"; value:string }
  | { type:"CHANGE_TIME"; value:string }
  | { type:"CONTINUE_DATE_TIME" }
  | { type:"BACK" }
  | { type:"CANCEL" }
  | { type:"CONFIRM" }
  | { type:"RESOLVE"; requestId:number; reference?:string }
  | { type:"REJECT"; requestId:number; message?:string }
  | { type:"RETRY" };

export const emptyRideDraft: RideCanvasDraft = { placeId:"",destination:"",providerId:"",providerName:"",dateChoice:"",time:"" };
export const initialRideCanvasState: RideCanvasState = { step:"listening",draft:emptyRideDraft,requestId:0 };

export function rideCanvasReducer(state:RideCanvasState,event:RideCanvasEvent):RideCanvasState {
  switch(event.type) {
    case "START": return state.step === "listening" ? {...state,step:"place"} : state.step === "cancelled" ? {...initialRideCanvasState,draft:{...emptyRideDraft}} : state;
    case "CHOOSE_PLACE":
      if(state.step!=="place") return state;
      if(event.newAddress) return {...state,step:"address",draft:{...state.draft,placeId:"",destination:""}};
      if(!event.place) return state;
      return {...state,step:"provider",draft:{...state.draft,placeId:event.place.id,destination:event.place.address}};
    case "CHANGE_ADDRESS": return state.step === "address" ? {...state,draft:{...state.draft,destination:event.value,placeId:""}} : state;
    case "CONTINUE_ADDRESS": return state.step === "address" && state.draft.destination.trim() ? {...state,step:"provider"} : state;
    case "CHOOSE_PROVIDER":
      if(state.step!=="provider" || !event.provider) return state;
      return {...state,step:"dateTime",draft:{...state.draft,providerId:event.provider.id,providerName:event.provider.label}};
    case "CHOOSE_DATE": return state.step === "dateTime" ? {...state,draft:{...state.draft,dateChoice:event.value}} : state;
    case "CHANGE_TIME": return state.step === "dateTime" ? {...state,draft:{...state.draft,time:event.value}} : state;
    case "CONTINUE_DATE_TIME": return state.step === "dateTime" && state.draft.providerId && state.draft.dateChoice && state.draft.time ? {...state,step:"review"} : state;
    case "BACK":
      if(state.step==="address") return {...state,step:"place"};
      if(state.step==="provider") return {...state,step:state.draft.placeId?"place":"address"};
      if(state.step==="dateTime") return {...state,step:"provider"};
      if(state.step==="review") return {...state,step:"dateTime"};
      return state;
    case "CANCEL": return ["waiting","completed"].includes(state.step) ? state : {...state,step:"cancelled"};
    case "CONFIRM": return state.step === "review" ? {...state,step:"waiting",requestId:state.requestId+1,errorMessage:undefined} : state;
    case "RESOLVE": return state.step === "waiting" && event.requestId===state.requestId ? {...state,step:"completed",resultReference:event.reference} : state;
    case "REJECT": return state.step === "waiting" && event.requestId===state.requestId ? {...state,step:"blocked",errorMessage:event.message} : state;
    case "RETRY": return state.step === "blocked" ? {...state,step:"review",errorMessage:undefined} : state;
    default: return state;
  }
}

export function isRestorableRideState(value:unknown):value is RideCanvasState {
  if(!value || typeof value!=="object") return false;
  const state=value as Partial<RideCanvasState>;
  return typeof state.requestId==="number" && typeof state.draft==="object" && typeof state.step==="string" && ["listening","place","address","provider","dateTime","review","blocked","cancelled"].includes(state.step);
}
