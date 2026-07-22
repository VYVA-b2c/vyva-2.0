import { useState } from "react";
import { CalendarDays, Clock, Home, MapPin, Navigation } from "lucide-react";
import { VoiceCanvasScene, type VoiceCanvasViewModel } from "../../components/voice-canvas";
import "./gallery.css";

const scenes: VoiceCanvasViewModel[] = [
  { sceneId:"listen", kind:"listening", title:"I’m listening", helperText:"Take your time. You can speak whenever you’re ready.", status:"listening", statusLabel:"Listening" },
  { sceneId:"choice", kind:"choice", title:"Which would you prefer?", helperText:"Choose one option to continue.", progress:{current:1,total:3,label:"Step 1 of 3"}, choices:[{id:"morning",label:"This morning",icon:Clock},{id:"afternoon",label:"This afternoon",icon:CalendarDays}], primaryAction:{label:"Continue"} },
  { sceneId:"place", kind:"place", title:"Where would you like to go?", helperText:"Choose a saved place or enter somewhere new.", agentPresence:{state:"listening",label:"Listening with you",description:"You can speak or tap a destination.",accessibleLabel:"VYVA is listening while you choose a destination"}, choices:[{id:"home",label:"Home",description:"12 Garden Lane",icon:Home,selected:true},{id:"clinic",label:"Health centre",description:"Riverside Medical Centre",icon:MapPin},{id:"new",label:"A new address",description:"Tell VYVA where you’re going",icon:Navigation}], primaryAction:{label:"Use this place"},secondaryAction:{label:"Go back"} },
  { sceneId:"date", kind:"date-time", title:"When should it happen?", helperText:"Choose the date first, then the time.", choices:[{id:"today",label:"Today",icon:CalendarDays},{id:"tomorrow",label:"Tomorrow",icon:CalendarDays}], textEntry:{label:"Time",value:"10:30",type:"time",accessibleLabel:"Choose a time"}, primaryAction:{label:"Continue"} },
  { sceneId:"text", kind:"text-entry", title:"What address should we use?", helperText:"You can type the full address or just the postcode.", textEntry:{label:"Address",value:"",placeholder:"Start typing an address",accessibleLabel:"Destination address"},primaryAction:{label:"Continue",disabled:true},secondaryAction:{label:"Go back"} },
  { sceneId:"review", kind:"review", title:"Does everything look right?", helperText:"Nothing will happen until you confirm.", progress:{current:3,total:3,label:"Step 3 of 3"},summaryRows:[{id:"place",label:"Destination",value:"Riverside Medical Centre"},{id:"date",label:"Date",value:"Tuesday, 21 July"},{id:"time",label:"Time",value:"10:30 AM"}],primaryAction:{label:"Confirm details"},secondaryAction:{label:"Make a change"} },
  { sceneId:"waiting", kind:"waiting", title:"Checking the details", helperText:"This may take a moment. You can stay on this screen.", status:"loading",statusLabel:"Please wait",primaryAction:{label:"Checking…",loading:true},secondaryAction:{label:"Cancel"} },
  { sceneId:"done", kind:"completed", title:"Everything is ready", helperText:"Your details have been confirmed.",status:"success",statusLabel:"Completed",summaryRows:[{id:"ref",label:"Reference",value:"VYVA 2486"}],primaryAction:{label:"Done"} },
  { sceneId:"blocked", kind:"blocked", title:"We need one more detail", helperText:"Please add a phone number before continuing.",status:"blocked",statusLabel:"More information needed",primaryAction:{label:"Add phone number"},secondaryAction:{label:"Not now"} },
];

export function VoiceCanvasGallery() {
  const [selected, setSelected] = useState(0);
  const [text, setText] = useState("");
  const scene = scenes[selected];
  const viewModel = scene.sceneId === "text" ? { ...scene, textEntry:{ ...scene.textEntry!, value:text }, primaryAction:{...scene.primaryAction!,disabled:!text.trim()} } : scene;
  return <main className="vc-gallery">
    <header><p>VYVA · Visual Kit v1</p><h1>Voice Canvas scenes</h1><span>Presentation-only component gallery</span></header>
    <nav aria-label="Choose a scene">{scenes.map((item,index)=><button key={item.sceneId} type="button" aria-current={selected===index?"page":undefined} onClick={()=>setSelected(index)}>{index+1}. {item.kind}</button>)}</nav>
    <div className="vc-gallery-stage"><VoiceCanvasScene viewModel={viewModel} onChoice={()=>{}} onPrimary={()=>{}} onSecondary={()=>{}} onTextChange={setText} /></div>
  </main>;
}

export default VoiceCanvasGallery;
