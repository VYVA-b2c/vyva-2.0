import fs from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const serviceWorkerSource = fs.readFileSync(
  new URL("../public/service-worker.js", import.meta.url),
  "utf8",
);

describe("Task 10 service worker push entry", () => {
  it("adds only push and notification-click entry handling while preserving cache handlers", () => {
    expect(serviceWorkerSource).toContain('self.addEventListener("install"');
    expect(serviceWorkerSource).toContain('self.addEventListener("activate"');
    expect(serviceWorkerSource).toContain('self.addEventListener("fetch"');
    expect(serviceWorkerSource).toContain('self.addEventListener("push"');
    expect(serviceWorkerSource).toContain('self.addEventListener("notificationclick"');
  });

  it("uses fixed same-origin notification content and an opaque token route", () => {
    expect(serviceWorkerSource).toContain('showNotification("VYVA check-in"');
    expect(serviceWorkerSource).toContain("It's time for your gentle daily check-in.");
    expect(serviceWorkerSource).toContain('url.searchParams.set("pushEntry", token)');
    expect(serviceWorkerSource).toContain('new URL(PREVENTIVE_CHECK_ROUTE, self.location.origin)');
    expect(serviceWorkerSource).not.toMatch(/payload\.(title|body|icon|url|route)/);
    expect(serviceWorkerSource).not.toMatch(/openWindow\(payload/);
  });

  it("ignores malformed push payloads and displays a fixed notification for valid payloads", async () => {
    const listeners = new Map<string, (event: Record<string, unknown>) => void>();
    const notifications: Array<{ title: string; options: Record<string, unknown> }> = [];
    const selfObject = {
      location: { href: "https://app.example/service-worker.js?v=test", origin: "https://app.example" },
      addEventListener: (name: string, handler: (event: Record<string, unknown>) => void) => {
        listeners.set(name, handler);
      },
      registration: {
        showNotification: async (title: string, options: Record<string, unknown>) => {
          notifications.push({ title, options });
        },
      },
      skipWaiting: async () => {},
      clients: {
        claim: async () => {},
      },
    };
    vm.runInNewContext(serviceWorkerSource, {
      self: selfObject,
      caches: {
        open: async () => ({ addAll: async () => {}, put: async () => {} }),
        keys: async () => [],
        delete: async () => true,
        match: async () => undefined,
      },
      fetch: async () => ({ ok: true, clone: () => ({}) }),
      URL,
    });
    const push = listeners.get("push");
    expect(push).toBeDefined();
    if (!push) return;
    push({
      data: { json: () => ({ type: "vyva.preventive_check", token: "bad token" }) },
      waitUntil: (promise: Promise<unknown>) => promise,
    });
    expect(notifications).toHaveLength(0);
    await push({
      data: { json: () => ({ type: "vyva.preventive_check", token: "a".repeat(43), url: "https://evil.example" }) },
      waitUntil: (promise: Promise<unknown>) => promise,
    });
    expect(notifications).toEqual([
      {
        title: "VYVA check-in",
        options: expect.objectContaining({
          body: "It's time for your gentle daily check-in.",
          tag: "vyva-preventive-check",
          data: { route: "/health/check-in", pushEntry: "a".repeat(43) },
        }),
      },
    ]);
  });

  it("clicks focus a same-origin client and ignore arbitrary payload URLs", async () => {
    const listeners = new Map<string, (event: Record<string, unknown>) => void>();
    const navigated: string[] = [];
    const focused: string[] = [];
    const selfObject = {
      location: { href: "https://app.example/service-worker.js?v=test", origin: "https://app.example" },
      addEventListener: (name: string, handler: (event: Record<string, unknown>) => void) => {
        listeners.set(name, handler);
      },
      registration: { showNotification: async () => {} },
      skipWaiting: async () => {},
      clients: {
        claim: async () => {},
        matchAll: async () => [
          {
            url: "https://app.example/settings",
            navigate: async (url: string) => {
              navigated.push(url);
              return {
                focus: async () => {
                  focused.push(url);
                },
              };
            },
            focus: async () => {},
          },
        ],
        openWindow: async (url: string) => {
          navigated.push(url);
        },
      },
    };
    vm.runInNewContext(serviceWorkerSource, {
      self: selfObject,
      caches: {
        open: async () => ({ addAll: async () => {}, put: async () => {} }),
        keys: async () => [],
        delete: async () => true,
        match: async () => undefined,
      },
      fetch: async () => ({ ok: true, clone: () => ({}) }),
      URL,
    });
    const click = listeners.get("notificationclick");
    expect(click).toBeDefined();
    if (!click) return;
    const waits: Promise<unknown>[] = [];
    click({
      notification: {
        close: () => {},
        data: {
          pushEntry: "b".repeat(43),
          url: "https://evil.example",
        },
      },
      waitUntil: (promise: Promise<unknown>) => {
        waits.push(promise);
      },
    });
    await Promise.all(waits);
    expect(navigated).toEqual([
      "https://app.example/health/check-in?pushEntry=" + "b".repeat(43),
    ]);
    expect(focused).toHaveLength(1);
  });
});
