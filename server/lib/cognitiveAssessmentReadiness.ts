import type { Pool } from "pg";
import {
  COGNITIVE_ASSESSMENT_EXPECTED_TASK_IDS,
  COGNITIVE_ASSESSMENT_LANGUAGE_REQUIREMENTS,
  COGNITIVE_ASSESSMENT_LANGUAGES,
  COGNITIVE_ASSESSMENT_STATIC_TASK_IDS,
  type CognitiveAssessmentLanguageReadiness,
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

export async function loadCognitiveAssessmentReadiness(
  database: Pick<Pool, "query"> = pool,
) {
  const itemTaskIds = COGNITIVE_ASSESSMENT_LANGUAGE_REQUIREMENTS.flatMap((requirementDefinition) => (
    "taskDefinitionId" in requirementDefinition ? [requirementDefinition.taskDefinitionId] : []
  ));

  const [taskDefinitionResult, itemCountResult, rotationCountResult] = await Promise.all([
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
  ]);

  return evaluateCognitiveAssessmentReadiness({
    taskDefinitions: taskDefinitionResult.rows,
    itemCounts: itemCountResult.rows,
    rotationCounts: rotationCountResult.rows,
  });
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
