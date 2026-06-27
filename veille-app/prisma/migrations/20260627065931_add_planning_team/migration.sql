-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlanningImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT,
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
    CONSTRAINT "PlanningImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlanningImport_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlanningImport" ("createdAt", "fileName", "id", "importedById", "periodEnd", "periodStart", "rawUchSummary", "rowsErrored", "rowsIgnored", "rowsImported", "rowsNonService", "rowsService", "rowsTotal", "unknownMatricules") SELECT "createdAt", "fileName", "id", "importedById", "periodEnd", "periodStart", "rawUchSummary", "rowsErrored", "rowsIgnored", "rowsImported", "rowsNonService", "rowsService", "rowsTotal", "unknownMatricules" FROM "PlanningImport";
DROP TABLE "PlanningImport";
ALTER TABLE "new_PlanningImport" RENAME TO "PlanningImport";
CREATE INDEX "PlanningImport_teamId_idx" ON "PlanningImport"("teamId");
CREATE INDEX "PlanningImport_createdAt_idx" ON "PlanningImport"("createdAt");
CREATE TABLE "new_PlanningShift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "teamId" TEXT,
    "agentId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "jsNumber" TEXT,
    "jsCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanningShift_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PlanningImport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanningShift_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanningShift_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlanningShift" ("agentId", "createdAt", "endsAt", "id", "importId", "jsCode", "jsNumber", "startsAt") SELECT "agentId", "createdAt", "endsAt", "id", "importId", "jsCode", "jsNumber", "startsAt" FROM "PlanningShift";
DROP TABLE "PlanningShift";
ALTER TABLE "new_PlanningShift" RENAME TO "PlanningShift";
CREATE INDEX "PlanningShift_agentId_startsAt_idx" ON "PlanningShift"("agentId", "startsAt");
CREATE INDEX "PlanningShift_startsAt_endsAt_idx" ON "PlanningShift"("startsAt", "endsAt");
CREATE INDEX "PlanningShift_importId_idx" ON "PlanningShift"("importId");
CREATE INDEX "PlanningShift_teamId_idx" ON "PlanningShift"("teamId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
