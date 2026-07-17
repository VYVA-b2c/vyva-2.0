import { useCallback, useState } from "react";
import { RideVoiceCanvas, type RideCanvasCopy, type RideCanvasState } from "../../components/voice-canvas";
import "./gallery.css";
import "./integration.css";

const copy:RideCanvasCopy={
  listening:{status:"Listening",title:"Where can I help you go?",helper:"Use your voice or choose the button below.",start:"Arrange a ride",cancel:"Not now"},
  place:{title:"Where would you like to go?",helper:"Choose a saved place or enter somewhere new.",newAddress:"A new address",newAddressHelper:"Tell VYVA where you are going",continue:"Continue",back:"Go back"},
  address:{title:"What address should we use?",helper:"Type the full address or just the postcode.",label:"Destination address",placeholder:"Start typing an address",continue:"Continue",back:"Go back"},
  dateTime:{title:"When should the ride arrive?",helper:"Choose the day first, then the time.",timeLabel:"Pickup time",continue:"Review the ride",back:"Go back"},
  review:{title:"Does everything look right?",helper:"Nothing will be requested until you confirm.",destination:"Destination",date:"Date",time:"Time",confirm:"Confirm and prepare ride",change:"Make a change"},
  waiting:{status:"Please wait",title:"Preparing your ride request",helper:"This may take a moment. Please stay on this screen.",action:"Preparing…"},
  completed:{status:"Completed",title:"Your ride request is ready",helper:"The confirmed request has been prepared.",reference:"Reference",done:"Done"},
  blocked:{status:"Needs attention",title:"We could not prepare the ride",helper:"Please review the details and try again.",retry:"Review and retry",cancel:"Cancel"},
  cancelled:{status:"Cancelled",title:"No ride was requested",helper:"Your details have not been sent anywhere.",restart:"Start again"},
  progress:(current,total)=>`Step ${current} of ${total}`,
};

export function VoiceCanvasIntegrationGallery(){
  const [mode,setMode]=useState<"success"|"failure">("success");
  const startsAtReview=new URLSearchParams(window.location.search).has("review");
  const reviewState:RideCanvasState={step:"review",requestId:0,draft:{placeId:"home",destination:"12 Garden Lane",dateChoice:"Saturday, 18 July",time:"10:30"}};
  const confirm=useCallback(async(_:unknown,{signal}:{signal:AbortSignal})=>new Promise<{reference?:string}>((resolve,reject)=>{const timer=window.setTimeout(()=>mode==="success"?resolve({reference:"VYVA-RIDE-2486"}):reject(new Error("The ride service is unavailable right now.")),700);signal.addEventListener("abort",()=>{window.clearTimeout(timer);reject(new DOMException("Aborted","AbortError"));});}),[mode]);
  return <main className="vc-gallery vc-integration-gallery"><header><p>VYVA · Integration v1</p><h1>Live Companion Canvas</h1><span>Safe ride workflow · voice, touch, and keyboard</span></header><div className="vc-demo-toolbar" role="group" aria-label="Result simulation"><button type="button" aria-pressed={mode==="success"} onClick={()=>setMode("success")}>Successful result</button><button type="button" aria-pressed={mode==="failure"} onClick={()=>setMode("failure")}>Blocked result</button></div><div className="vc-gallery-stage"><RideVoiceCanvas copy={copy} places={[{id:"home",label:"Home",address:"12 Garden Lane"},{id:"clinic",label:"Riverside Medical Centre",address:"24 Riverside Road"}]} dateChoices={[{id:"today",label:"Today",value:"Saturday, 18 July"},{id:"tomorrow",label:"Tomorrow",value:"Sunday, 19 July"}]} voiceCommands={{start:["arrange a ride"],back:["go back"],cancel:["cancel"],confirm:["confirm"],retry:["retry"]}} onConfirmRide={confirm} initialState={startsAtReview?reviewState:undefined} storageKey={startsAtReview?`vyva.rideCanvas.reviewDemo${window.location.search}`:"vyva.rideCanvas.gallery"}/></div></main>;
}

export default VoiceCanvasIntegrationGallery;
