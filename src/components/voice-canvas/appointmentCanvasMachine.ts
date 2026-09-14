export type AppointmentCanvasStep="listening"|"provider"|"providerEntry"|"reason"|"dateTime"|"review"|"waiting"|"completed"|"blocked"|"cancelled";
export interface AppointmentProvider{id:string;label:string;description?:string}
export interface AppointmentCanvasDraft{providerId:string;providerName:string;reason:string;dateChoice:string;time:string}
export interface AppointmentCanvasState{step:AppointmentCanvasStep;draft:AppointmentCanvasDraft;requestId:number;resultReference?:string;errorMessage?:string}
export type AppointmentCanvasEvent=
  |{type:"START"}|{type:"CHOOSE_PROVIDER";provider?:AppointmentProvider;newProvider?:boolean}|{type:"CHANGE_PROVIDER";value:string}|{type:"CONTINUE_PROVIDER"}
  |{type:"CHANGE_REASON";value:string}|{type:"CONTINUE_REASON"}|{type:"CHOOSE_DATE";value:string}|{type:"CHANGE_TIME";value:string}|{type:"CONTINUE_DATE_TIME"}
  |{type:"BACK"}|{type:"CANCEL"}|{type:"CONFIRM"}|{type:"RESOLVE";requestId:number;reference?:string}|{type:"REJECT";requestId:number;message?:string}|{type:"RETRY"};
export const emptyAppointmentDraft:AppointmentCanvasDraft={providerId:"",providerName:"",reason:"",dateChoice:"",time:""};
export const initialAppointmentCanvasState:AppointmentCanvasState={step:"listening",draft:emptyAppointmentDraft,requestId:0};
export function appointmentCanvasReducer(state:AppointmentCanvasState,event:AppointmentCanvasEvent):AppointmentCanvasState{
  switch(event.type){
    case"START":return state.step==="listening"?{...state,step:"provider"}:state.step==="cancelled"?{...initialAppointmentCanvasState,draft:{...emptyAppointmentDraft}}:state;
    case"CHOOSE_PROVIDER":if(state.step!=="provider")return state;if(event.newProvider)return{...state,step:"providerEntry",draft:{...state.draft,providerId:"",providerName:""}};return event.provider?{...state,step:"reason",draft:{...state.draft,providerId:event.provider.id,providerName:event.provider.label}}:state;
    case"CHANGE_PROVIDER":return state.step==="providerEntry"?{...state,draft:{...state.draft,providerId:"",providerName:event.value}}:state;
    case"CONTINUE_PROVIDER":return state.step==="providerEntry"&&state.draft.providerName.trim()?{...state,step:"reason"}:state;
    case"CHANGE_REASON":return state.step==="reason"?{...state,draft:{...state.draft,reason:event.value}}:state;
    case"CONTINUE_REASON":return state.step==="reason"&&state.draft.reason.trim()?{...state,step:"dateTime"}:state;
    case"CHOOSE_DATE":return state.step==="dateTime"?{...state,draft:{...state.draft,dateChoice:event.value}}:state;
    case"CHANGE_TIME":return state.step==="dateTime"?{...state,draft:{...state.draft,time:event.value}}:state;
    case"CONTINUE_DATE_TIME":return state.step==="dateTime"&&state.draft.dateChoice&&state.draft.time?{...state,step:"review"}:state;
    case"BACK":if(state.step==="providerEntry")return{...state,step:"provider"};if(state.step==="reason")return{...state,step:state.draft.providerId?"provider":"providerEntry"};if(state.step==="dateTime")return{...state,step:"reason"};if(state.step==="review")return{...state,step:"dateTime"};return state;
    case"CANCEL":return["waiting","completed"].includes(state.step)?state:{...state,step:"cancelled"};
    case"CONFIRM":return state.step==="review"?{...state,step:"waiting",requestId:state.requestId+1,errorMessage:undefined}:state;
    case"RESOLVE":return state.step==="waiting"&&event.requestId===state.requestId?{...state,step:"completed",resultReference:event.reference}:state;
    case"REJECT":return state.step==="waiting"&&event.requestId===state.requestId?{...state,step:"blocked",errorMessage:event.message}:state;
    case"RETRY":return state.step==="blocked"?{...state,step:"review",errorMessage:undefined}:state;
  }
}
export function isRestorableAppointmentState(value:unknown):value is AppointmentCanvasState{if(!value||typeof value!=="object")return false;const state=value as Partial<AppointmentCanvasState>;return typeof state.requestId==="number"&&typeof state.draft==="object"&&typeof state.step==="string"&&["listening","provider","providerEntry","reason","dateTime","review","blocked","cancelled"].includes(state.step)}
