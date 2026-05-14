import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const SECTION_VOICE_AUTO_START_KEY = "autoStartSectionVoice";

type RouteVoiceState = Record<string, unknown>;

export function useRouteVoiceAutoStart(stateKey = SECTION_VOICE_AUTO_START_KEY) {
  const location = useLocation();
  const navigate = useNavigate();
  const consumedRef = useRef(false);
  const [shouldAutoStart, setShouldAutoStart] = useState(false);

  useEffect(() => {
    const routeState = location.state as RouteVoiceState | null;
    if (routeState?.[stateKey] !== true || consumedRef.current) return;

    consumedRef.current = true;
    setShouldAutoStart(true);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate, stateKey]);

  return shouldAutoStart;
}
