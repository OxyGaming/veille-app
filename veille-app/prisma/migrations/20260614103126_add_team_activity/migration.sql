-- CreateTable
CREATE TABLE "TeamActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorName" TEXT,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT,
    "message" TEXT NOT NULL,
    "targetUrl" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "TeamActivity_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TeamActivity_teamId_createdAt_idx" ON "TeamActivity"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamActivity_actorId_idx" ON "TeamActivity"("actorId");

-- CreateIndex
CREATE INDEX "TeamActivity_type_idx" ON "TeamActivity"("type");
