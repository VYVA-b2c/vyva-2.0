import fs from "node:fs/promises";
import { expect, test } from "@playwright/test";

type PushProbe = {
  permissionCalls: number;
  subscribeCalls: number;
  unsubscribeCalls: number;
  getSubscriptionCalls: number;
  getUserMediaCalls: number;
  lastSubscribeOptions: unknown;
  serverBodies: unknown[];
};

async function installBrowserPushMocks(page: import("@playwright/test").Page, options: {
  permission?: NotificationPermission;
  existingSubscription?: boolean;
}) {
  await page.addInitScript(({ permission, existingSubscription }) => {
    const probe: PushProbe = {
      permissionCalls: 0,
      subscribeCalls: 0,
      unsubscribeCalls: 0,
      getSubscriptionCalls: 0,
      getUserMediaCalls: 0,
      lastSubscribeOptions: null,
      serverBodies: [],
    };
    const makeSubscription = (endpoint: string, p256dh: number[], auth: number[]) => ({
      endpoint,
      expirationTime: null,
      getKey(name: PushEncryptionKeyName) {
        return new Uint8Array(name === "p256dh" ? p256dh : auth).buffer;
      },
      async unsubscribe() {
        probe.unsubscribeCalls += 1;
        return true;
      },
    });
    const existing = existingSubscription
      ? makeSubscription("https://fcm.googleapis.com/fcm/send/existing-browser-token", [7, 8, 9], [10, 11, 12])
      : null;
    const created = makeSubscription("https://fcm.googleapis.com/fcm/send/new-browser-token", [1, 2, 3], [4, 5, 6]);
    const pushManager = {
      async getSubscription() {
        probe.getSubscriptionCalls += 1;
        return existing;
      },
      async subscribe(subscribeOptions: unknown) {
        probe.subscribeCalls += 1;
        probe.lastSubscribeOptions = subscribeOptions;
        return created;
      },
    };
    Object.defineProperty(window, "__pushProbe", { configurable: true, value: probe });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        requestPermission: async () => {
          probe.permissionCalls += 1;
          return permission ?? "granted";
        },
      },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({ pushManager }),
        register: async () => ({ pushManager, update: async () => {} }),
      },
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          probe.getUserMediaCalls += 1;
          throw new Error("voice must not be invoked by Task 10");
        },
      },
    });
  }, options);
}

async function installApiRoutes(page: import("@playwright/test").Page, options: {
  subscriptionStatus?: number;
  subscriptionBody?: unknown;
  statusBody?: unknown;
}) {
  await page.route("**/api/preventive-web-push/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        supported: true,
        enabled: true,
        reason: "preventive_web_push_allowed_user",
        publicKey: "AQID",
      }),
    });
  });
  await page.route("**/api/preventive-web-push/subscriptions", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataJSON();
    await route.request().frame().page().evaluate((value) => {
      (window as unknown as { __pushProbe: PushProbe }).__pushProbe.serverBodies.push(value);
    }, body);
    await route.fulfill({
      status: options.subscriptionStatus ?? 200,
      contentType: "application/json",
      body: JSON.stringify(options.subscriptionBody ?? { ok: true }),
    });
  });
  await page.route("**/api/preventive-web-push/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(options.statusBody ?? {
        consentEnabled: true,
        consentRevision: 1,
        subscribed: true,
        config: {
          supported: true,
          enabled: true,
          reason: "preventive_web_push_allowed_user",
          publicKey: "AQID",
        },
      }),
    });
  });
}

test.describe("Task 10 PWA push entry browser boundary", () => {
  test("requests Notification permission only after explicit enable and subscribes with userVisibleOnly", async ({ page }) => {
    await installBrowserPushMocks(page, {});
    await installApiRoutes(page, {});
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __pushProbe: PushProbe }).__pushProbe.permissionCalls
    )).toBe(0);

    const result = await page.evaluate(async () => {
      const module = await import("/src/lib/preventiveWebPush.ts");
      return module.enablePreventiveWebPush();
    });
    expect(result).toMatchObject({ consentEnabled: true, subscribed: true });

    const probe = await page.evaluate(() =>
      (window as unknown as { __pushProbe: PushProbe }).__pushProbe
    );
    expect(probe.permissionCalls).toBe(1);
    expect(probe.subscribeCalls).toBe(1);
    expect(probe.lastSubscribeOptions).toMatchObject({ userVisibleOnly: true });
    expect(probe.serverBodies[0]).toMatchObject({
      subscription: {
        endpoint: "https://fcm.googleapis.com/fcm/send/new-browser-token",
        keys: { p256dh: "AQID", auth: "BAUG" },
        contentEncoding: "aes128gcm",
      },
    });
    expect(probe.getUserMediaCalls).toBe(0);
  });

  test("handles denied permission without creating a subscription", async ({ page }) => {
    await installBrowserPushMocks(page, { permission: "denied" });
    await installApiRoutes(page, {});
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const message = await page.evaluate(async () => {
      const module = await import("/src/lib/preventiveWebPush.ts");
      try {
        await module.enablePreventiveWebPush();
        return "unexpected success";
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });
    expect(message).toBe("Notification permission was not granted.");
    const probe = await page.evaluate(() =>
      (window as unknown as { __pushProbe: PushProbe }).__pushProbe
    );
    expect(probe.subscribeCalls).toBe(0);
    expect(probe.getUserMediaCalls).toBe(0);
  });

  test("cleans up newly-created browser subscription on server persistence failure but preserves existing subscriptions", async ({ page }) => {
    await installBrowserPushMocks(page, {});
    await installApiRoutes(page, {
      subscriptionStatus: 503,
      subscriptionBody: { error: "Unable to save push subscription" },
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      const module = await import("/src/lib/preventiveWebPush.ts");
      await module.enablePreventiveWebPush().catch(() => {});
    });
    let probe = await page.evaluate(() =>
      (window as unknown as { __pushProbe: PushProbe }).__pushProbe
    );
    expect(probe.unsubscribeCalls).toBe(1);

    await page.unroute("**/api/preventive-web-push/config");
    await page.unroute("**/api/preventive-web-push/subscriptions");
    await page.unroute("**/api/preventive-web-push/status");
    await page.addInitScript(() => {});
    const existingPage = await page.context().newPage();
    await installBrowserPushMocks(existingPage, { existingSubscription: true });
    await installApiRoutes(existingPage, {
      subscriptionStatus: 503,
      subscriptionBody: { error: "Unable to save push subscription" },
    });
    await existingPage.goto("/", { waitUntil: "domcontentloaded" });
    await existingPage.evaluate(async () => {
      const module = await import("/src/lib/preventiveWebPush.ts");
      await module.enablePreventiveWebPush().catch(() => {});
    });
    probe = await existingPage.evaluate(() =>
      (window as unknown as { __pushProbe: PushProbe }).__pushProbe
    );
    expect(probe.subscribeCalls).toBe(0);
    expect(probe.unsubscribeCalls).toBe(0);
    await existingPage.close();
  });

  test("revokes through the server before unsubscribing an existing browser subscription", async ({ page }) => {
    await installBrowserPushMocks(page, { existingSubscription: true });
    await installApiRoutes(page, {
      statusBody: {
        consentEnabled: false,
        consentRevision: 2,
        subscribed: false,
        config: {
          supported: true,
          enabled: true,
          reason: "preventive_web_push_allowed_user",
          publicKey: "AQID",
        },
      },
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const result = await page.evaluate(async () => {
      const module = await import("/src/lib/preventiveWebPush.ts");
      return module.disablePreventiveWebPush();
    });
    expect(result).toMatchObject({ consentEnabled: false, subscribed: false });
    const probe = await page.evaluate(() =>
      (window as unknown as { __pushProbe: PushProbe }).__pushProbe
    );
    expect(probe.permissionCalls).toBe(0);
    expect(probe.unsubscribeCalls).toBe(1);
    expect(probe.getUserMediaCalls).toBe(0);
  });

  test("service-worker notification click ignores arbitrary payload URLs and focuses same-origin clients", async ({ page }) => {
    const source = await fs.readFile("public/service-worker.js", "utf8");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const result = await page.evaluate(async (serviceWorkerSource) => {
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
      new Function("self", "caches", "fetch", "URL", serviceWorkerSource)(
        selfObject,
        {
          open: async () => ({ addAll: async () => {}, put: async () => {} }),
          keys: async () => [],
          delete: async () => true,
          match: async () => undefined,
        },
        async () => ({ ok: true, clone: () => ({}) }),
        URL,
      );
      const click = listeners.get("notificationclick");
      if (!click) throw new Error("notificationclick listener missing");
      const waits: Promise<unknown>[] = [];
      click({
        notification: {
          close: () => {},
          data: {
            pushEntry: "b".repeat(43),
            url: "https://evil.example/ignored",
          },
        },
        waitUntil: (promise: Promise<unknown>) => {
          waits.push(promise);
        },
      });
      await Promise.all(waits);
      return { navigated, focused };
    }, source);
    expect(result).toEqual({
      navigated: [`https://app.example/health/check-in?pushEntry=${"b".repeat(43)}`],
      focused: [`https://app.example/health/check-in?pushEntry=${"b".repeat(43)}`],
    });
  });
});
