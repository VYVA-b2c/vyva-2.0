import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import { LANGUAGES } from "@/i18n/languages";
import { sharedControls } from "@/i18n/sharedControls";
import MedicationRefillAlertCard from "./MedicationRefillAlertCard";

afterEach(() => { cleanup(); setLanguage("en"); });

describe("localized refill alerts on every consuming page", () => {
  for (const { code } of LANGUAGES) {
    it.each(["refill_soon", "refill_now", "uncertain"] as const)(`${code}: renders %s from structured data, not stored English copy`, (status) => {
      setLanguage(code);
      render(<MedicationRefillAlertCard alert={{
        id: "test-alert", medicineId: "test-med", medicineName: "ExampleMed", status,
        title: "Stored English title", message: "Stored English message",
        daysRemaining: status === "uncertain" ? null : 5, projectedRunOutDate: null, createdAt: "2026-10-05T00:00:00Z",
      }} canManage onOpen={vi.fn()} />);
      const title = status === "refill_now" ? sharedControls[code].titleNow : status === "uncertain" ? sharedControls[code].titleCheck : sharedControls[code].titleSoon;
      expect(screen.getByRole("heading")).toHaveTextContent(title.replace("{{medicine}}", "ExampleMed"));
      expect(screen.getByRole("button", { name: sharedControls[code].update })).toBeInTheDocument();
      expect(screen.queryByText("Stored English title")).not.toBeInTheDocument();
      expect(screen.queryByText("Stored English message")).not.toBeInTheDocument();
      expect(screen.getByRole("status").textContent).not.toContain("{{");
    });
  }
});
