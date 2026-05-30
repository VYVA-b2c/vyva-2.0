import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntroScreen } from "./SymptomCheckScreen";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
  };
});

describe("SymptomCheck intro chips", () => {
  it("refreshes the quick clue chips from the icon button", () => {
    render(<IntroScreen onStart={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Refresh examples" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Bad headache" })).toBeVisible();

    fireEvent.click(screen.getByTestId("button-refresh-symptom-clues"));

    expect(screen.getByRole("button", { name: "Cough" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Bad headache" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-refresh-symptom-clues"));

    expect(screen.getByRole("button", { name: "Vomiting" })).toBeVisible();
  });

  it("keeps refreshed chips selectable", () => {
    render(<IntroScreen onStart={vi.fn()} />);

    fireEvent.click(screen.getByTestId("button-refresh-symptom-clues"));
    fireEvent.click(screen.getByRole("button", { name: "Cough" }));

    expect(screen.getByTestId("input-symptom-clue")).toHaveValue("Cough");
  });
});
