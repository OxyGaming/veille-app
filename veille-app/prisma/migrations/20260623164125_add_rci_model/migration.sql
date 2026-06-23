-- CreateTable
CREATE TABLE "Rci" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "dossierNumber" TEXT,
    "eventAt" DATETIME,
    "title" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Rci_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Rci_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT,
    "observationId" TEXT,
    "agentSightingId" TEXT,
    "siteSightingId" TEXT,
    "rciId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "clientId" TEXT,
    "legend" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'SYNCED',
    "width" INTEGER,
    "height" INTEGER,
    "byteSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VeilleSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Photo_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "ObservationItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Photo_agentSightingId_fkey" FOREIGN KEY ("agentSightingId") REFERENCES "AgentSighting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Photo_siteSightingId_fkey" FOREIGN KEY ("siteSightingId") REFERENCES "SiteSighting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Photo_rciId_fkey" FOREIGN KEY ("rciId") REFERENCES "Rci" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Photo_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Photo" ("agentSightingId", "byteSize", "clientId", "createdAt", "height", "id", "legend", "observationId", "sessionId", "siteSightingId", "storagePath", "syncStatus", "uploaderId", "width") SELECT "agentSightingId", "byteSize", "clientId", "createdAt", "height", "id", "legend", "observationId", "sessionId", "siteSightingId", "storagePath", "syncStatus", "uploaderId", "width" FROM "Photo";
DROP TABLE "Photo";
ALTER TABLE "new_Photo" RENAME TO "Photo";
CREATE INDEX "Photo_sessionId_idx" ON "Photo"("sessionId");
CREATE INDEX "Photo_observationId_idx" ON "Photo"("observationId");
CREATE INDEX "Photo_agentSightingId_idx" ON "Photo"("agentSightingId");
CREATE INDEX "Photo_siteSightingId_idx" ON "Photo"("siteSightingId");
CREATE INDEX "Photo_rciId_idx" ON "Photo"("rciId");
CREATE INDEX "Photo_syncStatus_idx" ON "Photo"("syncStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Rci_teamId_status_idx" ON "Rci"("teamId", "status");

-- CreateIndex
CREATE INDEX "Rci_authorId_idx" ON "Rci"("authorId");

-- CreateIndex
CREATE INDEX "Rci_updatedAt_idx" ON "Rci"("updatedAt");
