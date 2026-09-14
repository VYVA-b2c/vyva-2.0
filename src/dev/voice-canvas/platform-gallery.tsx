import { useMemo, useState } from "react";
import {
  VoiceCanvasScene,
  type VoiceCanvasViewModel,
} from "../../components/voice-canvas";
import "./platform-gallery.css";

type Flow =
  | "ride"
  | "appointment"
  | "home-service"
  | "refill"
  | "prescription-follow-up"
  | "shopping";
type State = "prepared" | "pending" | "confirmed" | "completed" | "blocked";

const flows: Array<{ id: Flow; label: string }> = [
  { id: "ride", label: "Ride" },
  { id: "appointment", label: "Appointment" },
  { id: "home-service", label: "Home service" },
  { id: "refill", label: "Refill" },
  { id: "prescription-follow-up", label: "Prescription follow-up" },
  { id: "shopping", label: "Shopping" },
];
const states: State[] = [
  "prepared",
  "pending",
  "confirmed",
  "completed",
  "blocked",
];

function scene(
  flow: string,
  state: State,
  spanish: boolean,
): VoiceCanvasViewModel {
  const title = spanish
    ? {
        prepared: "Revisa los detalles",
        pending: "La solicitud está pendiente",
        confirmed: "Estamos procesando tu confirmación",
        completed: "Todo está listo",
        blocked: "Necesitamos un dato más",
      }[state]
    : {
        prepared: "Review the details",
        pending: "The request is pending",
        confirmed: "We are processing your confirmation",
        completed: "Everything is ready",
        blocked: "We need one more detail",
      }[state];
  const waiting = state === "pending" || state === "confirmed";
  return {
    sceneId: `${flow}-${state}`,
    kind:
      state === "prepared"
        ? "review"
        : waiting
          ? "waiting"
          : state === "blocked"
            ? "blocked"
            : "completed",
    title,
    helperText: spanish
      ? "Nada ocurrirá sin tu confirmación explícita. Puedes volver o salir en cualquier momento."
      : "Nothing will happen without your explicit confirmation. You can go back or leave at any time.",
    status: waiting
      ? "loading"
      : state === "blocked"
        ? "blocked"
        : state === "completed"
          ? "success"
          : undefined,
    statusLabel: title,
    summaryRows: [
      { id: "flow", label: spanish ? "Flujo" : "Flow", value: flow },
      { id: "outcome", label: spanish ? "Estado" : "Outcome", value: state },
    ],
    primaryAction: {
      label:
        state === "prepared"
          ? spanish
            ? "Confirmar explícitamente"
            : "Confirm explicitly"
          : spanish
            ? "Continuar"
            : "Continue",
      loading: waiting,
      disabled: waiting,
    },
    secondaryAction: {
      label: spanish ? "Salir de forma segura" : "Exit safely",
    },
  };
}

export function VoiceCanvasPlatformGallery() {
  const [flow, setFlow] = useState<Flow>("ride");
  const [state, setState] = useState<State>("prepared");
  const [spanish, setSpanish] = useState(false);
  const viewModel = useMemo(
    () => scene(flow, state, spanish),
    [flow, state, spanish],
  );
  return (
    <main className="platform-gallery">
      <header>
        <p>VYVA Live Companion Canvas</p>
        <h1>Platform compliance gallery</h1>
        <p>
          All six flows use the same outcome language, safety boundary, and
          responsive presentation.
        </p>
      </header>
      <section
        className="platform-gallery-controls"
        aria-label="Gallery controls"
      >
        <label>
          Flow
          <select
            value={flow}
            onChange={(event) => setFlow(event.target.value as Flow)}
          >
            {flows.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Outcome
          <select
            value={state}
            onChange={(event) => setState(event.target.value as State)}
          >
            {states.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="platform-gallery-check">
          <input
            type="checkbox"
            checked={spanish}
            onChange={(event) => setSpanish(event.target.checked)}
          />
          Spanish long-label check
        </label>
      </section>
      <section
        className="platform-gallery-stage"
        data-flow={flow}
        data-outcome={state}
      >
        <VoiceCanvasScene
          viewModel={viewModel}
          onChoice={() => {}}
          onPrimary={() => {}}
          onSecondary={() => {}}
          onTextChange={() => {}}
        />
      </section>
    </main>
  );
}

export default VoiceCanvasPlatformGallery;
