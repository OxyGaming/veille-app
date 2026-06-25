-- CreateTable
CREATE TABLE "VehicleRoundNonConformity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "observationId" TEXT,
    "itemLabel" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "plannedDate" DATETIME,
    "redressedDate" DATETIME,
    "closedDate" DATETIME,
    "generatedActionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VehicleRoundNonConformity_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "VehicleRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VehicleRoundNonConformity_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "VehicleRoundObservation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VehicleRoundNonConformity_generatedActionId_fkey" FOREIGN KEY ("generatedActionId") REFERENCES "ImportedAction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ImportedAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "agentId" TEXT,
    "siteId" TEXT,
    "vehicleId" TEXT,
    "procedureId" TEXT,
    "localStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "originalStatus" TEXT,
    "type" TEXT,
    "subType" TEXT,
    "establishment" TEXT,
    "unit" TEXT,
    "secteur" TEXT,
    "veilleGroup" TEXT,
    "space" TEXT,
    "domain" TEXT,
    "theme" TEXT,
    "keyPoint" TEXT,
    "observedElement" TEXT,
    "veilleType" TEXT,
    "realizedAt" DATETIME,
    "dueAt" DATETIME,
    "closedAt" DATETIME,
    "comment" TEXT,
    "initialOwner" TEXT,
    "sharedWith" TEXT,
    "transferredTo" TEXT,
    "actionPlan" TEXT,
    "importId" TEXT,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupHash" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportedAction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImportedAction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportedAction_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportedAction_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportedAction_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportedAction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ActionImport" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ImportedAction" ("actionPlan", "agentId", "closedAt", "comment", "createdAt", "dedupHash", "domain", "dueAt", "establishment", "externalId", "id", "importId", "initialOwner", "keyPoint", "lastSeenAt", "localStatus", "observedElement", "originalStatus", "procedureId", "realizedAt", "secteur", "sharedWith", "siteId", "space", "subType", "tags", "teamId", "theme", "transferredTo", "type", "unit", "updatedAt", "veilleGroup", "veilleType") SELECT "actionPlan", "agentId", "closedAt", "comment", "createdAt", "dedupHash", "domain", "dueAt", "establishment", "externalId", "id", "importId", "initialOwner", "keyPoint", "lastSeenAt", "localStatus", "observedElement", "originalStatus", "procedureId", "realizedAt", "secteur", "sharedWith", "siteId", "space", "subType", "tags", "teamId", "theme", "transferredTo", "type", "unit", "updatedAt", "veilleGroup", "veilleType" FROM "ImportedAction";
DROP TABLE "ImportedAction";
ALTER TABLE "new_ImportedAction" RENAME TO "ImportedAction";
CREATE INDEX "ImportedAction_externalId_idx" ON "ImportedAction"("externalId");
CREATE INDEX "ImportedAction_teamId_idx" ON "ImportedAction"("teamId");
CREATE INDEX "ImportedAction_agentId_idx" ON "ImportedAction"("agentId");
CREATE INDEX "ImportedAction_siteId_idx" ON "ImportedAction"("siteId");
CREATE INDEX "ImportedAction_vehicleId_idx" ON "ImportedAction"("vehicleId");
CREATE INDEX "ImportedAction_localStatus_idx" ON "ImportedAction"("localStatus");
CREATE INDEX "ImportedAction_dueAt_idx" ON "ImportedAction"("dueAt");
CREATE INDEX "ImportedAction_agentId_dedupHash_idx" ON "ImportedAction"("agentId", "dedupHash");
CREATE INDEX "ImportedAction_localStatus_dueAt_idx" ON "ImportedAction"("localStatus", "dueAt");
CREATE UNIQUE INDEX "ImportedAction_externalId_agentId_key" ON "ImportedAction"("externalId", "agentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "VehicleRoundNonConformity_observationId_key" ON "VehicleRoundNonConformity"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleRoundNonConformity_generatedActionId_key" ON "VehicleRoundNonConformity"("generatedActionId");

-- CreateIndex
CREATE INDEX "VehicleRoundNonConformity_roundId_idx" ON "VehicleRoundNonConformity"("roundId");

-- CreateIndex
CREATE INDEX "VehicleRoundNonConformity_redressedDate_idx" ON "VehicleRoundNonConformity"("redressedDate");
