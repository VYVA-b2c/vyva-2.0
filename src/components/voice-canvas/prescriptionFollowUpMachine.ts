import type{RefillCanvasDraft}from"./refillCanvasMachine";
export type PrescriptionFollowUpStep="listening"|"nextStep"|"missingInfo"|"review"|"waiting"|"completed"|"pending"|"blocked"|"cancelled";
export type PrescriptionFollowUpAction="clinician"|"pharmacy"|"status"|"update"|"";
export interface PrescriptionFollowUpSource{preparationReference:string;draft:RefillCanvasDraft;preparationStatus:"prepared"}
export interface PrescriptionFollowUpDraft{action:PrescriptionFollowUpAction;missingInformation:string}
export interface PrescriptionFollowUpState{step:PrescriptionFollowUpStep;source:PrescriptionFollowUpSource;draft:PrescriptionFollowUpDraft;requestId:number;resultReference?:string;errorMessage?:string}
export type PrescriptionFollowUpEvent={type:"START"}|{type:"CHOOSE_ACTION";action:Exclude<PrescriptionFollowUpAction,"">}|{type:"CHANGE_MISSING_INFO";value:string}|{type:"CONTINUE"}|{type:"BACK"}|{type:"CANCEL"}|{type:"CONFIRM"}|{type:"RESOLVE";requestId:number;outcome:"completed"|"pending";reference?:string}|{type:"REJECT";requestId:number;message?:string}|{type:"RETRY"};
export const initialPrescriptionFollowUpState=(source:PrescriptionFollowUpSource):PrescriptionFollowUpState=>({step:"listening",source,draft:{action:"",missingInformation:""},requestId:0});
export function prescriptionFollowUpReducer(state:PrescriptionFollowUpState,event:PrescriptionFollowUpEvent):PrescriptionFollowUpState{switch(event.type){
 case"START":return state.step==="listening"||state.step==="cancelled"?{...state,step:"nextStep",draft:{action:"",missingInformation:""}}:state;
 case"CHOOSE_ACTION":return state.step==="nextStep"?{...state,step:event.action==="update"?"missingInfo":"review",draft:{...state.draft,action:event.action}}:state;
 case"CHANGE_MISSING_INFO":return state.step==="missingInfo"?{...state,draft:{...state.draft,missingInformation:event.value}}:state;
 case"CONTINUE":return state.step==="missingInfo"&&state.draft.missingInformation.trim()?{...state,step:"review"}:state;
 case"BACK":if(state.step==="missingInfo")return{...state,step:"nextStep"};if(state.step==="review")return{...state,step:state.draft.action==="update"?"missingInfo":"nextStep"};return state;
 case"CANCEL":return["waiting","completed","pending"].includes(state.step)?state:{...state,step:"cancelled"};
 case"CONFIRM":return state.step==="review"?{...state,step:"waiting",requestId:state.requestId+1,errorMessage:undefined}:state;
 case"RESOLVE":return state.step==="waiting"&&event.requestId===state.requestId?{...state,step:event.outcome,resultReference:event.reference}:state;
 case"REJECT":return state.step==="waiting"&&event.requestId===state.requestId?{...state,step:"blocked",errorMessage:event.message}:state;
 case"RETRY":return state.step==="blocked"?{...state,step:"review",errorMessage:undefined}:state;
}}
export function isRestorablePrescriptionFollowUpState(value:unknown):value is PrescriptionFollowUpState{if(!value||typeof value!=="object")return false;const state=value as Partial<PrescriptionFollowUpState>;return typeof state.requestId==="number"&&!!state.source&&state.source.preparationStatus==="prepared"&&!!state.draft&&typeof state.step==="string"&&["listening","nextStep","missingInfo","review","blocked","cancelled"].includes(state.step)}
