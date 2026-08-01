export type RefillCanvasStep="listening"|"medication"|"medicationEntry"|"strength"|"safety"|"provider"|"providerEntry"|"quantity"|"notes"|"contact"|"review"|"waiting"|"completed"|"blocked"|"urgent"|"cancelled";
export interface RefillCardDetail{value?:string;tone?:"good"|"neutral"|"caution"}
export interface RefillMedication{id:string;label:string;strength?:string;description?:string;savedLabel?:string;profileLabel?:string;reviewReminder?:string;recommended?:boolean;voiceAliases?:string[]}
export interface RefillProvider{id:string;label:string;kind:"prescriber"|"pharmacy";description?:string;typeLabel?:string;reviewReminder?:string;recommended?:boolean;voiceAliases?:string[]}
export interface RefillCanvasDraft{medicationId:string;medicationName:string;strength:string;providerId:string;providerName:string;providerKind:"prescriber"|"pharmacy"|"";quantity:string;notes:string;contactMethod:string}
export interface RefillCanvasState{step:RefillCanvasStep;draft:RefillCanvasDraft;requestId:number;resultReference?:string;errorMessage?:string;blockedReason?:"identification"|"service"}
export type RefillCanvasEvent=
 |{type:"START"}|{type:"CHOOSE_MEDICATION";medication?:RefillMedication;manual?:boolean}|{type:"CHANGE_MEDICATION";value:string}|{type:"CONTINUE_MEDICATION"}|{type:"CANNOT_IDENTIFY"}
 |{type:"CHANGE_STRENGTH";value:string}|{type:"CONTINUE_STRENGTH"}|{type:"ROUTINE_REFILL"}|{type:"URGENT"}
 |{type:"CHOOSE_PROVIDER";provider?:RefillProvider;manual?:boolean}|{type:"CHANGE_PROVIDER";value:string}|{type:"CONTINUE_PROVIDER"}
 |{type:"CHANGE_QUANTITY";value:string}|{type:"CONTINUE_QUANTITY"}|{type:"CHANGE_NOTES";value:string}|{type:"CONTINUE_NOTES"}|{type:"CHOOSE_CONTACT";value:string}
 |{type:"BACK"}|{type:"CANCEL"}|{type:"CONFIRM"}|{type:"RESOLVE";requestId:number;reference?:string}|{type:"REJECT";requestId:number;message?:string}|{type:"RETRY"};
export const emptyRefillDraft:RefillCanvasDraft={medicationId:"",medicationName:"",strength:"",providerId:"",providerName:"",providerKind:"",quantity:"",notes:"",contactMethod:""};
export const initialRefillCanvasState:RefillCanvasState={step:"listening",draft:emptyRefillDraft,requestId:0};
export function refillCanvasReducer(state:RefillCanvasState,event:RefillCanvasEvent):RefillCanvasState{
 switch(event.type){
  case"START":return state.step==="listening"?{...state,step:"medication"}:state.step==="cancelled"?{...initialRefillCanvasState,step:"medication",draft:{...emptyRefillDraft}}:state;
  case"CHOOSE_MEDICATION":if(state.step!=="medication")return state;if(event.manual)return{...state,step:"medicationEntry",draft:{...state.draft,medicationId:"",medicationName:"",strength:""}};return event.medication?{...state,step:event.medication.strength?.trim()?"safety":"strength",draft:{...state.draft,medicationId:event.medication.id,medicationName:event.medication.label,strength:event.medication.strength?.trim()??""}}:state;
  case"CHANGE_MEDICATION":return state.step==="medicationEntry"?{...state,draft:{...state.draft,medicationId:"",medicationName:event.value}}:state;
  case"CONTINUE_MEDICATION":return state.step==="medicationEntry"&&state.draft.medicationName.trim()?{...state,step:"strength"}:state;
  case"CANNOT_IDENTIFY":return["medication","medicationEntry"].includes(state.step)?{...state,step:"blocked",blockedReason:"identification"}:state;
  case"CHANGE_STRENGTH":return state.step==="strength"?{...state,draft:{...state.draft,strength:event.value}}:state;
  case"CONTINUE_STRENGTH":return state.step==="strength"&&state.draft.strength.trim()?{...state,step:"safety"}:state;
  case"ROUTINE_REFILL":return state.step==="safety"?{...state,step:"provider"}:state;
  case"URGENT":return["waiting","completed"].includes(state.step)?state:{...state,step:"urgent"};
  case"CHOOSE_PROVIDER":if(state.step!=="provider")return state;if(event.manual)return{...state,step:"providerEntry",draft:{...state.draft,providerId:"",providerName:"",providerKind:""}};return event.provider?{...state,step:"quantity",draft:{...state.draft,providerId:event.provider.id,providerName:event.provider.label,providerKind:event.provider.kind}}:state;
  case"CHANGE_PROVIDER":return state.step==="providerEntry"?{...state,draft:{...state.draft,providerId:"",providerName:event.value,providerKind:""}}:state;
  case"CONTINUE_PROVIDER":return state.step==="providerEntry"&&state.draft.providerName.trim()?{...state,step:"quantity"}:state;
  case"CHANGE_QUANTITY":return state.step==="quantity"?{...state,draft:{...state.draft,quantity:event.value}}:state;
  case"CONTINUE_QUANTITY":return state.step==="quantity"&&state.draft.quantity.trim()?{...state,step:"notes"}:state;
  case"CHANGE_NOTES":return state.step==="notes"?{...state,draft:{...state.draft,notes:event.value}}:state;
  case"CONTINUE_NOTES":return state.step==="notes"?{...state,step:"contact"}:state;
  case"CHOOSE_CONTACT":return state.step==="contact"?{...state,step:"review",draft:{...state.draft,contactMethod:event.value}}:state;
  case"BACK":if(state.step==="medicationEntry")return{...state,step:"medication"};if(state.step==="strength")return{...state,step:state.draft.medicationId?"medication":"medicationEntry"};if(state.step==="safety"||state.step==="urgent")return{...state,step:"strength"};if(state.step==="provider")return{...state,step:"safety"};if(state.step==="providerEntry")return{...state,step:"provider"};if(state.step==="quantity")return{...state,step:state.draft.providerId?"provider":"providerEntry"};if(state.step==="notes")return{...state,step:"quantity"};if(state.step==="contact")return{...state,step:"notes"};if(state.step==="review")return{...state,step:"contact"};return state;
  case"CANCEL":return["waiting","completed"].includes(state.step)?state:{...state,step:"cancelled"};
  case"CONFIRM":return state.step==="review"?{...state,step:"waiting",requestId:state.requestId+1,errorMessage:undefined,blockedReason:undefined}:state;
  case"RESOLVE":return state.step==="waiting"&&event.requestId===state.requestId?{...state,step:"completed",resultReference:event.reference}:state;
  case"REJECT":return state.step==="waiting"&&event.requestId===state.requestId?{...state,step:"blocked",blockedReason:"service",errorMessage:event.message}:state;
  case"RETRY":return state.step==="blocked"?{...state,step:state.blockedReason==="identification"?"medication":"review",errorMessage:undefined,blockedReason:undefined}:state;
 }
}
export function isRestorableRefillState(value:unknown):value is RefillCanvasState{if(!value||typeof value!=="object")return false;const state=value as Partial<RefillCanvasState>;return typeof state.requestId==="number"&&typeof state.draft==="object"&&typeof state.step==="string"&&["listening","medication","medicationEntry","strength","safety","provider","providerEntry","quantity","notes","contact","review","blocked","urgent","cancelled"].includes(state.step)}
