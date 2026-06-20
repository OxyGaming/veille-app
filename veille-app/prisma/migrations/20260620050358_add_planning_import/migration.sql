-- CreateTable
CREATE TABLE "PlanningImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importedById" TEXT,
    "fileName" TEXT,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "rowsTotal" INTEGER NOT NULL DEFAULT 0,
    "rowsService" INTEGER NOT NULL DEFAULT 0,
    "rowsNonService" INTEGER NOT NULL DEFAULT 0,
    "rowsImported" INTEGER NOT NULL DEFAULT 0,
    "rowsIgnored" INTEGER NOT NULL DEFAULT 0,
    "rowsErrored" INTEGER NOT NULL DEFAULT 0,
    "unknownMatricules" TEXT NOT NULL DEFAULT '[]',
    "rawUchSummary" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanningImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanningShift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "jsNumber" TEXT,
    "jsCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanningShift_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PlanningImport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanningShift_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlanningImport_createdAt_idx" ON "PlanningImport"("createdAt");

-- CreateIndex
CREATE INDEX "PlanningShift_agentId_startsAt_idx" ON "PlanningShift"("agentId", "startsAt");

-- CreateIndex
CREATE INDEX "PlanningShift_startsAt_endsAt_idx" ON "PlanningShift"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "PlanningShift_importId_idx" ON "PlanningShift"("importId");
