import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import VoiceCanvasPlatformGallery from "./platform-gallery";
import "../../index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VoiceCanvasPlatformGallery />
  </StrictMode>,
);
