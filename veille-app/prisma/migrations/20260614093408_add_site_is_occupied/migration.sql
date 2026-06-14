-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "address" TEXT,
    "description" TEXT,
    "teamId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "hasGreasingArea" BOOLEAN NOT NULL DEFAULT false,
    "isOccupied" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Site_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Site" ("address", "code", "createdAt", "description", "hasGreasingArea", "id", "isActive", "isVisible", "name", "teamId", "type", "updatedAt") SELECT "address", "code", "createdAt", "description", "hasGreasingArea", "id", "isActive", "isVisible", "name", "teamId", "type", "updatedAt" FROM "Site";
DROP TABLE "Site";
ALTER TABLE "new_Site" RENAME TO "Site";
CREATE UNIQUE INDEX "Site_code_key" ON "Site"("code");
CREATE INDEX "Site_teamId_idx" ON "Site"("teamId");
CREATE INDEX "Site_isVisible_idx" ON "Site"("isVisible");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
