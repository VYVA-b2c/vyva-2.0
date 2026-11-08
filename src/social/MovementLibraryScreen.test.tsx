import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MovementLibraryScreen, { MOVEMENT_LIBRARY_PATH, MOVEMENT_PREVIEW_PATH } from "./MovementLibraryScreen";

const language = vi.hoisted(() => ({ value: "en" }));
vi.mock("@/i18n", () => ({ useLanguage: () => ({ language: language.value }) }));

function ExerciseDestination() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><div data-testid="destination">{location.pathname}</div><button onClick={() => navigate(location.state.returnTo)}>Back to library</button></>;
}

function renderLibrary(preview = false) {
  const base = preview ? MOVEMENT_PREVIEW_PATH : MOVEMENT_LIBRARY_PATH;
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[base]}>
    <Routes>
      <Route path={base} element={<MovementLibraryScreen preview={preview} />} />
      <Route path={`${base}/exercises/:exerciseId`} element={<ExerciseDestination />} />
      <Route path="/social-rooms" element={<div>Community destination</div>} />
    </Routes>
  </MemoryRouter>);
}

beforeEach(() => { language.value = "en"; });
afterEach(cleanup);

it("uses the canonical header and starts with four compact categories on the actual page", () => {
  renderLibrary();
  expect(screen.getByTestId("movement-library-screen")).toHaveAttribute("data-header-contract", "detail.voice-touch");
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  for (const name of ["Mobility", "Balance", "Strength", "Calm"]) {
    expect(screen.getByRole("button", { name: `${name} 3 exercises` })).toHaveAttribute("aria-expanded", "false");
  }
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("makes every one of the 12 exercises reachable through its production route", () => {
  renderLibrary();
  const expected = {
    Mobility: ["chair-yoga", "ankle-mobility", "chest-opener"],
    Balance: ["tai-chi", "heel-raises", "side-steps"],
    Strength: ["seated-strength", "sit-to-stand", "wall-push-ups"],
    Calm: ["calm-breathing", "hand-breathing", "shoulder-release"],
  };
  for (const [group, ids] of Object.entries(expected)) {
    fireEvent.click(screen.getByRole("button", { name: `${group} 3 exercises` }));
    expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(1);
    expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(ids.map(id => `${MOVEMENT_LIBRARY_PATH}/exercises/${id}`));
  }
});

it.each([false, true])("returns to the same category after selecting an exercise (preview=%s)", (preview) => {
  renderLibrary(preview);
  fireEvent.click(screen.getByRole("button", { name: "Calm 3 exercises" }));
  fireEvent.click(screen.getByRole("link", { name: /Shoulder release/ }));
  expect(screen.getByTestId("destination")).toHaveTextContent(`${preview ? MOVEMENT_PREVIEW_PATH : MOVEMENT_LIBRARY_PATH}/exercises/shoulder-release`);
  fireEvent.click(screen.getByRole("button", { name: "Back to library" }));
  expect(screen.getByRole("button", { name: "Calm 3 exercises" })).toHaveAttribute("aria-expanded", "true");
});

it("takes the actual page's back button to Community", () => {
  renderLibrary();
  fireEvent.click(screen.getByRole("button", { name: "Back", exact: true }));
  expect(screen.getByText("Community destination")).toBeInTheDocument();
});

it("uses the selected app language on the actual page", () => {
  language.value = "es";
  renderLibrary();
  expect(screen.getByRole("heading", { name: "Movimiento", level: 1 })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Movilidad 3 ejercicios" })).toBeInTheDocument();
});
