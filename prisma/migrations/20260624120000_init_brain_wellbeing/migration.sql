-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SeniorProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dateOfBirth" DATETIME,
    "livingSituation" TEXT,
    "caregiverId" TEXT,
    "consentCaregiverAlerts" BOOLEAN NOT NULL DEFAULT true,
    "consentShareDetails" BOOLEAN NOT NULL DEFAULT true,
    "baselineStartedAt" DATETIME,
    "baselineStatus" TEXT NOT NULL DEFAULT 'COLLECTING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeniorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeniorProfile_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "answerType" TEXT NOT NULL,
    "optionsJson" TEXT,
    "cadence" TEXT NOT NULL,
    "burdenLevel" TEXT NOT NULL DEFAULT 'LOW',
    "preventionDomain" TEXT,
    "triggerRule" TEXT,
    "cooldownDays" INTEGER NOT NULL DEFAULT 14,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WeeklyForm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "questionIdsJson" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssessmentSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seniorId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "selectedReasonJson" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssessmentSession_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "SeniorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssessmentResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "seniorId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerText" TEXT,
    "answerValue" REAL,
    "answerJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentResponse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentResponse_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "SeniorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Signal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seniorId" TEXT NOT NULL,
    "responseId" TEXT,
    "domain" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "normalizedValue" REAL,
    "source" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.6,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signal_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "SeniorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Signal_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AssessmentResponse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BaselineMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seniorId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "baselineMean" REAL NOT NULL,
    "baselineStd" REAL NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "windowDays" INTEGER NOT NULL DEFAULT 14,
    "status" TEXT NOT NULL DEFAULT 'COLLECTING',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BaselineMetric_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "SeniorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Insight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seniorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceJson" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "confidence" REAL NOT NULL DEFAULT 0.6,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Insight_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "SeniorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PreventionRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seniorId" TEXT NOT NULL,
    "insightId" TEXT,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PreventionRecommendation_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "SeniorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PreventionRecommendation_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "Insight" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seniorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "evidenceJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    CONSTRAINT "Alert_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "SeniorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CaregiverNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seniorId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "concernTag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaregiverNote_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "SeniorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaregiverNote_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Medication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seniorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "doseLabel" TEXT NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Medication_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "SeniorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MedicationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "medicationId" TEXT NOT NULL,
    "seniorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledFor" DATETIME NOT NULL,
    "recordedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicationEvent_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MedicationEvent_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "SeniorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Routine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seniorId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scheduledTime" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Routine_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "SeniorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RoutineEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineId" TEXT NOT NULL,
    "seniorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledFor" DATETIME NOT NULL,
    "recordedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoutineEvent_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoutineEvent_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "SeniorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TranscriptMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seniorId" TEXT NOT NULL,
    "sessionId" TEXT,
    "wordCount" INTEGER NOT NULL,
    "durationSeconds" REAL,
    "averageWordsPerSentence" REAL,
    "hesitationCount" INTEGER,
    "repeatedPhraseCount" INTEGER,
    "transcriptText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranscriptMetadata_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "SeniorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TranscriptMetadata_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SeniorProfile_userId_key" ON "SeniorProfile"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SeniorProfile_caregiverId_idx" ON "SeniorProfile"("caregiverId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SeniorProfile_baselineStatus_idx" ON "SeniorProfile"("baselineStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Question_domain_idx" ON "Question"("domain");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Question_cadence_idx" ON "Question"("cadence");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Question_active_idx" ON "Question"("active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyForm_weekNumber_key" ON "WeeklyForm"("weekNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssessmentSession_seniorId_sessionType_idx" ON "AssessmentSession"("seniorId", "sessionType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssessmentSession_seniorId_startedAt_idx" ON "AssessmentSession"("seniorId", "startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssessmentSession_status_idx" ON "AssessmentSession"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssessmentResponse_seniorId_createdAt_idx" ON "AssessmentResponse"("seniorId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssessmentResponse_sessionId_idx" ON "AssessmentResponse"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssessmentResponse_questionId_idx" ON "AssessmentResponse"("questionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Signal_seniorId_domain_createdAt_idx" ON "Signal"("seniorId", "domain", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Signal_source_idx" ON "Signal"("source");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BaselineMetric_domain_idx" ON "BaselineMetric"("domain");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BaselineMetric_seniorId_domain_key" ON "BaselineMetric"("seniorId", "domain");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Insight_seniorId_status_idx" ON "Insight"("seniorId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Insight_domain_idx" ON "Insight"("domain");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Insight_severity_idx" ON "Insight"("severity");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PreventionRecommendation_seniorId_status_idx" ON "PreventionRecommendation"("seniorId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PreventionRecommendation_domain_idx" ON "PreventionRecommendation"("domain");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Alert_seniorId_status_idx" ON "Alert"("seniorId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Alert_severity_idx" ON "Alert"("severity");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Alert_type_idx" ON "Alert"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CaregiverNote_seniorId_createdAt_idx" ON "CaregiverNote"("seniorId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CaregiverNote_caregiverId_idx" ON "CaregiverNote"("caregiverId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Medication_seniorId_active_idx" ON "Medication"("seniorId", "active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MedicationEvent_seniorId_scheduledFor_idx" ON "MedicationEvent"("seniorId", "scheduledFor");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MedicationEvent_medicationId_idx" ON "MedicationEvent"("medicationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MedicationEvent_status_idx" ON "MedicationEvent"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Routine_seniorId_active_idx" ON "Routine"("seniorId", "active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoutineEvent_seniorId_scheduledFor_idx" ON "RoutineEvent"("seniorId", "scheduledFor");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoutineEvent_routineId_idx" ON "RoutineEvent"("routineId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoutineEvent_status_idx" ON "RoutineEvent"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TranscriptMetadata_seniorId_createdAt_idx" ON "TranscriptMetadata"("seniorId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TranscriptMetadata_sessionId_idx" ON "TranscriptMetadata"("sessionId");


