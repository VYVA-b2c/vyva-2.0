import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PROVIDER_AUDIT_DEPTH, ProviderVerificationPanel } from "./ProviderVerificationPanel";
import { apiFetch } from "@/lib/queryClient";
import { homeServiceText } from "../../shared/homeServiceText";
vi.mock("@/lib/queryClient", () => ({ apiFetch: vi.fn() }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });
const options = [{ id: "one", provider_snapshot: {} }];
describe("provider verification wait", () => {
  it("waits for an in-flight audit and displays its completed result", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ ok: false, status: 409 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ verification: { version: 1, status: "incomplete", checkedAt: new Date().toISOString(), reviewCount: 3, recentReviewCount: 1, sources: [], gaps: ["Limited coverage"], concerns: [], retryable: false } }) } as Response);
    const visible = vi.fn();
    render(<ProviderVerificationPanel requestId="request" options={options} selectedId="one" isSpanish={false} onResultsVisible={visible} />);
    await act(async () => {});
    expect(screen.queryByText("Retry checks")).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Limited coverage")).toBeInTheDocument();
    expect(visible).toHaveBeenLastCalledWith(true);
  });

  it("stops in-flight retries at the existing deadline and on unmount", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockResolvedValue({ ok: false, status: 409 } as Response);
    const view = render(<ProviderVerificationPanel requestId="request" options={options} selectedId="one" isSpanish={false} onResultsVisible={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
    expect(screen.getByText("Keep checking")).toBeInTheDocument();
    const calls = vi.mocked(apiFetch).mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(apiFetch).toHaveBeenCalledTimes(calls);
    fireEvent.click(screen.getByText("Keep checking"));
    await act(async () => {});
    view.unmount();
    const unmountedCalls = vi.mocked(apiFetch).mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(apiFetch).toHaveBeenCalledTimes(unmountedCalls);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["es", "fr", "de", "it", "pt"])("changes labels to %s without restarting verification", async language => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("Unavailable"));
    const visible = vi.fn();
    const view = render(<ProviderVerificationPanel requestId="request" options={options} selectedId="one" isSpanish={false} language="en" onResultsVisible={visible} />);
    await screen.findByText("Retry checks");
    view.rerender(<ProviderVerificationPanel requestId="request" options={options} selectedId="one" isSpanish={language === "es"} language={language} onResultsVisible={visible} />);
    expect(screen.getByText(homeServiceText(language, "Retry checks"))).toBeInTheDocument();
    expect(screen.getByText(homeServiceText(language, "What we checked"))).toBeInTheDocument();
    expect(screen.getByText(homeServiceText(language, "The verification service is unavailable. This provider is not verified."))).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(visible).toHaveBeenCalledTimes(2);
  });
  it("reveals results on service failure instead of pretending checks are running", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("Unavailable"));
    const visible = vi.fn();
    render(<ProviderVerificationPanel requestId="request" options={options} selectedId="one" isSpanish={false} onResultsVisible={visible} />);
    expect(await screen.findByText("Checks incomplete")).toBeInTheDocument();
    expect(visible).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText("Keep checking")).not.toBeInTheDocument();
    expect(screen.getByText("Retry checks")).toBeInTheDocument();
  });
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
  it("checks beyond the first three and reports exclusions found during checks", async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, provider_source: "external", provider_snapshot: {} }));
    vi.mocked(apiFetch).mockImplementation(async url => ({ ok: true, json: async () => ({
      verification: { version: 1, status: String(url).includes("/p4/") ? "concerns" : "verified", checkedAt: new Date().toISOString(), reviewCount: 5, recentReviewCount: 2, sources: [], gaps: [], concerns: [], retryable: false },
      ranking: String(url).includes("/p4/") ? null : { score: 100, priority_notes: [] },
      excluded: String(url).includes("/p4/"),
    }) }) as Response);
    const ranked = vi.fn();
    render(<ProviderVerificationPanel requestId="request" options={many} selectedId="p0" isSpanish={false} onResultsVisible={vi.fn()} onRanked={ranked} />);
    await waitFor(() => expect(ranked).toHaveBeenCalled());
    expect(apiFetch).toHaveBeenCalledTimes(PROVIDER_AUDIT_DEPTH);
    expect(ranked.mock.calls.at(-1)?.[0].p4).toEqual({ score: 0, priority_notes: [], excluded: true });
    expect(ranked.mock.calls.at(-1)?.[0].p5.excluded).toBeUndefined();
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
    expect(screen.getByText("Checks incomplete")).not.toBeVisible();
    expect(screen.queryByText("Not independently verified.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("What we checked"));
    expect(screen.getByText("Checks incomplete")).toBeVisible();
    expect(screen.getByText("Reviews unavailable")).toBeVisible();
    expect(screen.getByText("Price information is unavailable; your job needs a quote.")).toBeVisible();
  });

  it("translates saved evidence diagnostics when switching through every supported language", async () => {
    const diagnostic = "Some retrieved evidence was malformed or exceeded limits and was excluded.";
    const verification = { version: 1, status: "incomplete", checkedAt: new Date().toISOString(), reviewCount: 0, recentReviewCount: 0, sources: [], gaps: [diagnostic], concerns: [], retryable: false };
    const savedOptions = [{ id: "one", provider_snapshot: { verification } }];
    const visible = vi.fn();
    const view = render(<ProviderVerificationPanel requestId="request" options={savedOptions} selectedId="one" isSpanish={false} language="en" onResultsVisible={visible} />);
    await screen.findByText(diagnostic);
    fireEvent.click(screen.getByText("What we checked"));
    for (const language of ["fr", "es", "de", "it", "pt", "en"]) {
      view.rerender(<ProviderVerificationPanel requestId="request" options={savedOptions} selectedId="one" isSpanish={language === "es"} language={language} onResultsVisible={visible} />);
      const translated = homeServiceText(language, diagnostic);
      expect(screen.getByText(translated)).toBeVisible();
      if (language !== "en") {
        expect(translated).not.toBe(diagnostic);
        expect(screen.queryByText(diagnostic)).not.toBeInTheDocument();
      }
    }
    expect(apiFetch).not.toHaveBeenCalled();
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
