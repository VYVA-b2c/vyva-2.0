import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {
    token: "token",
    user: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      activeProfileId: "profile-1",
      activeProfileRole: "elder",
    },
  },
  profile: { profile: { profileId: "profile-1" } },
  sync: vi.fn().mockResolvedValue({ syncAvailable: true, journeys: [] }),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => mocks.profile }));
vi.mock("@/lib/homeFastHelpSyncClient", () => ({ syncHomeFastHelpOutcomes: mocks.sync }));

import HomeFastHelpSyncBridge from "./HomeFastHelpSyncBridge";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value });
}

describe("HomeFastHelpSyncBridge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.sync.mockClear();
    mocks.auth.token = "token";
    mocks.auth.user.activeProfileRole = "elder";
    setOnline(true);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("syncs an elder profile and retries when connectivity returns", async () => {
    setOnline(false);
    render(<HomeFastHelpSyncBridge />);
    await act(async () => vi.advanceTimersByTime(400));
    expect(mocks.sync).not.toHaveBeenCalled();

    setOnline(true);
    window.dispatchEvent(new Event("online"));
    await act(async () => vi.advanceTimersByTime(400));
    expect(mocks.sync).toHaveBeenCalledWith("vyva:home-fast-help-journeys:v1:profile-1");
  });

  it("does not expose journey sync through a caregiver profile", async () => {
    mocks.auth.user.activeProfileRole = "caregiver";
    render(<HomeFastHelpSyncBridge />);
    await act(async () => vi.advanceTimersByTime(500));
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});
