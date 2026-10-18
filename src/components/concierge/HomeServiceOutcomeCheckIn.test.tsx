import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeServiceOutcomeCheckIn } from "./HomeServiceOutcomeCheckIn";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({ apiFetch: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function arrange() {
  let answered = false;
  vi.mocked(apiFetch).mockImplementation(async (url, init) => {
    if (String(url).endsWith("/outcomes/due")) return { ok: true, json: async () => ({ items: answered ? [] : [{ requestId: "req-1", providerName: "Fontanería Ruiz", serviceType: "plumber" }] }) } as Response;
    answered = true;
    return { ok: true, json: async () => ({ recorded: true }), init } as unknown as Response;
  });
  render(<QueryClientProvider client={new QueryClient()}><HomeServiceOutcomeCheckIn language="en" /></QueryClientProvider>);
}
const posted = () => vi.mocked(apiFetch).mock.calls.filter(([url]) => String(url).includes("/outcome") && !String(url).endsWith("/due"));

describe("home-service outcome check-in", () => {
  it("asks three questions and sends one answer", async () => {
    arrange();
    expect(await screen.findByText("How did it go with Fontanería Ruiz?")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-outcome-arrived-late"));
    fireEvent.click(screen.getByTestId("button-outcome-price-above_quote"));
    fireEvent.click(screen.getByTestId("button-outcome-wouldUseAgain-no"));
    await waitFor(() => expect(posted()).toHaveLength(1));
    expect(posted()[0][0]).toBe("/api/appointments/requests/req-1/outcome");
    expect(JSON.parse(String(posted()[0][1]?.body))).toEqual({ arrived: "late", price: "above_quote", wouldUseAgain: "no" });
    expect(await screen.findByRole("status")).toHaveTextContent("Thank you");
  });

  it("records a skip without thanking", async () => {
    arrange();
    fireEvent.click(await screen.findByTestId("button-outcome-skip"));
    await waitFor(() => expect(posted()).toHaveLength(1));
    expect(JSON.parse(String(posted()[0][1]?.body))).toEqual({ skipped: true });
    await waitFor(() => expect(screen.queryByTestId("home-service-outcome-checkin")).not.toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
