import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import NumberTrails, { pickFreshNumberTrailConfig } from "./NumberTrails";

function tapCurrentTrail(labels = ["1", "2", "3", "4", "5"]) {
  labels.forEach((label) => {
    fireEvent.click(screen.getByRole("button", { name: label }));
  });
}

function nodePosition(label: string) {
  const node = screen.getByRole("button", { name: label });
  return `${node.style.left}:${node.style.top}`;
}

describe("NumberTrails", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLanguage("es");
  });

  it("plays a local practice trail, ignores an out-of-order tap, completes, and exits", async () => {
    const onExit = vi.fn();
    render(<NumberTrails userId="" onExit={onExit} />);

    expect(await screen.findByRole("heading", { name: /Sendero/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(screen.getByText("Ejemplo de practica - sin puntuacion")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));
    expect(screen.getByText("Siguiente punto: 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("Siguiente punto: 1")).toBeInTheDocument();

    tapCurrentTrail();

    expect(await screen.findByText("Buena orientacion.")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Siguiente sendero" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar este sendero" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Terminar" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Jugar otro juego" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  }, 10_000);

  it("shows the practice example once, then starts future trails directly", async () => {
    render(<NumberTrails userId="" />);

    expect(await screen.findByRole("heading", { name: /Sendero/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(screen.getByText("Ejemplo de practica - sin puntuacion")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));
    expect(window.localStorage.getItem("numberTrails:tutorialSeen:v1")).toBe("true");
    expect(screen.getByText("Siguiente punto: 1")).toBeInTheDocument();

    tapCurrentTrail();
    expect(await screen.findByText("Buena orientacion.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente sendero" }));
    expect(await screen.findByRole("heading", { name: /Sendero/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(screen.queryByText("Ejemplo de practica - sin puntuacion")).not.toBeInTheDocument();
    expect(screen.getByText("Siguiente punto: 1")).toBeInTheDocument();
  }, 10_000);

  it("uses a fresh local trail for next trail and keeps replay intentional", async () => {
    render(<NumberTrails userId="" />);

    expect(await screen.findByRole("heading", { name: /Sendero/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));

    const firstTrailPosition = nodePosition("1");
    tapCurrentTrail();
    expect(await screen.findByText("Buena orientacion.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar este sendero" }));
    expect(await screen.findByRole("heading", { name: /Sendero/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(nodePosition("1")).toBe(firstTrailPosition);

    tapCurrentTrail();
    expect(await screen.findByText("Buena orientacion.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente sendero" }));
    expect(await screen.findByRole("heading", { name: /Sendero/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(nodePosition("1")).not.toBe(firstTrailPosition);
  }, 10_000);

  it("prefers database configs outside the recent local guard", () => {
    const selected = pickFreshNumberTrailConfig(
      [
        { id: "already-used", nodes: [] },
        { id: "fresh-config", nodes: [] },
      ],
      ["already-used"],
    );

    expect(selected?.id).toBe("fresh-config");
  });
});
