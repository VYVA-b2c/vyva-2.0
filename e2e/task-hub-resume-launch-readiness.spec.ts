import { expect, type Page, test } from "@playwright/test";

const launchViewports = [
  ["desktop", 1440, 1000],
  ["tablet", 768, 1024],
  ["mobile", 390, 844],
] as const;

const linkedDraftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function emptyApiList() {
  return { items: [] };
}

function shoppingDraftState() {
  return {
    step: "review",
    requestId: 0,
    revision: 3,
    draft: {
      retailerId: "saved-market",
      retailerName: "Saved Market",
      items: [{ id: "item-1", name: "Soup", quantity: "4 cans" }],
      itemName: "",
      itemQuantity: "",
      fulfillment: "delivery",
      locationId: "home",
      location: "Home",
      preferredTime: "Tomorrow morning",
      substitutions: "ask",
      estimateStatus: "unverified",
      estimatedCost: "",
      fees: "",
      availability: "unverified",
    },
  };
}

async function seedShoppingDraft(page: Page) {
  await page.addInitScript((state) => {
    sessionStorage.clear();
    sessionStorage.setItem("vyva.shoppingDelivery.v1", JSON.stringify(state));
  }, shoppingDraftState());
}

async function setupTaskHubApi(page: Page, options: {
  pending?: unknown[];
  drafts?: unknown[];
  sessions?: unknown[];
  unsafeCalls?: string[];
} = {}) {
  await page.route("**/api/concierge/tasks", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: options.drafts ?? [] }),
    });
  });

  await page.route("**/api/concierge/actions/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/pending")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ items: options.pending ?? [] }),
      });
      return;
    }
    if (path.endsWith("/sessions")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ items: options.sessions ?? [] }),
      });
      return;
    }
    if (/\/(details|complete|review-confirm)$/.test(path)) {
      options.unsafeCalls?.push(`${route.request().method()} ${path}`);
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unsafe write blocked by launch test" }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(emptyApiList()),
    });
  });
}

test("task hub resumes a local shopping Canvas draft without writing", async ({
  page,
}) => {
  const unsafeCalls: string[] = [];
  await seedShoppingDraft(page);
  await setupTaskHubApi(page, { unsafeCalls });

  await page.goto("/task-hub-resume-canvas.html?task=draft%3Alocal-canvas-shopping");

  await expect(page.getByTestId("concierge-task-continuation")).toContainText(
    "Shopping Canvas",
  );
  await expect(page.getByTestId("concierge-task-continuation")).toContainText(
    "Ready to confirm",
  );
  await page.getByTestId("button-concierge-task-primary-action").click();

  await expect(page.getByTestId("task-hub-harness-path")).toHaveText(
    "/concierge/shopping",
  );
  await expect(page.getByTestId("task-hub-harness-state")).toContainText(
    '"resumeCanvas":"shopping"',
  );
  expect(unsafeCalls).toEqual([]);
});

test("task hub opens a pending provider reply path without pre-confirmation writes", async ({
  page,
}) => {
  const unsafeCalls: string[] = [];
  await setupTaskHubApi(page, {
    unsafeCalls,
    drafts: [{
      id: linkedDraftId,
      user_id: "user-1",
      kind: "appointment",
      entry_payload: { kind: "appointment", appointmentKind: "medical" },
      progress_payload: {},
      stage: "review",
      status: "active",
      linked_pending_id: "reply-1",
      language: "en",
      created_at: "2026-07-18T08:00:00.000Z",
      updated_at: "2026-07-18T10:00:00.000Z",
      completed_at: null,
      deleted_at: null,
    }],
    pending: [{
      id: "reply-1",
      use_case: "book_appointment",
      provider_name: "Harbour Clinic",
      action_summary: "Ask Harbour Clinic for an appointment.",
      action_payload: {
        provider_task_status: "action_needed",
        provider_reply_status: "needs_more_info",
        provider_reply: "Please confirm your insurance plan.",
        provider_response_summary: "Harbour Clinic needs your insurance plan.",
        provider_reply_decisions: [{
          action: "answer_provider",
          status: "draft_ready",
          recordedAt: "2026-07-18T10:05:00.000Z",
          channel: "email",
          summary: "Prepared an answer for the clinic.",
          requiresFreshConfirmation: true,
        }],
      },
      status: "pending",
      updated_at: "2026-07-18T10:05:00.000Z",
    }],
  });

  await page.goto("/task-hub-resume-canvas.html?task=pending%3Areply-1");

  await expect(page.getByTestId("concierge-task-provider-reply")).toContainText(
    "Please confirm your insurance plan.",
  );
  await page.getByTestId("button-concierge-task-primary-action").click();

  await expect(page.getByTestId("task-hub-harness-path")).toHaveText(
    `/concierge/task/${linkedDraftId}`,
  );
  await expect(page.getByTestId("task-hub-harness-state")).toContainText(
    '"conciergePendingId":"reply-1"',
  );
  expect(unsafeCalls).toEqual([]);
});

test("task hub detail exit and responsive long labels stay safe", async ({
  page,
}) => {
  const unsafeCalls: string[] = [];
  await setupTaskHubApi(page, {
    unsafeCalls,
    pending: [{
      id: "long-shopping-1",
      use_case: "shopping_request",
      provider_name: "A very patient neighborhood grocery and prepared meals shop",
      action_summary:
        "Waiting for a very long translated shopping request label that should remain readable and not force a broken layout.",
      action_payload: {
        flow_reference: "FLOW_SHOPPING_SUPPORT",
        live_handoff_status: "sent_or_called",
      },
      status: "calling",
      updated_at: "2026-07-19T10:00:00.000Z",
    }],
  });

  await page.goto("/task-hub-resume-canvas.html?task=pending%3Along-shopping-1");
  await expect(page.getByTestId("concierge-task-detail")).toBeVisible();
  await page.getByTestId("button-concierge-task-exit").click();
  await expect(page.getByTestId("task-hub-harness-path")).toHaveText(
    "/concierge/tasks",
  );
  expect(unsafeCalls).toEqual([]);

  for (const [name, width, height] of launchViewports) {
    await page.setViewportSize({ width, height });
    await page.goto("/task-hub-resume-canvas.html");
    await expect(
      page.getByTestId("concierge-inbox-task-pending:long-shopping-1"),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `src/dev/voice-canvas/task-hub-resume-${name}.png`,
      fullPage: true,
    });
  }
});
