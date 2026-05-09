import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import CategorySort from "./CategorySort";

describe("CategorySort", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLanguage("es");
  });

  it("renders the practice round and starts play without Supabase data", async () => {
    render(<CategorySort userId="" onExit={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Clasifica y Ordena" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Empezar ejercicio" }));

    expect(screen.getByText("Tarjeta 1 de 12")).toBeInTheDocument();
    expect(screen.getByText(/Ordena por/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rojo" })).toBeInTheDocument();
  });
});
