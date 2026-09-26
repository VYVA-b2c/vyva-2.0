import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderVerificationPanel } from "./ProviderVerificationPanel";
import { apiFetch } from "@/lib/queryClient";
vi.mock("@/lib/queryClient", () => ({ apiFetch: vi.fn() }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });
const options = [{ id: "one", provider_snapshot: {} }];
describe("provider verification wait", () => {
  it("preserves completed provider checks when the user extends the window", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(async url => {
      if (String(url).includes("/one/")) return { ok: true, json: async () => ({ verification: { version: 1, status: "incomplete", checkedAt: new Date().toISOString(), reviewCount: 3, recentReviewCount: 1, sources: [], gaps: ["Limited coverage"], concerns: [], retryable: false } }) } as Response;
      return new Promise(() => {});
    });
    render(<ProviderVerificationPanel requestId="request" options={[...options, { id: "two", provider_snapshot: {} }]} selectedId="one" isSpanish={false} onResultsVisible={vi.fn()} />);
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(120000); });
    fireEvent.click(screen.getByText("Keep checking"));
    expect(apiFetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(apiFetch).mock.calls.filter(([url]) => String(url).includes("/one/"))).toHaveLength(1);
  });
  it("asks at two minutes, aborts, and only restarts with permission", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(() => new Promise(() => {}));
    const visible = vi.fn();
    render(<ProviderVerificationPanel requestId="request" options={options} selectedId="one" isSpanish={false} onResultsVisible={visible} />);
    await act(async () => { vi.advanceTimersByTime(120000); });
    expect(screen.getByText("Show results now")).toBeInTheDocument();
    expect(vi.mocked(apiFetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Keep checking"));
    expect(apiFetch).toHaveBeenCalledTimes(2);
    await act(async () => { vi.advanceTimersByTime(120000); });
    fireEvent.click(screen.getByText("Show results now"));
    expect(screen.getByText("Checks incomplete")).toBeInTheDocument();
    expect(visible).toHaveBeenLastCalledWith(true);
  });
  it("shows returned checks without a redundant confirmation", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: true, json: async () => ({ verification: { version: 1, status: "incomplete", checkedAt: new Date().toISOString(), reviewCount: 0, recentReviewCount: 0, sources: [], gaps: ["Reviews unavailable"], concerns: [], retryable: false }, ranking: { score: 123, priority_notes: ["Price information is unavailable; your job needs a quote."] } }) } as Response);
    const visible = vi.fn();
    const ranked = vi.fn();
    render(<ProviderVerificationPanel requestId="request" options={options} selectedId="one" isSpanish={false} onResultsVisible={visible} onRanked={ranked} />);
    expect(await screen.findByText("Checks incomplete")).toBeInTheDocument();
    expect(visible).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText("Keep checking")).not.toBeInTheDocument();
    expect(ranked).toHaveBeenCalledWith({ one: { score: 123, priority_notes: ["Price information is unavailable; your job needs a quote."] } });
    fireEvent.click(screen.getByText("What we checked"));
    expect(screen.getByText("Price information is unavailable; your job needs a quote.")).toBeVisible();
  });

  it("does not restart audits when ranking changes option order", async () => {
    const verification = { version: 1, status: "incomplete", checkedAt: new Date().toISOString(), reviewCount: 0, recentReviewCount: 0, sources: [], gaps: [], concerns: [], retryable: false };
    const initial = ["one", "two", "three", "four"].map((id, i) => ({ id, provider_snapshot: { verification, provider_decision: { score: 100 + i, priority_notes: [] } } }));
    const ranked = vi.fn();
    const visible = vi.fn();
    const view = render(<ProviderVerificationPanel requestId="request" options={initial} selectedId="one" isSpanish={false} onResultsVisible={visible} onRanked={ranked} />);
    await screen.findByText("Checks incomplete");
    view.rerender(<ProviderVerificationPanel requestId="request" options={[...initial].reverse()} selectedId="two" isSpanish={false} onResultsVisible={visible} onRanked={ranked} />);
    expect(apiFetch).not.toHaveBeenCalled();
    expect(ranked).toHaveBeenCalledTimes(1);
  });
});
