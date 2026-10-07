import type { Pool } from "pg";
import {
  COGNITIVE_ASSESSMENT_EXPECTED_TASK_IDS,
  COGNITIVE_ASSESSMENT_LANGUAGE_REQUIREMENTS,
  COGNITIVE_ASSESSMENT_LANGUAGES,
  COGNITIVE_ASSESSMENT_STATIC_TASK_IDS,
  type CognitiveAssessmentLanguageReadiness,
  type CognitiveAssessmentOperationsReadiness,
  type CognitiveAssessmentReminderCommunicationStatus,
  type CognitiveAssessmentReminderTestCandidate,
  type CognitiveAssessmentReadinessRequirement,
  type CognitiveAssessmentReadinessResponse,
} from "../../shared/cognitiveAssessmentReadiness.js";
import type { CognitiveAssessmentLanguage } from "../../shared/cognitiveAssessmentRunner.js";
import { pool } from "../db.js";

export type CognitiveReadinessTaskDefinitionRow = {
  id: string;
  content_source: string;
  content_static: unknown;
};

export type CognitiveReadinessItemCountRow = {
  task_definition_id: string;
  language: string;
  active_count: number | string;
};

export type CognitiveReadinessRotationCountRow = {
  language: string;
  active_count: number | string;
};

type CognitiveReadinessCountRow = {
  count: number | string;
};

type CognitiveReadinessCommunicationRow = {
  id: string;
  channel: string;
  status: string;
  recipient: string;
  created_at: Date | string | null;
  sent_at: Date | string | null;
  metadata: unknown;
};

type CognitiveReadinessTestCandidateRow = {
  user_id: string;
  label: string | null;
  recipient: string | null;
  language: string | null;
  next_run_at: Date | string | null;
};

export type CognitiveReadinessInput = {
  taskDefinitions: CognitiveReadinessTaskDefinitionRow[];
  itemCounts: CognitiveReadinessItemCountRow[];
  rotationCounts: CognitiveReadinessRotationCountRow[];
  generatedAt?: string;
};

function countValue(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function firstEnvValue(keys: string[]) {
  return keys.map(envValue).find(Boolean) ?? "";
}

function numberEnv(key: string, fallback: number) {
  const value = Number(envValue(key) || fallback);
  return Number.isFinite(value) ? value : fallback;
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function metadataString(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return null;
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasStaticLanguage(contentStatic: unknown, language: CognitiveAssessmentLanguage) {
  if (!isRecord(contentStatic)) return false;
  const languages = contentStatic.languages;
  return isRecord(languages) && Object.prototype.hasOwnProperty.call(languages, language);
}

function itemCountFor(
  rows: CognitiveReadinessItemCountRow[],
  taskDefinitionId: string,
  language: CognitiveAssessmentLanguage,
) {
  const row = rows.find((candidate) => (
    candidate.task_definition_id === taskDefinitionId
    && candidate.language === language
  ));
  return countValue(row?.active_count);
}

function rotationCountFor(
  rows: CognitiveReadinessRotationCountRow[],
  language: CognitiveAssessmentLanguage,
) {
  const row = rows.find((candidate) => candidate.language === language);
  return countValue(row?.active_count);
}

function staticCountFor(
  taskDefinitions: CognitiveReadinessTaskDefinitionRow[],
  language: CognitiveAssessmentLanguage,
) {
  return taskDefinitions.filter((definition) => (
    COGNITIVE_ASSESSMENT_STATIC_TASK_IDS.includes(definition.id as typeof COGNITIVE_ASSESSMENT_STATIC_TASK_IDS[number])
    && hasStaticLanguage(definition.content_static, language)
  )).length;
}

function requirement(
  key: string,
  label: string,
  activeCount: number,
  expectedCount: number,
): CognitiveAssessmentReadinessRequirement {
  return {
    key,
    label,
    activeCount,
    expectedCount,
    ready: activeCount >= expectedCount,
  };
}

function languageBlockers(requirements: CognitiveAssessmentReadinessRequirement[]) {
  return requirements
    .filter((item) => !item.ready)
    .map((item) => `${item.label}: ${item.activeCount}/${item.expectedCount}`);
}

export function evaluateCognitiveAssessmentReadiness(
  input: CognitiveReadinessInput,
): CognitiveAssessmentReadinessResponse {
  const expectedIds = new Set<string>(COGNITIVE_ASSESSMENT_EXPECTED_TASK_IDS);
  const activeIds = new Set(input.taskDefinitions.map((definition) => definition.id));
  const missingIds = COGNITIVE_ASSESSMENT_EXPECTED_TASK_IDS.filter((id) => !activeIds.has(id));
  const unexpectedIds = input.taskDefinitions
    .map((definition) => definition.id)
    .filter((id) => !expectedIds.has(id))
    .sort((left, right) => left.localeCompare(right));

  const taskDefinitions = {
    ready: missingIds.length === 0
      && unexpectedIds.length === 0
      && input.taskDefinitions.length === COGNITIVE_ASSESSMENT_EXPECTED_TASK_IDS.length,
    activeCount: input.taskDefinitions.length,
    expectedCount: COGNITIVE_ASSESSMENT_EXPECTED_TASK_IDS.length,
    missingIds,
    unexpectedIds,
  };

  const languages: CognitiveAssessmentLanguageReadiness[] = COGNITIVE_ASSESSMENT_LANGUAGES.map((language) => {
    const requirements = COGNITIVE_ASSESSMENT_LANGUAGE_REQUIREMENTS.map((definition) => {
      if (definition.key === "orientation_forms") {
        return requirement(definition.key, definition.label, rotationCountFor(input.rotationCounts, language), definition.expectedCount);
      }
      if (definition.key === "static_content") {
        return requirement(definition.key, definition.label, staticCountFor(input.taskDefinitions, language), definition.expectedCount);
      }
      if ("taskDefinitionId" in definition) {
        return requirement(
          definition.key,
          definition.label,
          itemCountFor(input.itemCounts, definition.taskDefinitionId, language),
          definition.expectedCount,
        );
      }
      return requirement(definition.key, definition.label, 0, definition.expectedCount);
    });
    const blockers = languageBlockers(requirements);
    return {
      language,
      ready: taskDefinitions.ready && blockers.length === 0,
      blockers,
      requirements,
    };
  });

  const blockers = [
    ...(!taskDefinitions.ready ? [
      taskDefinitions.activeCount === taskDefinitions.expectedCount
        ? "Task definition ids do not match the 12-step registry."
        : `Task definitions: ${taskDefinitions.activeCount}/${taskDefinitions.expectedCount}`,
    ] : []),
    ...taskDefinitions.missingIds.map((id) => `Missing task: ${id}`),
    ...taskDefinitions.unexpectedIds.map((id) => `Unexpected active task: ${id}`),
    ...languages
      .filter((language) => !language.ready)
      .map((language) => `${language.language}: ${language.blockers.join(", ") || "not ready"}`),
  ];

  return {
    ready: taskDefinitions.ready && languages.every((language) => language.ready),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    taskDefinitions,
    languages,
    blockers,
  };
}

function communicationStatusFromRow(
  row: CognitiveReadinessCommunicationRow | null | undefined,
): CognitiveAssessmentReminderCommunicationStatus | null {
  if (!row) return null;
  return {
    id: row.id,
    channel: row.channel,
    status: row.status,
    recipient: row.recipient,
    createdAt: iso(row.created_at),
    sentAt: iso(row.sent_at),
    scheduledFor: metadataString(row.metadata, "scheduled_for"),
    error: metadataString(row.metadata, "dispatch_error"),
  };
}

function testCandidateFromRow(row: CognitiveReadinessTestCandidateRow): CognitiveAssessmentReminderTestCandidate | null {
  const recipient = typeof row.recipient === "string" && row.recipient.trim() ? row.recipient.trim() : null;
  if (!recipient) return null;
  return {
    userId: row.user_id,
    label: typeof row.label === "string" && row.label.trim() ? row.label.trim() : "Member",
    recipient,
    language: typeof row.language === "string" && row.language.trim() ? row.language.trim() : "en",
    nextRunAt: iso(row.next_run_at),
  };
}

export async function loadCognitiveAssessmentOperationsReadiness(
  database: Pick<Pool, "query"> = pool,
): Promise<CognitiveAssessmentOperationsReadiness> {
  const intervalMs = numberEnv("COMMUNICATION_DISPATCH_INTERVAL_MS", 0);
  const dispatcherEnabled = intervalMs > 0;
  const batchSize = numberEnv("COMMUNICATION_DISPATCH_BATCH_SIZE", 25);
  const twilioCredentialsConfigured = Boolean(envValue("TWILIO_ACCOUNT_SID") && envValue("TWILIO_AUTH_TOKEN"));
  const whatsappSender = firstEnvValue([
    "TWILIO_WHATSAPP_MESSAGING_SERVICE_SID",
    "TWILIO_WHATSAPP_FROM",
    "TWILIO_WHATSAPP_FROM_NUMBER",
  ]);
  const whatsappProvider = envValue("TWILIO_WHATSAPP_MESSAGING_SERVICE_SID")
    ? "Twilio WhatsApp service"
    : whatsappSender
      ? "Twilio WhatsApp sender"
      : "Twilio WhatsApp";

  const [
    activeEnrollmentResult,
    dueNowResult,
    queuedPendingResult,
    lastQueuedResult,
    lastErrorResult,
    testCandidateResult,
  ] = await Promise.all([
    database.query<CognitiveReadinessCountRow>(`
      select count(*)::int as count
      from public.cc_program_enrollments
      where status = 'active'
    `),
    database.query<CognitiveReadinessCountRow>(`
      select count(*)::int as count
      from public.cc_program_enrollments e
      join public.scheduled_interactions si on si.id = e.scheduled_interaction_id
      where e.status = 'active'
        and si.interaction_type = 'BRAIN_COACH'
        and si.source_ref_id = 'cognitive_assessment'
        and si.status = 'ACTIVE'
        and si.is_paused = false
        and si.next_run_at is not null
        and si.next_run_at <= now()
    `),
    database.query<CognitiveReadinessCountRow>(`
      select count(*)::int as count
      from public.communications_log
      where purpose = 'cognitive_assessment_reminder'
        and status in ('queued', 'sending')
    `),
    database.query<CognitiveReadinessCommunicationRow>(`
      select
        id::text,
        channel,
        status,
        recipient,
        created_at,
        sent_at,
        metadata
      from public.communications_log
      where purpose = 'cognitive_assessment_reminder'
      order by created_at desc
      limit 1
    `),
    database.query<CognitiveReadinessCommunicationRow>(`
      select
        id::text,
        channel,
        status,
        recipient,
        created_at,
        sent_at,
        metadata
      from public.communications_log
      where purpose = 'cognitive_assessment_reminder'
        and status = 'failed'
      order by created_at desc
      limit 1
    `),
    database.query<CognitiveReadinessTestCandidateRow>(`
      select
        e.user_id::text,
        coalesce(nullif(p.preferred_name, ''), nullif(p.full_name, ''), nullif(p.email, ''), nullif(p.phone_number, ''), 'Member') as label,
        coalesce(nullif(p.whatsapp_number, ''), nullif(p.phone_number, '')) as recipient,
        coalesce(nullif(si.preferred_language, ''), 'en') as language,
        si.next_run_at
      from public.cc_program_enrollments e
      join public.scheduled_interactions si on si.id = e.scheduled_interaction_id
      left join public.profiles p on p.id::text = e.user_id::text
      where e.status = 'active'
        and si.interaction_type = 'BRAIN_COACH'
        and si.source_ref_id = 'cognitive_assessment'
        and si.status = 'ACTIVE'
        and coalesce(nullif(p.whatsapp_number, ''), nullif(p.phone_number, '')) is not null
      order by si.next_run_at asc nulls last, e.updated_at desc
      limit 25
    `),
  ]);

  return {
    dispatcher: {
      enabled: dispatcherEnabled,
      intervalMs: dispatcherEnabled ? intervalMs : null,
      batchSize,
      missingConfig: dispatcherEnabled ? [] : ["COMMUNICATION_DISPATCH_INTERVAL_MS"],
    },
    whatsapp: {
      configured: twilioCredentialsConfigured && Boolean(whatsappSender),
      credentialsConfigured: twilioCredentialsConfigured,
      senderConfigured: Boolean(whatsappSender),
      provider: whatsappProvider,
      missingConfig: [
        ...(!twilioCredentialsConfigured ? ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"] : []),
        ...(!whatsappSender ? ["TWILIO_WHATSAPP_FROM or TWILIO_WHATSAPP_MESSAGING_SERVICE_SID"] : []),
      ],
    },
    reminders: {
      activeEnrollments: countValue(activeEnrollmentResult.rows[0]?.count),
      dueNow: countValue(dueNowResult.rows[0]?.count),
      queuedPending: countValue(queuedPendingResult.rows[0]?.count),
      lastQueued: communicationStatusFromRow(lastQueuedResult.rows[0]),
      lastError: communicationStatusFromRow(lastErrorResult.rows[0]),
      testCandidates: testCandidateResult.rows.flatMap((row) => {
        const candidate = testCandidateFromRow(row);
        return candidate ? [candidate] : [];
      }),
    },
  };
}

export async function loadCognitiveAssessmentReadiness(
  database: Pick<Pool, "query"> = pool,
) {
  const itemTaskIds = COGNITIVE_ASSESSMENT_LANGUAGE_REQUIREMENTS.flatMap((requirementDefinition) => (
    "taskDefinitionId" in requirementDefinition ? [requirementDefinition.taskDefinitionId] : []
  ));

  const [taskDefinitionResult, itemCountResult, rotationCountResult, operations] = await Promise.all([
    database.query<CognitiveReadinessTaskDefinitionRow>(`
      select id, content_source, content_static
      from public.cc_task_definitions
      where is_active = true
        and supports_wizard = true
      order by display_order asc
    `),
    database.query<CognitiveReadinessItemCountRow>(`
      select
        task_definition_id,
        language,
        count(*)::int as active_count
      from public.cc_item_bank
      where is_active = true
        and rejected = false
        and language = any($1::text[])
        and task_definition_id = any($2::text[])
      group by task_definition_id, language
    `, [[...COGNITIVE_ASSESSMENT_LANGUAGES], itemTaskIds]),
    database.query<CognitiveReadinessRotationCountRow>(`
      select language, count(*)::int as active_count
      from public.cc_rotation_forms
      where task_definition_id = 'orientation'
        and is_active = true
        and language = any($1::text[])
      group by language
    `, [[...COGNITIVE_ASSESSMENT_LANGUAGES]]),
    loadCognitiveAssessmentOperationsReadiness(database),
  ]);

  const readiness = evaluateCognitiveAssessmentReadiness({
    taskDefinitions: taskDefinitionResult.rows,
    itemCounts: itemCountResult.rows,
    rotationCounts: rotationCountResult.rows,
  });
  return {
    ...readiness,
    operations,
  };
}

export function cognitiveReadinessBlockersForLanguage(
  readiness: CognitiveAssessmentReadinessResponse,
  language: CognitiveAssessmentLanguage,
) {
  const languageStatus = readiness.languages.find((item) => item.language === language);
  return [
    ...(!readiness.taskDefinitions.ready ? [
      `Task definitions are incomplete (${readiness.taskDefinitions.activeCount}/${readiness.taskDefinitions.expectedCount}).`,
    ] : []),
    ...(languageStatus?.blockers ?? [`${language} readiness is missing.`]),
  ];
}
