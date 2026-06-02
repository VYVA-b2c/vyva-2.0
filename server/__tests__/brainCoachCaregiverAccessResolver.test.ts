import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const insertValues = vi.fn(async () => []);

  function selectChain(result: unknown[]) {
    const chain: {
      from: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
    } = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(async () => result),
    };
    return chain;
  }

  const db = {
    select: vi.fn(() => selectChain(selectResults.shift() ?? [])),
    insert: vi.fn(() => ({
      values: insertValues,
    })),
  };

  return {
    db,
    insertValues,
    getActiveProfileContext: vi.fn(),
    selectResults,
  };
});

vi.mock("../db.js", () => ({ db: mocks.db }));
vi.mock("../lib/profileAccess.js", () => ({
  getActiveProfileContext: mocks.getActiveProfileContext,
}));

import {
  auditBrainCoachCaregiverChange,
  resolveBrainCoachAccess,
  type BrainCoachAccessContext,
} from "../lib/brainCoachCaregiverAccess.js";

function queueAccessRows(input: {
  actorProfile?: Record<string, unknown> | null;
  membership?: Record<string, unknown> | null;
  invitation?: Record<string, unknown> | null;
}) {
  mocks.selectResults.push(
    input.actorProfile ? [input.actorProfile] : [],
    input.membership ? [input.membership] : [],
    input.invitation ? [input.invitation] : [],
  );
}

describe("Brain Coach caregiver access resolver", () => {
  beforeEach(() => {
    mocks.selectResults.length = 0;
    mocks.db.select.mockClear();
    mocks.db.insert.mockClear();
    mocks.insertValues.mockClear();
    mocks.getActiveProfileContext.mockReset();
  });

  it("denies access when no active membership exists", async () => {
    mocks.getActiveProfileContext.mockResolvedValue({
      accountUserId: "caregiver-1",
      profileId: "senior-1",
      role: "caregiver",
    });
    queueAccessRows({
      actorProfile: { role: "user", email: "caregiver@example.com" },
      membership: null,
      invitation: null,
    });

    await expect(resolveBrainCoachAccess({
      actorUserId: "caregiver-1",
      targetUserId: "senior-1",
      requiredPermission: "view_summary",
    })).resolves.toBeNull();
  });

  it("allows summary-only caregivers to view but not manage settings", async () => {
    mocks.getActiveProfileContext.mockResolvedValue({
      accountUserId: "caregiver-1",
      profileId: "senior-1",
      role: "caregiver",
    });
    queueAccessRows({
      actorProfile: { role: "user", email: "caregiver@example.com" },
      membership: {
        role: "caregiver",
        permissions: { brain_coach: { view_summary: true } },
      },
      invitation: null,
    });

    const viewAccess = await resolveBrainCoachAccess({
      actorUserId: "caregiver-1",
      targetUserId: "senior-1",
      requiredPermission: "view_summary",
    });

    expect(viewAccess).toMatchObject({
      actorRole: "caregiver",
      isOwnProfile: false,
      permissions: {
        view_summary: true,
        manage_plan_preferences: false,
      },
    });

    mocks.getActiveProfileContext.mockResolvedValue({
      accountUserId: "caregiver-1",
      profileId: "senior-1",
      role: "caregiver",
    });
    queueAccessRows({
      actorProfile: { role: "user", email: "caregiver@example.com" },
      membership: {
        role: "caregiver",
        permissions: { brain_coach: { view_summary: true } },
      },
      invitation: null,
    });

    await expect(resolveBrainCoachAccess({
      actorUserId: "caregiver-1",
      targetUserId: "senior-1",
      requiredPermission: "manage_plan_preferences",
    })).resolves.toBeNull();
  });

  it("allows caregivers with exact manage permission to edit only that surface", async () => {
    mocks.getActiveProfileContext.mockResolvedValue({
      accountUserId: "caregiver-1",
      profileId: "senior-1",
      role: "caregiver",
    });
    queueAccessRows({
      actorProfile: { role: "user", email: "caregiver@example.com" },
      membership: {
        role: "family",
        permissions: {
          brain_coach: {
            view_summary: true,
            manage_plan_preferences: true,
            manage_schedule: false,
          },
        },
      },
      invitation: null,
    });

    const access = await resolveBrainCoachAccess({
      actorUserId: "caregiver-1",
      targetUserId: "senior-1",
      requiredPermission: "manage_plan_preferences",
    });

    expect(access).toMatchObject({
      actorRole: "family",
      permissions: {
        manage_plan_preferences: true,
        manage_schedule: false,
      },
    });
  });

  it("denies revoked caregivers even when legacy invitation consent still exists", async () => {
    mocks.getActiveProfileContext.mockResolvedValue({
      accountUserId: "caregiver-1",
      profileId: "senior-1",
      role: "caregiver",
    });
    queueAccessRows({
      actorProfile: { role: "user", email: "caregiver@example.com" },
      membership: null,
      invitation: {
        can_view_dashboard: true,
        can_view_journal_summaries: true,
      },
    });

    await expect(resolveBrainCoachAccess({
      actorUserId: "caregiver-1",
      targetUserId: "senior-1",
      requiredPermission: "view_summary",
    })).resolves.toBeNull();
  });

  it("allows the senior to self-manage every Brain Coach permission", async () => {
    mocks.getActiveProfileContext.mockResolvedValue({
      accountUserId: "senior-1",
      profileId: "senior-1",
      role: "elder",
    });
    queueAccessRows({
      actorProfile: { role: "user", email: "senior@example.com" },
      membership: null,
      invitation: null,
    });

    const access = await resolveBrainCoachAccess({
      actorUserId: "senior-1",
      targetUserId: "senior-1",
      requiredPermission: "manage_schedule",
    });

    expect(access).toMatchObject({
      actorRole: "elder",
      isOwnProfile: true,
      permissions: {
        view_summary: true,
        manage_plan_preferences: true,
        manage_schedule: true,
        send_nudges: true,
        preview_plan: true,
      },
    });
  });

  it("audits Brain Coach caregiver changes to consent audit logs", async () => {
    const access: BrainCoachAccessContext = {
      targetUserId: "senior-1",
      actorUserId: "caregiver-1",
      actorRole: "caregiver",
      isOwnProfile: false,
      isAdmin: false,
      permissions: {
        view_summary: true,
        manage_plan_preferences: true,
        manage_schedule: false,
        send_nudges: false,
        preview_plan: false,
      },
    };

    await auditBrainCoachCaregiverChange({
      access,
      previousValue: { paused: false },
      newValue: { paused: true },
      source: "brain_coach_settings_caregiver",
    });

    expect(mocks.db.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insertValues).toHaveBeenCalledWith({
      user_id: "senior-1",
      schedule_id: null,
      changed_by: "caregiver-1",
      changed_by_role: "caregiver",
      previous_value: { paused: false },
      new_value: { paused: true },
      consent_source: "brain_coach_settings_caregiver",
    });
  });

  it("audits senior Brain Coach permission updates to consent audit logs", async () => {
    const access: BrainCoachAccessContext = {
      targetUserId: "senior-1",
      actorUserId: "senior-1",
      actorRole: "elder",
      isOwnProfile: true,
      isAdmin: false,
      permissions: {
        view_summary: true,
        manage_plan_preferences: true,
        manage_schedule: true,
        send_nudges: true,
        preview_plan: true,
      },
    };

    await auditBrainCoachCaregiverChange({
      access,
      previousValue: {
        membership_id: "member-1",
        permissions: { brain_coach: { view_summary: true } },
      },
      newValue: {
        membership_id: "member-1",
        permissions: { brain_coach: { view_summary: true, manage_schedule: true } },
      },
      source: "brain_coach_permission_update",
    });

    expect(mocks.db.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insertValues).toHaveBeenCalledWith({
      user_id: "senior-1",
      schedule_id: null,
      changed_by: "senior-1",
      changed_by_role: "elder",
      previous_value: {
        membership_id: "member-1",
        permissions: { brain_coach: { view_summary: true } },
      },
      new_value: {
        membership_id: "member-1",
        permissions: { brain_coach: { view_summary: true, manage_schedule: true } },
      },
      consent_source: "brain_coach_permission_update",
    });
  });
});
