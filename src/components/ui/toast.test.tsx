import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast";

describe("Toast text layout", () => {
  it("wraps localized titles and descriptions on narrow screens", () => {
    render(
      <ToastProvider>
        <Toast open>
          <div className="min-w-0 flex-1">
            <ToastTitle>Vérification de sécurité mise à jour</ToastTitle>
            <ToastDescription>
              Toutes les doses d&apos;aujourd&apos;hui sont déjà marquées comme
              prises.
            </ToastDescription>
          </div>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );

    expect(
      screen.getByText("Vérification de sécurité mise à jour"),
    ).toHaveClass("min-w-0", "whitespace-normal", "break-words");
    expect(
      screen.getByText(
        "Toutes les doses d'aujourd'hui sont déjà marquées comme prises.",
      ),
    ).toHaveClass("min-w-0", "whitespace-normal", "break-words");
  });
});
