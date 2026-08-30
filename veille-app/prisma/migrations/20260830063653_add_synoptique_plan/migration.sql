-- CreateTable
CREATE TABLE "SynoptiquePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'secteur-veille',
    "doc" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SynoptiquePlan_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SynoptiquePlan_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SynoptiquePlan_teamId_idx" ON "SynoptiquePlan"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "SynoptiquePlan_teamId_key_key" ON "SynoptiquePlan"("teamId", "key");
