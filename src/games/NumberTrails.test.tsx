import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import NumberTrails from "./NumberTrails";

describe("NumberTrails", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLanguage("es");
  });

  it("plays a local practice trail, ignores an out-of-order tap, completes, and exits", async () => {
    const onExit = vi.fn();
    render(<NumberTrails userId="" onExit={onExit} />);

    expect(await screen.findByRole("heading", { name: "Sendero de Números" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(screen.getByText("Ejemplo — sin puntuación")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));
    expect(screen.getByText("Siguiente: 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("Siguiente: 1")).toBeInTheDocument();

    ["1", "2", "3", "4", "5"].forEach((label) => {
      fireEvent.click(screen.getByRole("button", { name: label }));
    });

    expect(await screen.findByText("¡Qué rapidez mental!")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
