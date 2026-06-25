-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "immatriculation" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "teamId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vehicle_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VehicleRoundTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "expectedFrequencyDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VehicleRoundSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "VehicleRoundSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VehicleRoundTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VehicleRoundItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "applicableTypes" TEXT NOT NULL DEFAULT '[]',
    "responseFormat" TEXT NOT NULL DEFAULT 'PRESENT_ABSENT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "VehicleRoundItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "VehicleRoundSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VehicleRound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "observerId" TEXT NOT NULL,
    "roundDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "finishedAt" DATETIME,
    "generalComment" TEXT,
    "vehicleType" TEXT NOT NULL,
    "immatriculation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VehicleRound_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VehicleRoundTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VehicleRound_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VehicleRound_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VehicleRound_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VehicleRoundObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    CONSTRAINT "VehicleRoundObservation_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "VehicleRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VehicleRoundObservation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "VehicleRoundSection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VehicleRoundObservation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "VehicleRoundItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VehicleRoundReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'PDF',
    "storagePath" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleRoundReport_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "VehicleRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_immatriculation_key" ON "Vehicle"("immatriculation");

-- CreateIndex
CREATE INDEX "Vehicle_teamId_idx" ON "Vehicle"("teamId");

-- CreateIndex
CREATE INDEX "Vehicle_type_idx" ON "Vehicle"("type");

-- CreateIndex
CREATE INDEX "Vehicle_isActive_idx" ON "Vehicle"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleRoundTemplate_slug_key" ON "VehicleRoundTemplate"("slug");

-- CreateIndex
CREATE INDEX "VehicleRoundSection_templateId_sortOrder_idx" ON "VehicleRoundSection"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "VehicleRoundItem_sectionId_sortOrder_idx" ON "VehicleRoundItem"("sectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "VehicleRound_vehicleId_idx" ON "VehicleRound"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleRound_teamId_idx" ON "VehicleRound"("teamId");

-- CreateIndex
CREATE INDEX "VehicleRound_observerId_idx" ON "VehicleRound"("observerId");

-- CreateIndex
CREATE INDEX "VehicleRound_status_idx" ON "VehicleRound"("status");

-- CreateIndex
CREATE INDEX "VehicleRound_roundDate_idx" ON "VehicleRound"("roundDate");

-- CreateIndex
CREATE INDEX "VehicleRound_status_finishedAt_idx" ON "VehicleRound"("status", "finishedAt");

-- CreateIndex
CREATE INDEX "VehicleRoundObservation_roundId_idx" ON "VehicleRoundObservation"("roundId");

-- CreateIndex
CREATE INDEX "VehicleRoundObservation_status_idx" ON "VehicleRoundObservation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleRoundObservation_roundId_itemId_key" ON "VehicleRoundObservation"("roundId", "itemId");

-- CreateIndex
CREATE INDEX "VehicleRoundReport_roundId_idx" ON "VehicleRoundReport"("roundId");
