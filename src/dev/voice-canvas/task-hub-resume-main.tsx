import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import ConciergeTaskInboxPage from "../../pages/ConciergeTaskInboxPage";
import "../../index.css";

function initialTaskHubEntry(): string {
  const task = new URLSearchParams(window.location.search).get("task");
  return task
    ? `/concierge/tasks/${encodeURIComponent(task)}`
    : "/concierge/tasks";
}

function LocationProbe() {
  const location = useLocation();
  return (
    <aside
      aria-label="Task hub harness navigation state"
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 50,
        maxWidth: "min(420px, calc(100vw - 24px))",
        borderRadius: 16,
        background: "rgba(255, 255, 255, 0.92)",
        border: "1px solid rgba(90, 83, 72, 0.18)",
        boxShadow: "0 12px 36px rgba(42, 36, 28, 0.12)",
        color: "#4f473d",
        fontSize: 12,
        padding: "8px 10px",
      }}
    >
      <div>
        Path: <span data-testid="task-hub-harness-path">{location.pathname}</span>
      </div>
      <div
        data-testid="task-hub-harness-state"
        style={{ overflowWrap: "anywhere" }}
      >
        State: {JSON.stringify(location.state)}
      </div>
    </aside>
  );
}

function DestinationProbe({ label }: { label: string }) {
  const params = useParams();
  return (
    <main style={{ padding: 32 }}>
      <h1>{label}</h1>
      <p data-testid="task-hub-destination-params">{JSON.stringify(params)}</p>
    </main>
  );
}

function TaskHubResumeHarness() {
  return (
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <MemoryRouter initialEntries={[initialTaskHubEntry()]}>
        <LocationProbe />
        <Routes>
          <Route path="/concierge/tasks" element={<ConciergeTaskInboxPage />} />
          <Route path="/concierge/tasks/:taskKey" element={<ConciergeTaskInboxPage />} />
          <Route
            path="/concierge/shopping"
            element={<DestinationProbe label="Shopping destination" />}
          />
          <Route
            path="/meds/adherence-report"
            element={<DestinationProbe label="Medication report destination" />}
          />
          <Route
            path="/concierge/task/:taskId"
            element={<DestinationProbe label="Concierge saved task destination" />}
          />
          <Route
            path="/concierge"
            element={<DestinationProbe label="Concierge destination" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TaskHubResumeHarness />
  </React.StrictMode>,
);
