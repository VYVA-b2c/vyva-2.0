import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/lib/queryClient";
import AccountSettings from "./AccountSettings";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  logout: vi.fn(),
  setBootstrapLanguage: vi.fn(),
  setLanguage: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return {
    ...actual,
    apiFetch: (...args: Parameters<typeof actual.apiFetch>) => mocks.apiFetch(...args),
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    logout: mocks.logout,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock("@/i18n", () => ({
  setBootstrapLanguage: (language: string) => mocks.setBootstrapLanguage(language),
  useLanguage: () => ({
    language: "en",
    setLanguage: mocks.setLanguage,
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function profileResponse(overrides = {}) {
  return {
    firstName: "Karim",
    lastName: "Assad",
    preferredName: "Karim",
    dateOfBirth: "",
    gender: "male",
    phone: "+34 664338991",
    whatsapp: "",
    email: "karim.assad@mokadigital.net",
    country: "ES",
    language: "en",
    languagePreference: "en",
    timezone: "Europe/Madrid",
    avatarUrl: null,
    ...overrides,
  };
}

function renderAccountSettings() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/settings/account"]}>
        <Routes>
          <Route path="/settings/account" element={<AccountSettings />} />
          <Route path="/settings" element={<span>Settings</span>} />
          <Route path="/login" element={<span>Login</span>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AccountSettings", () => {
  const originalSessionStorage = Object.getOwnPropertyDescriptor(window, "sessionStorage");

  beforeEach(() => {
    queryClient.clear();
    mocks.apiFetch.mockReset();
    mocks.logout.mockReset();
    mocks.setBootstrapLanguage.mockReset();
    mocks.setLanguage.mockReset();
    mocks.toast.mockReset();
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    if (originalSessionStorage) {
      Object.defineProperty(window, "sessionStorage", originalSessionStorage);
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    queryClient.clear();
  });

  it("keeps a successful account save when optional follow-up work fails", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/profile" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ ok: true }));
      }
      if (path === "/api/profile") {
        return Promise.resolve(jsonResponse(profileResponse()));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    mocks.apiFetch.mockResolvedValue(jsonResponse({ ok: true }));
    queryClient.setQueryData(["/api/profile"], profileResponse());
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValue(new Error("profile refresh failed"));
    const { container } = renderAccountSettings();

    expect(await screen.findByDisplayValue("Assad")).toBeInTheDocument();
    fireEvent.change(container.querySelector("#first_name")!, { target: { value: "Karim" } });
    fireEvent.change(container.querySelector("#last_name")!, { target: { value: "Assad" } });
    fireEvent.change(container.querySelector("#phone")!, { target: { value: "664338991" } });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("session storage unavailable");
      },
    });
    fireEvent.click(screen.getByTestId("button-account-save"));

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith("/api/profile", expect.objectContaining({ method: "POST" }));
    });
    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
        title: "Account details saved",
      }));
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[account-settings] profile refresh skipped after save",
      expect.any(Error),
    );
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({
      title: "Could not save account details",
    }));
  });

  it("uses a local phone placeholder for the selected country", async () => {
    mocks.apiFetch.mockResolvedValue(jsonResponse({ ok: true }));
    queryClient.setQueryData(["/api/profile"], profileResponse({
      phone: "",
      country: "UK",
    }));
    const { container } = renderAccountSettings();

    expect(await screen.findByDisplayValue("Assad")).toBeInTheDocument();
    expect(container.querySelector("#phone")).toHaveAttribute("placeholder", "7700 900 123");
    expect(container.querySelector("#phone")).not.toHaveAttribute("placeholder", "+44 7700 900 123");
  });

  it("does not put the sign-in email into the editable profile email field", async () => {
    mocks.apiFetch.mockResolvedValue(jsonResponse({ ok: true }));
    queryClient.setQueryData(["/api/profile"], profileResponse({
      email: "",
      accountEmail: "karim.assad@mokadigital.net",
    }));
    renderAccountSettings();

    expect(await screen.findByDisplayValue("Assad")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("karim.assad@mokadigital.net")).not.toBeInTheDocument();
  });

  it("filters legacy profile email values that match the sign-in email", async () => {
    mocks.apiFetch.mockResolvedValue(jsonResponse({ ok: true }));
    queryClient.setQueryData(["/api/profile"], profileResponse({
      email: "karim.assad@mokadigital.net",
      accountEmail: "karim.assad@mokadigital.net",
    }));
    renderAccountSettings();

    expect(await screen.findByDisplayValue("Assad")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("karim.assad@mokadigital.net")).not.toBeInTheDocument();
  });

  it("shows structured profile save errors instead of the generic fallback", async () => {
    mocks.apiFetch.mockResolvedValue(jsonResponse({
      error: {
        formErrors: [],
        fieldErrors: {
          phone: ["That phone number is already used on another profile."],
        },
      },
    }, 409));
    queryClient.setQueryData(["/api/profile"], profileResponse());
    const { container } = renderAccountSettings();

    expect(await screen.findByDisplayValue("Assad")).toBeInTheDocument();
    fireEvent.change(container.querySelector("#first_name")!, { target: { value: "Karim" } });
    fireEvent.change(container.querySelector("#last_name")!, { target: { value: "Assad" } });
    fireEvent.change(container.querySelector("#phone")!, { target: { value: "664338991" } });
    fireEvent.click(screen.getByTestId("button-account-save"));

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
        title: "Could not save account details",
        description: "That phone number is already used on another profile.",
      }));
    });
  });
});
