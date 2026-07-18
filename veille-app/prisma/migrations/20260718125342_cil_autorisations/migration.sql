-- CreateTable
CREATE TABLE "CilAutorisation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentId" TEXT NOT NULL,
    "subtype" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL,
    "signerName" TEXT,
    "imageB64" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CilAutorisation_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "CilIncident" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CilAutorisation_incidentId_idx" ON "CilAutorisation"("incidentId");

-- CreateIndex
CREATE UNIQUE INDEX "CilAutorisation_incidentId_subtype_role_key" ON "CilAutorisation"("incidentId", "subtype", "role");
