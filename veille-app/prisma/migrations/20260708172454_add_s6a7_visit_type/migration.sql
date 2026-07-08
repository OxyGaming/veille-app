-- AlterTable
ALTER TABLE "SiteVisitObservation" ADD COLUMN "phoneStatus" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SiteEquipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "itemKind" TEXT NOT NULL DEFAULT 'MATERIEL',
    "domain" TEXT NOT NULL DEFAULT 'VEILLE_SITE',
    "expectedQuantity" INTEGER,
    "isPerishable" BOOLEAN NOT NULL DEFAULT false,
    "expirationDate" DATETIME,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SiteEquipment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SiteEquipment" ("category", "createdAt", "expectedQuantity", "expirationDate", "id", "isActive", "isPerishable", "label", "notes", "siteId", "sortOrder", "updatedAt") SELECT "category", "createdAt", "expectedQuantity", "expirationDate", "id", "isActive", "isPerishable", "label", "notes", "siteId", "sortOrder", "updatedAt" FROM "SiteEquipment";
DROP TABLE "SiteEquipment";
ALTER TABLE "new_SiteEquipment" RENAME TO "SiteEquipment";
CREATE INDEX "SiteEquipment_siteId_idx" ON "SiteEquipment"("siteId");
CREATE INDEX "SiteEquipment_category_idx" ON "SiteEquipment"("category");
CREATE INDEX "SiteEquipment_isActive_idx" ON "SiteEquipment"("isActive");
CREATE INDEX "SiteEquipment_domain_idx" ON "SiteEquipment"("domain");
CREATE INDEX "SiteEquipment_itemKind_idx" ON "SiteEquipment"("itemKind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
