import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSignupInviteId,
  currentSignupInviteId,
  rememberSignupInviteId,
} from "./signupInviteAudit";

describe("signup invite audit storage", () => {
  const originalSessionStorage = Object.getOwnPropertyDescriptor(window, "sessionStorage");

  afterEach(() => {
    if (originalSessionStorage) {
      Object.defineProperty(window, "sessionStorage", originalSessionStorage);
    }
    vi.restoreAllMocks();
  });

  it("does not throw when session storage is unavailable", () => {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("session storage unavailable");
      },
    });

    expect(() => rememberSignupInviteId("invite-123456")).not.toThrow();
    expect(() => clearSignupInviteId("invite-123456")).not.toThrow();
    expect(currentSignupInviteId()).toBeNull();
  });
});
