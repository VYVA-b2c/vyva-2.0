import { CalendarDays, Home, MapPin, Navigation } from "lucide-react";
import type { VoiceCanvasAgentPresenceCopy, VoiceCanvasViewModel } from "./types";
import type { RideCanvasState, RidePlace } from "./rideCanvasMachine";

export interface RideCanvasCopy {
  agentPresence: VoiceCanvasAgentPresenceCopy;
  listening:{status:string;title:string;helper:string;start:string;cancel:string};
  place:{title:string;helper:string;newAddress:string;newAddressHelper:string;continue:string;back:string};
  address:{title:string;helper:string;label:string;placeholder:string;continue:string;back:string};
  dateTime:{title:string;helper:string;timeLabel:string;continue:string;back:string};
  review:{title:string;helper:string;destination:string;date:string;time:string;confirm:string;change:string};
  waiting:{status:string;title:string;helper:string;action:string};
  completed:{status:string;title:string;helper:string;reference:string;done:string};
  blocked:{status:string;title:string;helper:string;retry:string;cancel:string};
  cancelled:{status:string;title:string;helper:string;restart:string};
  progress:(current:number,total:number)=>string;
}

export interface RideDateChoice { id:string; label:string; value:string; }

export function rideCanvasViewModel(state:RideCanvasState,copy:RideCanvasCopy,places:RidePlace[],dates:RideDateChoice[]):VoiceCanvasViewModel {
  const progress=(current:number)=>({current,total:4,label:copy.progress(current,4)});
  switch(state.step) {
    case "listening": return {sceneId:"ride-listening",kind:"listening",title:copy.listening.title,helperText:copy.listening.helper,status:"listening",statusLabel:copy.listening.status,primaryAction:{label:copy.listening.start},secondaryAction:{label:copy.listening.cancel}};
    case "place": return {sceneId:"ride-place",kind:"place",title:copy.place.title,helperText:copy.place.helper,progress:progress(1),choices:[...places.map(place=>({id:`place:${place.id}`,label:place.label,description:place.address,accessibleLabel:place.label,selected:state.draft.placeId===place.id,icon:place.id==="home"?Home:MapPin})),{id:"new-address",label:copy.place.newAddress,description:copy.place.newAddressHelper,accessibleLabel:copy.place.newAddress,icon:Navigation}],secondaryAction:{label:copy.place.back}};
    case "address": return {sceneId:"ride-address",kind:"text-entry",title:copy.address.title,helperText:copy.address.helper,progress:progress(1),textEntry:{label:copy.address.label,value:state.draft.destination,placeholder:copy.address.placeholder,accessibleLabel:copy.address.label},primaryAction:{label:copy.address.continue,disabled:!state.draft.destination.trim()},secondaryAction:{label:copy.address.back}};
    case "dateTime": return {sceneId:"ride-date-time",kind:"date-time",title:copy.dateTime.title,helperText:copy.dateTime.helper,progress:progress(2),choices:dates.map(date=>({id:`date:${date.id}`,label:date.label,accessibleLabel:date.label,selected:state.draft.dateChoice===date.value,icon:CalendarDays})),textEntry:{label:copy.dateTime.timeLabel,value:state.draft.time,type:"time",accessibleLabel:copy.dateTime.timeLabel},primaryAction:{label:copy.dateTime.continue,disabled:!state.draft.dateChoice||!state.draft.time},secondaryAction:{label:copy.dateTime.back}};
    case "review": return {sceneId:"ride-review",kind:"review",title:copy.review.title,helperText:copy.review.helper,progress:progress(3),summaryRows:[{id:"destination",label:copy.review.destination,value:state.draft.destination},{id:"date",label:copy.review.date,value:state.draft.dateChoice},{id:"time",label:copy.review.time,value:state.draft.time}],primaryAction:{label:copy.review.confirm},secondaryAction:{label:copy.review.change}};
    case "waiting": return {sceneId:"ride-waiting",kind:"waiting",title:copy.waiting.title,helperText:copy.waiting.helper,status:"loading",statusLabel:copy.waiting.status,primaryAction:{label:copy.waiting.action,loading:true}};
    case "completed": return {sceneId:"ride-completed",kind:"completed",title:copy.completed.title,helperText:copy.completed.helper,status:"success",statusLabel:copy.completed.status,summaryRows:state.resultReference?[{id:"reference",label:copy.completed.reference,value:state.resultReference}]:[],primaryAction:{label:copy.completed.done}};
    case "blocked": return {sceneId:"ride-blocked",kind:"blocked",title:copy.blocked.title,helperText:state.errorMessage||copy.blocked.helper,status:"blocked",statusLabel:copy.blocked.status,primaryAction:{label:copy.blocked.retry},secondaryAction:{label:copy.blocked.cancel}};
    case "cancelled": return {sceneId:"ride-cancelled",kind:"blocked",title:copy.cancelled.title,helperText:copy.cancelled.helper,status:"idle",statusLabel:copy.cancelled.status,primaryAction:{label:copy.cancelled.restart}};
  }
}
